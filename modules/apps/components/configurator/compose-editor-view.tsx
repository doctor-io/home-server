type ComposeEditorViewProps = {
  composeDraft: string;
  onChange: (next: string) => void;
  parseError: string | null;
};

export function ComposeEditorView({ composeDraft, onChange, parseError }: ComposeEditorViewProps) {
  return (
    <section className="flex-1 overflow-hidden px-4 py-3">
      <div className="mb-2 rounded-lg border border-glass-border bg-secondary/25 px-2.5 py-1.5 text-[11px] text-muted-foreground">
        Docker Compose is the source of truth. Classic fields are derived from this draft.
      </div>

      {parseError ? (
        <div className="mb-2 rounded-lg border border-status-red/40 bg-status-red/10 px-2.5 py-1.5 text-[11px] text-status-red">
          Unable to parse compose: {parseError}
        </div>
      ) : null}

      <textarea
        aria-label="Docker Compose"
        value={composeDraft}
        onChange={(event) => onChange(event.target.value)}
        className="h-[calc(100%-2rem)] w-full resize-none rounded-lg border border-glass-border bg-secondary/20 p-2.5 font-mono text-xs leading-4 text-foreground outline-none focus:border-primary/50"
      />
    </section>
  );
}
