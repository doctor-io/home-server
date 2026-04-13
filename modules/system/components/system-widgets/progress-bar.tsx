type ProgressBarProps = {
  value: number;
  colorClassName: string;
};

export function ProgressBar({ value, colorClassName }: ProgressBarProps) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
      <div
        className={`h-full rounded-full transition-all duration-700 ease-out ${colorClassName}`}
        style={{ width: `${value}%` }}
      />
    </div>
  );
}
