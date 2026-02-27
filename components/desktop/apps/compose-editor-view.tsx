type ComposeEditorViewProps = {
  composeDraft: string;
  onChange: (next: string) => void;
  parseError: string | null;
};

export function ComposeEditorView({ composeDraft, onChange, parseError }: ComposeEditorViewProps) {
  return (
    <section className="flex-1 overflow-hidden px-6 py-5">
      <div className="mb-3 rounded-lg border border-glass-border bg-secondary/25 px-3 py-2 text-xs text-muted-foreground">
        Docker Compose is the source of truth. Classic fields are derived from this draft.
      </div>

      {parseError ? (
        <div className="mb-3 rounded-lg border border-status-red/40 bg-status-red/10 px-3 py-2 text-xs text-status-red">
          Unable to parse compose: {parseError}
        </div>
      ) : null}

      <textarea
        aria-label="Docker Compose"
        value={composeDraft}
        onChange={(event) => onChange(event.target.value)}
        className="h-[calc(100%-2.5rem)] w-full resize-none rounded-lg border border-glass-border bg-secondary/20 p-3 font-mono text-xs leading-5 text-foreground outline-none focus:border-primary/50"
      />
    </section>
  );
}
