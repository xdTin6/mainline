import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Star } from "lucide-react";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { toggleStar } from "@/lib/mainline/api";
import { cn } from "@/lib/cn";

export function StarButton({
  projectId,
  count,
  starred,
  onChange,
}: {
  projectId: string;
  count: number;
  starred: boolean;
  onChange?: (next: { starred: boolean; starCount: number }) => void;
}) {
  const navigate = useNavigate();
  const { user, isPending } = useCurrentUserState();
  const [busy, setBusy] = useState(false);
  const [local, setLocal] = useState<{ starred: boolean; count: number } | null>(null);
  const shownStarred = local?.starred ?? starred;
  const shownCount = local?.count ?? count;

  async function onClick() {
    if (isPending || busy) return;
    if (!user) {
      await navigate({ to: "/login" });
      return;
    }
    setBusy(true);
    try {
      const result = await toggleStar({ data: projectId });
      if (result.ok) {
        setLocal({ starred: result.starred, count: result.starCount });
        onChange?.({ starred: result.starred, starCount: result.starCount });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void onClick()}
      aria-pressed={shownStarred}
      aria-label={shownStarred ? "Remove star" : "Star project"}
      disabled={busy}
      className={cn(
        "press inline-flex min-h-11 items-center gap-1.5 rounded-sm px-2 text-sm tabular-nums",
        shownStarred ? "text-fg" : "text-muted hover:text-fg",
      )}
    >
      <Star className="size-4" strokeWidth={1.75} fill={shownStarred ? "currentColor" : "none"} />
      <span>{shownCount}</span>
    </button>
  );
}
