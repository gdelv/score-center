export function LiveBadge({ detail }: { detail: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-turf">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-turf opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-turf" />
      </span>
      LIVE · {detail}
    </span>
  );
}
