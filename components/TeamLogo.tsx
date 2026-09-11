import Image from "next/image";

export function TeamLogo({
  src,
  alt,
  size = 28,
}: {
  src: string | null;
  alt: string;
  size?: number;
}) {
  if (!src) {
    return (
      <span
        className="inline-flex shrink-0 items-center justify-center rounded-full bg-surface-raised text-[11px] font-semibold text-ink-dim"
        style={{ width: size, height: size }}
        aria-hidden
      >
        {alt.slice(0, 1)}
      </span>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={size}
      height={size}
      className="shrink-0 object-contain"
      unoptimized
    />
  );
}
