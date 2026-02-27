"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import { useTerminalCommand } from "@/hooks/useTerminalCommand";
import type { TerminalOutputLine } from "@/lib/shared/contracts/terminal";

type TermLine = {
  type: "input" | "output" | "error" | "info" | "welcome";
  content: string;
  prompt?: string;
};

type TerminalCommandRequest = {
  id: number;
  command: string;
} | null;

const HOSTNAME = "home-server";
const USER = "homeio";

function toPromptPath(cwd: string) {
  if (!cwd.startsWith("/home/")) return cwd;
  const segments = cwd.split("/");
  if (segments.length < 3) return cwd;
  const homePrefix = `/home/${segments[2]}`;
  if (cwd === homePrefix) return "~";
  if (cwd.startsWith(`${homePrefix}/`)) {
    return `~${cwd.slice(homePrefix.length)}`;
  }
  return cwd;
}

function getPrompt(cwd: string) {
  return `${USER}@${HOSTNAME}:${toPromptPath(cwd)}$`;
}

function mapOutputLine(line: TerminalOutputLine): TermLine {
  return {
    type: line.type,
    content: line.content,
  };
}

export function Terminal({
  commandRequest = null,
}: {
  commandRequest?: TerminalCommandRequest;
}) {
  const [lines, setLines] = useState<TermLine[]>([
    {
      type: "welcome",
      content: `Welcome to Home Server Terminal
Commands are executed on the backend in non-interactive mode.

Type 'help' for available commands.
`,
    },
  ]);
  const [currentInput, setCurrentInput] = useState("");
  const [cwd, setCwd] = useState("~");
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [tabCount, setTabCount] = useState(1);
  const [activeTab, setActiveTab] = useState(0);
  const lastCommandRequestIdRef = useRef<number | null>(null);
  const executionQueueRef = useRef(Promise.resolve());

  const { executeCommand, isExecuting } = useTerminalCommand();

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [lines]);

  useEffect(() => {
    if (!isExecuting) {
      inputRef.current?.focus();
    }
  }, [isExecuting]);

  const focusInput = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  const runCommand = useCallback(
    async (inputValue: string) => {
      const input = inputValue.trim();
      if (!input) return;

      if (input === "clear") {
        setLines([]);
        setCommandHistory((previous) => [...previous, input]);
        setHistoryIndex(-1);
        return;
      }

      const history = [...commandHistory, input];
      const inputLine: TermLine = {
        type: "input",
        content: input,
        prompt: getPrompt(cwd),
      };

      setLines((previous) => [...previous, inputLine]);
      setCommandHistory(history);
      setHistoryIndex(-1);

      try {
        const result = await executeCommand({
          command: input,
          cwd,
          history,
        });

        setCwd(result.cwd);

        if (result.lines.some((line) => line.content === "__CLEAR__")) {
          setLines([]);
          return;
        }

        const outputLines = result.lines.map(mapOutputLine);
        if (outputLines.length > 0) {
          setLines((previous) => [...previous, ...outputLines]);
        }
      } catch (error) {
        setLines((previous) => [
          ...previous,
          {
            type: "error",
            content:
              error instanceof Error
                ? error.message
                : "Failed to execute command",
          },
        ]);
      }
    },
    [commandHistory, cwd, executeCommand],
  );

  const enqueueCommand = useCallback(
    (value: string) => {
      executionQueueRef.current = executionQueueRef.current
        .then(() => runCommand(value))
        .catch(() => undefined);
    },
    [runCommand],
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    enqueueCommand(currentInput);
    setCurrentInput("");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (commandHistory.length === 0) return;
      const next =
        historyIndex === -1
          ? commandHistory.length - 1
          : Math.max(0, historyIndex - 1);
      setHistoryIndex(next);
      setCurrentInput(commandHistory[next]);
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex === -1) return;
      const next = historyIndex + 1;
      if (next >= commandHistory.length) {
        setHistoryIndex(-1);
        setCurrentInput("");
        return;
      }
      setHistoryIndex(next);
      setCurrentInput(commandHistory[next]);
      return;
    }

    if (e.key === "Tab") {
      e.preventDefault();
      const commands = [
        "help",
        "ls",
        "cd",
        "pwd",
        "cat",
        "echo",
        "whoami",
        "hostname",
        "uname",
        "uptime",
        "df",
        "free",
        "docker",
        "ping",
        "ip",
        "date",
        "history",
        "clear",
      ];
      const matches = commands.filter((command) => command.startsWith(currentInput));
      if (matches.length === 1) {
        setCurrentInput(`${matches[0]} `);
      }
      return;
    }

    if (e.key === "l" && e.ctrlKey) {
      e.preventDefault();
      setLines([]);
    }
  }

  useEffect(() => {
    if (!commandRequest) return;
    if (lastCommandRequestIdRef.current === commandRequest.id) return;

    lastCommandRequestIdRef.current = commandRequest.id;
    enqueueCommand(commandRequest.command);
    setCurrentInput("");
  }, [commandRequest, enqueueCommand]);

  return (
    <div className="flex h-full flex-col bg-card/90 select-text">
      <div className="flex shrink-0 items-center gap-0 border-b border-glass-border bg-popover/70">
        {Array.from({ length: tabCount }).map((_, index) => (
          <button
            key={index}
            onClick={() => setActiveTab(index)}
            className={`flex cursor-pointer items-center gap-2 border-r border-glass-border px-4 py-2 text-xs transition-colors ${
              activeTab === index
                ? "bg-card/75 text-foreground"
                : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
            }`}
          >
            <ChevronRight className="size-3" />
            <span className="font-mono">
              {USER}@{HOSTNAME}
            </span>
          </button>
        ))}
        <button
          onClick={() => {
            setTabCount((count) => count + 1);
            setActiveTab(tabCount);
          }}
          className="px-3 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
          aria-label="New tab"
        >
          +
        </button>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 font-mono text-sm leading-5 cursor-text"
        onClick={focusInput}
      >
        {lines.map((line, index) => (
          <div key={index} className="whitespace-pre-wrap break-all">
            {line.type === "welcome" && (
              <span className="text-primary/80">{line.content}</span>
            )}
            {line.type === "input" && (
              <div>
                <span className="text-status-green">{line.prompt}</span>{" "}
                <span className="text-foreground">{line.content}</span>
              </div>
            )}
            {line.type === "output" && (
              <span className="text-foreground/90">{line.content}</span>
            )}
            {line.type === "error" && (
              <span className="text-status-red">{line.content}</span>
            )}
            {line.type === "info" && (
              <span className="text-primary/70">{line.content}</span>
            )}
          </div>
        ))}

        <form onSubmit={handleSubmit} className="flex items-center">
          <span className="text-status-green shrink-0">{getPrompt(cwd)}</span>
          <span>&nbsp;</span>
          <input
            ref={inputRef}
            type="text"
            value={currentInput}
            onChange={(event) => setCurrentInput(event.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-foreground outline-none font-mono text-sm caret-primary"
            autoFocus
            spellCheck={false}
            autoComplete="off"
            autoCapitalize="off"
          />
        </form>
      </div>

      <div className="flex shrink-0 items-center justify-between border-t border-glass-border bg-popover/70 px-4 py-1.5 font-mono text-xs text-muted-foreground">
        <span>{isExecuting ? "running..." : "ready"}</span>
        <span>{toPromptPath(cwd)}</span>
        <span>{commandHistory.length} commands</span>
      </div>
    </div>
  );
}
