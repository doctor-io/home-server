export type TerminalOutputLine = {
  type: "output" | "error" | "info";
  content: string;
};

export type TerminalExecuteRequest = {
  command: string;
  cwd?: string;
  history?: string[];
};

export type TerminalExecuteResult = {
  cwd: string;
  lines: TerminalOutputLine[];
  exitCode: number | null;
  durationMs: number;
};

export type TerminalServiceErrorCode =
  | "invalid_request"
  | "forbidden_command"
  | "command_not_found"
  | "execution_failed"
  | "timeout";
