export const infoItem = (label, value) => value ? (
  <div className="flex flex-col gap-0.5">
    <span className="text-[var(--text-muted)] text-xs uppercase tracking-wider">{label}</span>
    <span className="text-[var(--text-primary)] text-sm">{value}</span>
  </div>
) : null
