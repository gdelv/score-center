export function DateSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section className="pt-10 first:pt-0">
      <h2 className="mb-4 border-b border-border pb-2 font-display text-xl font-bold text-ink">
        {label}
      </h2>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-x-6 xl:grid-cols-3">
        {children}
      </div>
    </section>
  );
}
