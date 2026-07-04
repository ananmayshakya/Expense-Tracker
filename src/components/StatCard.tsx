/**
 * Gradient stat card (PLAN.md §16) — identical gradient in both light and
 * dark mode (the gradient itself is the "surface", so it doesn't need a
 * `dark:` variant). 12px radius per the rounding spec.
 */
export default function StatCard({
  label,
  value,
  subtext,
  gradient,
}: {
  label: string;
  value: string;
  subtext?: string;
  gradient: string;
}) {
  return (
    <div
      className="flex flex-col gap-2 rounded-[12px] p-5 text-white shadow-sm"
      style={{ background: gradient }}
    >
      <span className="text-sm font-medium text-white/80">{label}</span>
      <span className="text-2xl font-semibold">{value}</span>
      {subtext && <span className="text-xs text-white/75">{subtext}</span>}
    </div>
  );
}
