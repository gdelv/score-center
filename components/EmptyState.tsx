export function EmptyState({
  message,
  actionLabel,
  onAction,
}: {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <p className="text-[15px] text-ink-dim">{message}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="min-h-11 rounded-sm bg-amber px-5 text-[15px] font-semibold text-amber-ink"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
