/** Il segno del pannello: la V bianca sul rosso dell'app. */
export function BrandMark({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden
      className="shrink-0 drop-shadow-[0_8px_16px_rgba(197,22,29,0.35)]"
    >
      <rect width="64" height="64" rx="16" fill="#C5161D" />
      <path
        d="M19 20l13 26 13-26"
        fill="none"
        stroke="#fff"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
