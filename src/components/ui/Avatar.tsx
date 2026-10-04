import { cn } from "@/lib/utils";
import { getInitials } from "@/lib/utils";

const SIZES = {
  xs: "h-7 w-7 text-[10px]",
  sm: "h-9 w-9 text-xs",
  md: "h-11 w-11 text-sm",
  lg: "h-14 w-14 text-base",
  xl: "h-[4.25rem] w-[4.25rem] text-xl",
};

/** Deterministic tint so the same person keeps the same colour. */
const TINTS = [
  "linear-gradient(140deg,#D7C4A8,#8A7355)",
  "linear-gradient(140deg,#B0D6C9,#3E6559)",
  "linear-gradient(140deg,#C7DBE4,#4C6672)",
  "linear-gradient(140deg,#D6BDB8,#73564F)",
  "linear-gradient(140deg,#E3CBA0,#9A7B3E)",
  "linear-gradient(140deg,#C0DCEA,#3E6B85)",
];

function tintFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return TINTS[h % TINTS.length];
}

export default function Avatar({
  name,
  src,
  size = "md",
  square = false,
  className,
}: {
  name: string;
  src?: string | null;
  size?: keyof typeof SIZES;
  square?: boolean;
  className?: string;
}) {
  const shape = square ? "rounded-[var(--radius-md)]" : "rounded-full";

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        className={cn(shape, SIZES[size], "object-cover shrink-0", className)}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        shape,
        SIZES[size],
        "shrink-0 inline-flex items-center justify-center font-bold text-white",
        className,
      )}
      style={{ background: tintFor(name) }}
    >
      {getInitials(name)}
    </span>
  );
}
