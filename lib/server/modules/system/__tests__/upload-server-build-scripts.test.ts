import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();

async function readScript(scriptName: string) {
  return readFile(path.join(repoRoot, "scripts", scriptName), "utf8");
}

describe("upload server build scripts", () => {
  it.each(["install.sh", "update.sh"])(
    "%s passes an explicit Go build cache environment",
    async (scriptName) => {
      const script = await readScript(scriptName);

      expect(script).toContain('export HOME="${HOME:-/root}"');
      expect(script).toContain('export GOCACHE="${GOCACHE:-${HOME}/.cache/go-build}"');
      expect(script).toContain('export GOPATH="${GOPATH:-${HOME}/go}"');
      expect(script).toContain('mkdir -p "${GOCACHE}" "${GOPATH}"');
      expect(script).toContain('env HOME="${HOME}" GOCACHE="${GOCACHE}" GOPATH="${GOPATH}" go build');
    },
  );
});
