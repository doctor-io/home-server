type ProgressBarProps = {
  value: number;
  colorClassName: string;
};

export function ProgressBar({ value, colorClassName }: ProgressBarProps) {
  return (
    <div className="w-full h-1.5 rounded-[var(--radius)] bg-secondary/60 overflow-hidden">
      <div
        className={`h-full rounded-[var(--radius)] transition-all duration-700 ease-out ${colorClassName}`}
        style={{ width: `${value}%` }}
      />
    </div>
  );
}
