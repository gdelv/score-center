export function DateSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-1 pt-6 text-sm font-medium text-ink-dim first:pt-0">{label}</h2>
      <div>{children}</div>
    </section>
  );
}
