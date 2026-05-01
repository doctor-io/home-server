declare module "@lydell/node-pty" {
  namespace pty {
    export type IPty = {
      onData(callback: (data: string) => void): void;
      onExit(callback: (exitCode: { exitCode: number; signal?: number }) => void): void;
      write(data: string): void;
      resize(cols: number, rows: number): void;
      kill(): void;
    };

    export type IPtyForkOptions = {
      name?: string;
      cols?: number;
      rows?: number;
      cwd?: string;
      env?: Record<string, string>;
    };
  }

  export type IPty = pty.IPty;
  export type IPtyForkOptions = pty.IPtyForkOptions;

  const pty: {
    spawn(
      file: string,
      args: string[],
      options?: pty.IPtyForkOptions,
    ): pty.IPty;
  };

  export default pty;
}
