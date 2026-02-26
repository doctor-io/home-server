"use client";

import { useState } from "react";

type CustomAppInstallDialogInput = {
  name: string;
  iconUrl?: string;
  webUiPort?: number;
  repositoryUrl?: string;
  sourceType: "docker-compose" | "docker-run";
  source: string;
};

type CustomInstallFormProps = {
  isSubmitting: boolean;
  error: string | null;
  onCancel: () => void;
  onSubmit: (input: CustomAppInstallDialogInput) => Promise<void>;
};

const defaultSourceByType: Record<CustomAppInstallDialogInput["sourceType"], string> = {
  "docker-compose": `services:
  app:
    image: nginx:latest
    ports:
      - "8080:80"`,
  "docker-run": "docker run --name myapp -p 8080:80 nginx:latest",
};

export function CustomInstallForm({
  isSubmitting,
  error,
  onCancel,
  onSubmit,
}: CustomInstallFormProps) {
  const [name, setName] = useState("");
  const [iconUrl, setIconUrl] = useState("");
  const [webUiPort, setWebUiPort] = useState("");
  const [repositoryUrl, setRepositoryUrl] = useState("");
  const [sourceType, setSourceType] = useState<CustomAppInstallDialogInput["sourceType"]>("docker-compose");
  const [source, setSource] = useState(defaultSourceByType["docker-compose"]);

  const parsedWebUiPort =
    webUiPort.trim().length > 0 ? Number.parseInt(webUiPort.trim(), 10) : undefined;
  const isWebUiPortValid =
    parsedWebUiPort === undefined ||
    (Number.isInteger(parsedWebUiPort) && parsedWebUiPort >= 1024 && parsedWebUiPort <= 65535);

  function resetForm() {
    setName("");
    setIconUrl("");
    setWebUiPort("");
    setRepositoryUrl("");
    setSourceType("docker-compose");
    setSource(defaultSourceByType["docker-compose"]);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await onSubmit({
        name,
        iconUrl: iconUrl.trim() || undefined,
        webUiPort: parsedWebUiPort,
        repositoryUrl: repositoryUrl.trim() || undefined,
        sourceType,
        source,
      });
      resetForm();
    } catch {
      // Keep user input to allow quick correction and retry.
    }
  }

  const isValid = name.trim().length > 0 && source.trim().length > 0 && isWebUiPortValid;

  return (
    <div className="flex flex-col h-full overflow-y-auto p-5">
      <p className="text-xs text-muted-foreground mb-4">
        Add an app using docker compose or docker run, then install it through the same store operation pipeline.
      </p>

      <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            App Name
            <input
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="My App"
              className="px-3 py-2 text-sm bg-glass border border-glass-border rounded-md text-foreground outline-none focus:border-primary/50"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Source Type
            <select
              value={sourceType}
              onChange={(event) => {
                const nextType = event.target.value as CustomAppInstallDialogInput["sourceType"];
                setSourceType(nextType);
                setSource(defaultSourceByType[nextType]);
              }}
              className="px-3 py-2 text-sm bg-glass border border-glass-border rounded-md text-foreground outline-none focus:border-primary/50"
            >
              <option value="docker-compose">Docker Compose</option>
              <option value="docker-run">Docker Run</option>
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Icon URL
            <input
              value={iconUrl}
              onChange={(event) => setIconUrl(event.target.value)}
              placeholder="https://..."
              className="px-3 py-2 text-sm bg-glass border border-glass-border rounded-md text-foreground outline-none focus:border-primary/50"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Web UI Port
            <input
              type="number"
              inputMode="numeric"
              min={1024}
              max={65535}
              value={webUiPort}
              onChange={(event) => setWebUiPort(event.target.value.replace(/\D+/g, ""))}
              placeholder="8080"
              className="px-3 py-2 text-sm bg-glass border border-glass-border rounded-md text-foreground outline-none focus:border-primary/50"
            />
            {!isWebUiPortValid ? (
              <span className="text-[11px] text-status-red">Port must be between 1024 and 65535.</span>
            ) : null}
          </label>

          <label className="flex flex-col gap-1 text-xs text-muted-foreground md:col-span-2">
            Repository URL (optional)
            <input
              value={repositoryUrl}
              onChange={(event) => setRepositoryUrl(event.target.value)}
              placeholder="https://github.com/owner/repo"
              className="px-3 py-2 text-sm bg-glass border border-glass-border rounded-md text-foreground outline-none focus:border-primary/50"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {sourceType === "docker-compose" ? "Docker Compose" : "Docker Run"}
          <textarea
            required
            rows={10}
            value={source}
            onChange={(event) => setSource(event.target.value)}
            className="px-3 py-2 text-xs font-mono bg-glass border border-glass-border rounded-md text-foreground outline-none focus:border-primary/50 resize-y"
          />
        </label>

        {error ? <p className="text-xs text-status-red">{error}</p> : null}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-xs font-medium rounded-md border border-glass-border text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !isValid}
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:brightness-110 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Installing..." : "Install Custom App"}
          </button>
        </div>
      </form>
    </div>
  );
}

export type { CustomAppInstallDialogInput };
