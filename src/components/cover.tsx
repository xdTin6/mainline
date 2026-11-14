import { cn } from "@/lib/cn";
import { hashString } from "@/lib/mainline/text";

export function Cover({
  id,
  language,
  className,
}: {
  id: string;
  language: string;
  className?: string;
}) {
  const variant = hashString(id) % 4;
  return (
    <div className={cn("relative overflow-hidden bg-elevated text-line-strong", className)}>
      <Plate variant={variant} />
      <span className="absolute bottom-3 left-4 font-mono text-xs text-fg">{language}</span>
    </div>
  );
}

function Plate({ variant }: { variant: number }) {
  const common = "absolute inset-0 h-full w-full";
  if (variant === 1) {
    return (
      <svg className={common} viewBox="0 0 400 160" preserveAspectRatio="none" aria-hidden="true">
        {Array.from({ length: 12 }, (_, index) => (
          <line
            key={index}
            x1={18 + index * 32}
            y1={160}
            x2={18 + index * 32}
            y2={40 + ((index * 37) % 90)}
            stroke="currentColor"
            strokeWidth="1"
          />
        ))}
      </svg>
    );
  }
  if (variant === 2) {
    return (
      <svg className={common} viewBox="0 0 400 160" aria-hidden="true">
        <circle cx="330" cy="20" r="90" fill="none" stroke="currentColor" strokeWidth="1" />
        <circle cx="330" cy="20" r="58" fill="none" stroke="currentColor" strokeWidth="1" />
        <circle cx="330" cy="20" r="26" fill="none" stroke="currentColor" strokeWidth="1" />
      </svg>
    );
  }
  if (variant === 3) {
    return (
      <svg className={common} viewBox="0 0 400 160" preserveAspectRatio="none" aria-hidden="true">
        {Array.from({ length: 8 }, (_, index) => (
          <line
            key={index}
            x1={-40 + index * 60}
            y1="160"
            x2={80 + index * 60}
            y2="0"
            stroke="currentColor"
            strokeWidth="1"
          />
        ))}
      </svg>
    );
  }
  return (
    <svg className={common} viewBox="0 0 400 160" preserveAspectRatio="none" aria-hidden="true">
      {[32, 64, 96, 128].map((y) => (
        <line key={y} x1="0" y1={y} x2="400" y2={y} stroke="currentColor" strokeWidth="1" />
      ))}
    </svg>
  );
}

export function Monogram({ name, className }: { name: string; className?: string }) {
  const letter = name.trim().charAt(0).toUpperCase() || "M";
  return (
    <span
      className={cn(
        "grid h-11 w-11 shrink-0 place-items-center rounded-sm border border-line bg-elevated font-display text-lg text-fg",
        className,
      )}
      aria-hidden="true"
    >
      {letter}
    </span>
  );
}
