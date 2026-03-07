import "server-only";

import { execFile } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { withServerTiming } from "@/lib/server/logging/logger";
import {
  ensureDataRootDirectories,
  resolveStoreAppDataRoot,
  resolveStoreStacksRoot,
} from "@/lib/server/storage/data-root";

const execFileAsync = promisify(execFile);

type ComposeCommandInput = {
  composePath: string;
  envPath: string;
  stackName: string;
  args: string[];
};

export type MaterializedStack = {
  stackDir: string;
  composePath: string;
  envPath: string;
  stackName: string;
  webUiPort: number | null;
};

export type ComposeStorageMappingStrategy =
  | "legacy_named_source"
  | "app_target_path";

type ParsedListItem = {
  prefix: string;
  spec: string;
  quote: "'" | '"' | null;
  comment: string;
};

type ParsedComposeVolumeSpec = {
  source: string;
  target: string;
  mode: string | null;
};

type ComposeStorageReferences = {
  bindMountDirectories: Set<string>;
  namedVolumeSources: Set<string>;
};

type ParsedKeyValueLine = {
  key: string;
  value: string;
  comment: string;
  quote: "'" | '"' | null;
};

type ParsedLongFormVolumeItem = {
  end: number;
  fields: Partial<Record<"type" | "source" | "target", string>>;
  fieldLines: Partial<Record<"type" | "source" | "target", number>>;
};

function sanitizeSegment(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function sanitizeStackName(appId: string, displayName?: string) {
  const source = displayName && displayName.trim().length > 0 ? displayName : appId;
  const sanitized = sanitizeSegment(source);

  if (!sanitized) {
    return `app-${Date.now()}`;
  }

  return sanitized.slice(0, 63);
}

function serializeEnvFile(env: Record<string, string>) {
  return Object.keys(env)
    .sort((a, b) => a.localeCompare(b))
    .map((key) => `${key}=${env[key] ?? ""}`)
    .join("\n");
}

export function applyWebUiPortOverride(composeContent: string, webUiPort: number) {
  const lines = composeContent.split("\n");
  let replaced = false;

  const updated = lines.map((line) => {
    if (replaced) return line;

    const match = line.match(/^(\s*-\s*["']?)(\d+)(:\d+(?::\d+)?(?:\/[a-z]+)?["']?\s*)$/i);
    if (!match) return line;

    replaced = true;
    return `${match[1]}${webUiPort}${match[3]}`;
  });

  // Some stacks (for example `network_mode: host`) intentionally do not publish ports.
  // In that case keep compose as-is and persist the port in installed stack metadata.
  if (!replaced) {
    return composeContent;
  }

  return updated.join("\n");
}

function isBlankOrComment(line: string) {
  const trimmed = line.trim();
  return trimmed.length === 0 || trimmed.startsWith("#");
}

function getIndentation(line: string) {
  return line.length - line.trimStart().length;
}

function parseListItem(line: string): ParsedListItem | null {
  const match = line.match(/^(\s*-\s+)(.+)$/);
  if (!match) return null;

  const prefix = match[1];
  let remainder = match[2].trimEnd();

  let quote: "'" | '"' | null = null;
  let comment = "";
  let quoteState: "'" | '"' | null = null;
  let commentStart = -1;

  for (let index = 0; index < remainder.length; index += 1) {
    const char = remainder[index];

    if (char === "'" || char === '"') {
      if (quoteState === char) {
        quoteState = null;
      } else if (quoteState === null) {
        quoteState = char;
      }
      continue;
    }

    if (char === "#" && quoteState === null && index > 0 && /\s/.test(remainder[index - 1])) {
      commentStart = index;
      break;
    }
  }

  if (commentStart >= 0) {
    comment = remainder.slice(commentStart - 1);
    remainder = remainder.slice(0, commentStart - 1).trimEnd();
  }

  if (
    (remainder.startsWith('"') && remainder.endsWith('"')) ||
    (remainder.startsWith("'") && remainder.endsWith("'"))
  ) {
    quote = remainder[0] as "'" | '"';
    remainder = remainder.slice(1, -1);
  }

  const spec = remainder.trim();
  if (!spec) return null;

  return {
    prefix,
    spec,
    quote,
    comment,
  };
}

function parseComposeVolumeSpec(spec: string): ParsedComposeVolumeSpec | null {
  if (spec.includes(": ")) {
    return null;
  }

  const parts = spec.split(":");
  if (parts.length < 2) {
    return null;
  }

  const source = parts[0]?.trim();
  const target = parts[1]?.trim();

  if (!source || !target || !target.startsWith("/")) {
    return null;
  }

  const modeRaw = parts.slice(2).join(":").trim();

  return {
    source,
    target,
    mode: modeRaw.length > 0 ? modeRaw : null,
  };
}

function parseKeyValueLine(line: string): ParsedKeyValueLine | null {
  const trimmed = line.trim();
  const match = trimmed.match(/^([A-Za-z0-9_.-]+):\s*(.*?)\s*$/);
  if (!match) {
    return null;
  }

  let remainder = match[2] ?? "";
  let quote: "'" | '"' | null = null;
  let comment = "";
  let quoteState: "'" | '"' | null = null;
  let commentStart = -1;

  for (let index = 0; index < remainder.length; index += 1) {
    const char = remainder[index];

    if (char === "'" || char === '"') {
      if (quoteState === char) {
        quoteState = null;
      } else if (quoteState === null) {
        quoteState = char;
      }
      continue;
    }

    if (char === "#" && quoteState === null && index > 0 && /\s/.test(remainder[index - 1])) {
      commentStart = index;
      break;
    }
  }

  if (commentStart >= 0) {
    comment = remainder.slice(commentStart - 1);
    remainder = remainder.slice(0, commentStart - 1).trimEnd();
  }

  if (
    (remainder.startsWith('"') && remainder.endsWith('"')) ||
    (remainder.startsWith("'") && remainder.endsWith("'"))
  ) {
    quote = remainder[0] as "'" | '"';
    remainder = remainder.slice(1, -1);
  }

  return {
    key: match[1],
    value: remainder.trim(),
    comment,
    quote,
  };
}

function isLikelyNamedVolumeSource(source: string) {
  if (!source) return false;
  if (source.startsWith("/")) return false;
  if (source.startsWith("./") || source.startsWith("../")) return false;
  if (source === "." || source === "..") return false;
  if (source.startsWith("~")) return false;
  if (source.startsWith("$")) return false;
  if (source.includes("/")) return false;
  return true;
}

function isPathWithinRoot(candidate: string, root: string) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function normalizeContainerTargetPath(target: string) {
  const normalizedTarget = path.posix.normalize(target);
  const segments = normalizedTarget
    .split("/")
    .filter((segment) => segment.length > 0 && segment !== "." && segment !== "..");

  if (segments.length === 0) {
    return "data";
  }

  return path.join(...segments);
}

function resolveNamedVolumeBindSource(input: {
  appDataRoot: string;
  appId: string;
  source: string;
  target: string;
  strategy: ComposeStorageMappingStrategy;
}) {
  if (input.strategy === "legacy_named_source") {
    return path.join(input.appDataRoot, input.source);
  }

  if (input.appId.trim().length === 0) {
    throw new Error("appId is required for app_target_path storage mapping");
  }

  const appScopedRoot = path.join(input.appDataRoot, input.appId);
  const relativeTargetPath = normalizeContainerTargetPath(input.target);
  const bindSource = path.join(appScopedRoot, relativeTargetPath);

  if (!isPathWithinRoot(bindSource, appScopedRoot)) {
    throw new Error(
      `Generated bind mount path escapes app root for appId "${input.appId}"`,
    );
  }

  return bindSource;
}

function resolveAppScopedBindSource(appDataRoot: string, appId: string, target: string) {
  return resolveNamedVolumeBindSource({
    appDataRoot,
    appId,
    source: "__ignored__",
    target,
    strategy: "app_target_path",
  });
}

function shouldRewriteAppDataBindSource(input: {
  appDataRoot: string;
  appId: string;
  source: string;
  target: string;
  strategy: ComposeStorageMappingStrategy;
}) {
  if (input.strategy !== "app_target_path") {
    return false;
  }

  if (!path.isAbsolute(input.source) || !isPathWithinRoot(input.source, input.appDataRoot)) {
    return false;
  }

  const appScopedRoot = path.join(input.appDataRoot, input.appId);
  if (isPathWithinRoot(input.source, appScopedRoot)) {
    return false;
  }

  const desiredSource = resolveAppScopedBindSource(input.appDataRoot, input.appId, input.target);
  return path.resolve(input.source) !== path.resolve(desiredSource);
}

function parseLongFormVolumeItem(lines: string[], startIndex: number): ParsedLongFormVolumeItem {
  const startLine = lines[startIndex];
  const itemIndent = getIndentation(startLine);
  let end = startIndex + 1;

  while (end < lines.length) {
    const line = lines[end];
    if (isBlankOrComment(line)) {
      end += 1;
      continue;
    }

    if (getIndentation(line) <= itemIndent) {
      break;
    }

    end += 1;
  }

  const fields: ParsedLongFormVolumeItem["fields"] = {};
  const fieldLines: ParsedLongFormVolumeItem["fieldLines"] = {};
  const firstInline = parseKeyValueLine(startLine.replace(/^(\s*-\s+)/, ""));
  if (firstInline && (firstInline.key === "type" || firstInline.key === "source" || firstInline.key === "target")) {
    fields[firstInline.key] = firstInline.value;
    fieldLines[firstInline.key] = startIndex;
  }

  for (let index = startIndex + 1; index < end; index += 1) {
    const parsed = parseKeyValueLine(lines[index]);
    if (!parsed) continue;
    if (parsed.key === "type" || parsed.key === "source" || parsed.key === "target") {
      fields[parsed.key] = parsed.value;
      fieldLines[parsed.key] = index;
    }
  }

  return {
    end,
    fields,
    fieldLines,
  };
}

function rewriteKeyValueLine(
  line: string,
  expectedKey: string,
  nextValue: string,
  quote?: "'" | '"' | null,
) {
  const indent = line.match(/^\s*/)?.[0] ?? "";
  const parsed = parseKeyValueLine(line.trim());
  const trailingComment = parsed?.comment ?? "";
  const quoteChar = quote ?? parsed?.quote ?? null;
  const serializedValue = quoteChar ? `${quoteChar}${nextValue}${quoteChar}` : nextValue;
  return `${indent}${expectedKey}: ${serializedValue}${trailingComment}`;
}

function findTopLevelSectionEnd(lines: string[], startIndex: number) {
  for (let index = startIndex; index < lines.length; index += 1) {
    const line = lines[index];
    if (isBlankOrComment(line)) continue;
    if (getIndentation(line) === 0) {
      return index;
    }
  }

  return lines.length;
}

function removeTopLevelVolumeDefinitions(lines: string[], namesToRemove: Set<string>) {
  if (namesToRemove.size === 0) {
    return;
  }

  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!(getIndentation(line) === 0 && /^volumes:(\s*#.*)?$/.test(trimmed))) {
      index += 1;
      continue;
    }

    const sectionStart = index;
    const sectionEnd = findTopLevelSectionEnd(lines, index + 1);
    const entries: Array<{ name: string; start: number; end: number }> = [];

    let cursor = sectionStart + 1;
    while (cursor < sectionEnd) {
      const entryLine = lines[cursor];
      if (isBlankOrComment(entryLine)) {
        cursor += 1;
        continue;
      }

      const indent = getIndentation(entryLine);
      const entryMatch = entryLine.trim().match(/^([A-Za-z0-9_.-]+):(\s*#.*)?$/);

      if (indent !== 2 || !entryMatch) {
        cursor += 1;
        continue;
      }

      let end = cursor + 1;
      while (end < sectionEnd) {
        const maybeNested = lines[end];
        if (isBlankOrComment(maybeNested)) {
          end += 1;
          continue;
        }

        if (getIndentation(maybeNested) <= 2) {
          break;
        }

        end += 1;
      }

      entries.push({
        name: entryMatch[1],
        start: cursor,
        end,
      });

      cursor = end;
    }

    if (entries.length === 0) {
      index = sectionEnd;
      continue;
    }

    const removable = entries.filter((entry) => namesToRemove.has(entry.name));
    if (removable.length === 0) {
      index = sectionEnd;
      continue;
    }

    if (removable.length === entries.length) {
      lines.splice(sectionStart, sectionEnd - sectionStart);
      continue;
    }

    removable
      .sort((left, right) => right.start - left.start)
      .forEach((entry) => {
        lines.splice(entry.start, entry.end - entry.start);
      });

    index = sectionStart + 1;
  }
}

function collectComposeStorageReferences(composeContent: string, stacksRoot: string): ComposeStorageReferences {
  const lines = composeContent.split(/\r?\n/);
  const pathStack: Array<{ indent: number; key: string }> = [];
  const bindMountDirectories = new Set<string>();
  const namedVolumeSources = new Set<string>();

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const indent = getIndentation(line);
    while (pathStack.length > 0 && indent <= pathStack[pathStack.length - 1].indent) {
      pathStack.pop();
    }

    const keyMatch = trimmed.match(/^([A-Za-z0-9_.-]+):(\s*#.*)?$/);
    if (keyMatch) {
      pathStack.push({
        indent,
        key: keyMatch[1],
      });
      continue;
    }

    const listItem = parseListItem(line);
    if (!listItem) {
      continue;
    }

    const pathKeys = pathStack.map((entry) => entry.key);
    const isServiceVolumeList =
      pathKeys.length === 3 &&
      pathKeys[0] === "services" &&
      pathKeys[2] === "volumes";

    if (!isServiceVolumeList) {
      continue;
    }

    const volumeSpec = parseComposeVolumeSpec(listItem.spec);
    if (volumeSpec) {
      if (path.isAbsolute(volumeSpec.source) && isPathWithinRoot(volumeSpec.source, stacksRoot)) {
        bindMountDirectories.add(volumeSpec.source);
        continue;
      }

      if (isLikelyNamedVolumeSource(volumeSpec.source)) {
        namedVolumeSources.add(volumeSpec.source);
      }
      continue;
    }

    const longForm = parseLongFormVolumeItem(lines, index);
    const source = longForm.fields.source;
    if (!source) {
      index = longForm.end - 1;
      continue;
    }

    if (path.isAbsolute(source) && isPathWithinRoot(source, stacksRoot)) {
      bindMountDirectories.add(source);
      index = longForm.end - 1;
      continue;
    }

    if (isLikelyNamedVolumeSource(source)) {
      namedVolumeSources.add(source);
    }

    index = longForm.end - 1;
  }

  return {
    bindMountDirectories,
    namedVolumeSources,
  };
}

export function normalizeComposeStorageBindings(
  composeContent: string,
  stacksRoot: string,
  appDataRoot: string,
  options?: {
    appId?: string;
    strategy?: ComposeStorageMappingStrategy;
  },
) {
  const strategy = options?.strategy ?? "legacy_named_source";
  const appId = options?.appId ?? "";

  const lines = composeContent.split(/\r?\n/);
  const pathStack: Array<{ indent: number; key: string }> = [];
  const bindMountDirectories = new Set<string>();
  const convertedNamedVolumes = new Set<string>();

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const indent = getIndentation(line);
    while (pathStack.length > 0 && indent <= pathStack[pathStack.length - 1].indent) {
      pathStack.pop();
    }

    const keyMatch = trimmed.match(/^([A-Za-z0-9_.-]+):(\s*#.*)?$/);
    if (keyMatch) {
      pathStack.push({
        indent,
        key: keyMatch[1],
      });
      continue;
    }

    const listItem = parseListItem(line);
    if (!listItem) {
      continue;
    }

    const pathKeys = pathStack.map((entry) => entry.key);
    const isServiceVolumeList =
      pathKeys.length === 3 &&
      pathKeys[0] === "services" &&
      pathKeys[2] === "volumes";

    if (!isServiceVolumeList) {
      continue;
    }

    const volumeSpec = parseComposeVolumeSpec(listItem.spec);
    if (volumeSpec) {
      let bindSource: string | null = null;

      if (isLikelyNamedVolumeSource(volumeSpec.source)) {
        bindSource = resolveNamedVolumeBindSource({
          appDataRoot,
          appId,
          source: volumeSpec.source,
          target: volumeSpec.target,
          strategy,
        });
        convertedNamedVolumes.add(volumeSpec.source);
      } else if (shouldRewriteAppDataBindSource({
        appDataRoot,
        appId,
        source: volumeSpec.source,
        target: volumeSpec.target,
        strategy,
      })) {
        bindSource = resolveAppScopedBindSource(appDataRoot, appId, volumeSpec.target);
      }

      if (!bindSource) {
        continue;
      }

      const rewrittenSpec = volumeSpec.mode
        ? `${bindSource}:${volumeSpec.target}:${volumeSpec.mode}`
        : `${bindSource}:${volumeSpec.target}`;
      const quotedSpec = listItem.quote ? `${listItem.quote}${rewrittenSpec}${listItem.quote}` : rewrittenSpec;

      lines[index] = `${listItem.prefix}${quotedSpec}${listItem.comment}`;
      bindMountDirectories.add(bindSource);
      continue;
    }

    const longForm = parseLongFormVolumeItem(lines, index);
    const source = longForm.fields.source;
    const target = longForm.fields.target;
    if (!source || !target) {
      index = longForm.end - 1;
      continue;
    }

    let bindSource: string | null = null;
    let convertedNamedVolume = false;

    if (isLikelyNamedVolumeSource(source)) {
      bindSource = resolveNamedVolumeBindSource({
        appDataRoot,
        appId,
        source,
        target,
        strategy,
      });
      convertedNamedVolume = true;
      convertedNamedVolumes.add(source);
    } else if (shouldRewriteAppDataBindSource({
      appDataRoot,
      appId,
      source,
      target,
      strategy,
    })) {
      bindSource = resolveAppScopedBindSource(appDataRoot, appId, target);
    }

    let itemEnd = longForm.end;
    if (bindSource) {
      const sourceLineIndex = longForm.fieldLines.source;
      if (typeof sourceLineIndex === "number") {
        lines[sourceLineIndex] = rewriteKeyValueLine(lines[sourceLineIndex], "source", bindSource);
      }

      const typeLineIndex = longForm.fieldLines.type;
      if (typeof typeLineIndex === "number") {
        lines[typeLineIndex] = rewriteKeyValueLine(lines[typeLineIndex], "type", "bind");
      } else if (convertedNamedVolume && typeof sourceLineIndex === "number") {
        const indent = " ".repeat(getIndentation(lines[sourceLineIndex]));
        lines.splice(sourceLineIndex, 0, `${indent}type: bind`);
        itemEnd += 1;
      }

      bindMountDirectories.add(bindSource);
    }

    index = itemEnd - 1;
  }

  removeTopLevelVolumeDefinitions(lines, convertedNamedVolumes);

  return {
    composeContent: lines.join("\n"),
    bindMountDirectories,
    convertedNamedVolumes,
  };
}

export async function materializeInlineStackFiles(input: {
  appId: string;
  stackName: string;
  composeContent: string;
  env: Record<string, string>;
  webUiPort: number | null;
  storageMappingStrategy?: ComposeStorageMappingStrategy;
}) {
  let composeContent = input.composeContent;
  if (input.webUiPort !== null) {
    composeContent = applyWebUiPortOverride(composeContent, input.webUiPort);
  }

  await ensureDataRootDirectories();
  const stacksRoot = resolveStoreStacksRoot();
  const appDataRoot = resolveStoreAppDataRoot();
  const normalized = normalizeComposeStorageBindings(composeContent, stacksRoot, appDataRoot, {
    appId: input.appId,
    strategy: input.storageMappingStrategy,
  });

  const stackDir = path.join(stacksRoot, input.appId);
  const composePath = path.join(stackDir, "docker-compose.yml");
  const envPath = path.join(stackDir, ".env");

  await mkdir(stackDir, { recursive: true });
  await Promise.all(
    Array.from(normalized.bindMountDirectories).map((directoryPath) =>
      mkdir(directoryPath, { recursive: true }),
    ),
  );
  await writeFile(composePath, normalized.composeContent, "utf8");
  await writeFile(envPath, serializeEnvFile(input.env), "utf8");

  return {
    stackDir,
    composePath,
    envPath,
    stackName: input.stackName,
    webUiPort: input.webUiPort,
  } satisfies MaterializedStack;
}

async function runComposeCommand(input: ComposeCommandInput) {
  return withServerTiming(
    {
      layer: "system",
      action: "store.compose.exec",
      meta: {
        stackName: input.stackName,
        args: input.args,
      },
    },
    async () => {
      const args = [
        "compose",
        "-f",
        input.composePath,
        "--env-file",
        input.envPath,
        "-p",
        input.stackName,
        ...input.args,
      ];

      const { stdout } = await execFileAsync("docker", args, {
        cwd: path.dirname(input.composePath),
      });

      return stdout;
    },
  );
}

export async function extractComposeImages(input: {
  composePath: string;
  envPath: string;
  stackName: string;
}) {
  const stdout = await runComposeCommand({
    ...input,
    args: ["config", "--images"],
  });

  return Array.from(
    new Set(
      stdout
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0),
    ),
  );
}

export async function runComposeUp(input: {
  composePath: string;
  envPath: string;
  stackName: string;
}) {
  await runComposeCommand({
    ...input,
    args: ["up", "-d"],
  });
}

export async function runComposeDown(input: {
  composePath: string;
  envPath: string;
  stackName: string;
  removeVolumes?: boolean;
}) {
  const args = ["down"];
  if (input.removeVolumes) {
    args.push("-v");
  }

  await runComposeCommand({
    ...input,
    args,
  });
}

export async function runComposeStart(input: {
  composePath: string;
  envPath: string;
  stackName: string;
}) {
  await runComposeCommand({
    ...input,
    args: ["start"],
  });
}

export async function runComposeStop(input: {
  composePath: string;
  envPath: string;
  stackName: string;
}) {
  await runComposeCommand({
    ...input,
    args: ["stop"],
  });
}

export async function runComposeRestart(input: {
  composePath: string;
  envPath: string;
  stackName: string;
}) {
  await runComposeCommand({
    ...input,
    args: ["restart"],
  });
}

export async function getComposeStatus(input: {
  composePath: string;
  envPath: string;
  stackName: string;
}): Promise<"running" | "paused" | "stopped" | "unknown"> {
  const info = await getComposeRuntimeInfo(input);
  return info.status;
}

type ComposePsEntry = {
  State?: string;
  Name?: string;
};

function parseComposePsOutput(stdout: string) {
  const trimmed = stdout.trim();
  if (!trimmed) return [] as ComposePsEntry[];

  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.filter((entry): entry is ComposePsEntry => {
          return Boolean(entry && typeof entry === "object");
        });
      }
    } catch {
      // fallback to line-delimited parser
    }
  }

  return trimmed
    .split("\n")
    .map((line) => {
      try {
        return JSON.parse(line) as ComposePsEntry;
      } catch {
        return null;
      }
    })
    .filter((entry): entry is ComposePsEntry => entry !== null);
}

export async function getComposeRuntimeInfo(input: {
  composePath: string;
  envPath: string;
  stackName: string;
}): Promise<{
  status: "running" | "paused" | "stopped" | "unknown";
  containerNames: string[];
  primaryContainerName: string | null;
}> {
  try {
    const stdout = await runComposeCommand({
      ...input,
      args: ["ps", "--format", "json"],
    });

    if (!stdout.trim()) {
      return {
        status: "stopped",
        containerNames: [],
        primaryContainerName: null,
      };
    }

    const containers = parseComposePsOutput(stdout);

    if (containers.length === 0) {
      return {
        status: "stopped",
        containerNames: [],
        primaryContainerName: null,
      };
    }

    const normalizedStates = containers.map((container) =>
      (container.State ?? "").trim().toLowerCase(),
    );
    const allRunning = normalizedStates.every((state) => state === "running");
    const anyRunning = containers.some((c) => c.State === "running");
    const anyPaused = normalizedStates.some((state) => state === "paused");
    const containerNames = containers
      .map((c) => c.Name?.trim() ?? "")
      .filter((name) => name.length > 0);
    const primaryRunning = containers.find((c) => c.State === "running" && c.Name);
    const primaryPaused = containers.find((c) => c.State === "paused" && c.Name);
    const primaryContainerName =
      primaryRunning?.Name?.trim() ??
      primaryPaused?.Name?.trim() ??
      containerNames[0] ??
      null;

    const status = allRunning || anyRunning ? "running" : anyPaused ? "paused" : "stopped";

    return {
      status,
      containerNames,
      primaryContainerName,
    };
  } catch {
    return {
      status: "unknown",
      containerNames: [],
      primaryContainerName: null,
    };
  }
}

export async function cleanupComposeDataOnUninstall(input: {
  composePath: string;
}) {
  await withServerTiming(
    {
      layer: "system",
      action: "store.compose.cleanup",
      meta: {
        composePath: input.composePath,
      },
    },
    async () => {
      let composeContent: string;
      try {
        composeContent = await readFile(input.composePath, "utf8");
      } catch (error) {
        const errorWithCode = error as NodeJS.ErrnoException;
        if (errorWithCode.code === "ENOENT") {
          return;
        }
        throw error;
      }
      const stacksRoot = resolveStoreStacksRoot();
      const stackDir = path.dirname(input.composePath);
      const storage = collectComposeStorageReferences(composeContent, stacksRoot);

      await Promise.all(
        Array.from(storage.bindMountDirectories).map((directoryPath) =>
          rm(directoryPath, {
            recursive: true,
            force: true,
          }),
        ),
      );

      for (const volumeName of storage.namedVolumeSources) {
        try {
          await execFileAsync("docker", ["volume", "rm", volumeName]);
        } catch {
          // Best effort cleanup for legacy named volumes.
        }
      }

      const normalizedStackDir = path.resolve(stackDir);
      const normalizedStacksRoot = path.resolve(stacksRoot);
      const shouldRemoveStackDir =
        normalizedStackDir !== normalizedStacksRoot &&
        isPathWithinRoot(normalizedStackDir, normalizedStacksRoot);

      if (shouldRemoveStackDir) {
        await rm(normalizedStackDir, {
          recursive: true,
          force: true,
        });
      }
    },
  );
}
