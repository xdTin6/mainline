import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Bell, Check } from "lucide-react";
import { Shell } from "@/components/shell";
import { SignInPanel } from "@/components/sign-in-panel";
import { Button } from "@/components/ui";
import { SignInGate } from "@/lib/auth/gates";
import {
  listNotifications,
  markNotificationsRead,
} from "@/lib/mainline/community";
import type { CommunityNotification } from "@/lib/mainline/types";
import { formatDay } from "@/lib/mainline/text";

export const Route = createFileRoute("/notifications")({ component: NotificationsPage });

function NotificationsPage() {
  return (
    <Shell>
      <SignInGate fallback={<SignInPanel title="Sign in to see your notifications" />}>
        <Inbox />
      </SignInGate>
    </Shell>
  );
}

function Inbox() {
  const [items, setItems] = useState<CommunityNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    listNotifications()
      .then((result) => {
        if (!cancelled) setItems(result);
      })
      .catch((cause) => {
        console.error("[notifications] Could not load notifications.", cause);
        if (!cancelled) setError("Notifications could not be loaded. Try again.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function markAllRead() {
    setError("");
    try {
      await markNotificationsRead({ data: "" });
      setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt || new Date().toISOString() })));
      window.dispatchEvent(new Event("mainline-notifications-updated"));
    } catch (cause) {
      console.error("[notifications] Could not mark notifications read.", cause);
      setError("Notifications could not be marked as read.");
    }
  }

  async function markOneRead(id: string) {
    try {
      await markNotificationsRead({ data: id });
      setItems((current) => current.map((item) => item.id === id ? { ...item, readAt: item.readAt || new Date().toISOString() } : item));
      window.dispatchEvent(new Event("mainline-notifications-updated"));
    } catch (cause) {
      console.error("[notifications] Could not mark notification read.", cause);
      setError("This notification could not be marked as read.");
    }
  }

  const unreadCount = items.filter((item) => !item.readAt).length;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-wider text-subtle">Your activity</p>
          <h1 className="mt-2 font-display text-4xl tracking-tight sm:text-5xl">Notifications</h1>
          <p className="mt-3 text-muted">{unreadCount ? `${unreadCount} unread` : "You are all caught up."}</p>
        </div>
        {unreadCount ? (
          <Button variant="ghost" onClick={() => void markAllRead()}>
            <Check className="size-4" />
            Mark all read
          </Button>
        ) : null}
      </div>
      {error ? <p role="alert" className="mt-5 text-sm text-danger">{error}</p> : null}
      {loading ? <div className="mt-8 h-32 animate-pulse rounded-lg bg-elevated" /> : null}
      {!loading && items.length === 0 ? (
        <div className="mt-8 rounded-lg border border-line bg-surface p-6">
          <Bell className="size-5 text-muted" />
          <h2 className="mt-3 font-display text-2xl">Nothing new yet</h2>
          <p className="mt-2 text-sm text-muted">Follows, project activity, and collaboration replies will appear here.</p>
        </div>
      ) : null}
      <ul className="mt-7 divide-y divide-line border-y border-line">
        {items.map((item) => {
          const message = notificationText(item);
          return (
            <li key={item.id}>
              <NotificationTarget item={item} onClick={() => {
                if (!item.readAt) void markOneRead(item.id);
              }}>
                <span className={`mt-1 size-2 shrink-0 rounded-full ${item.readAt ? "bg-line-strong" : "bg-fg"}`} aria-label={item.readAt ? "Read" : "Unread"} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-fg">{message}</span>
                  {item.projectTitle ? <span className="mt-1 block text-sm text-muted">{item.projectTitle}</span> : null}
                  <span className="mt-2 block text-xs text-subtle">{formatDay(item.createdAt)}</span>
                </span>
              </NotificationTarget>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function NotificationTarget({
  item,
  onClick,
  children,
}: {
  item: CommunityNotification;
  onClick: () => void;
  children: ReactNode;
}) {
  const className = "flex min-h-20 items-start gap-4 py-5";
  if (item.collabPostId) return <Link to="/collaborate" onClick={onClick} className={className}>{children}</Link>;
  if (item.projectId) return <Link to="/project/$id" params={{ id: item.projectId }} onClick={onClick} className={className}>{children}</Link>;
  if (item.actorHandle) return <Link to="/u/$handle" params={{ handle: item.actorHandle }} onClick={onClick} className={className}>{children}</Link>;
  return <Link to="/notifications" onClick={onClick} className={className}>{children}</Link>;
}

function notificationText(item: CommunityNotification) {
  const actor = item.actorName || "A maker";
  switch (item.kind) {
    case "follow": return `${actor} followed your bench.`;
    case "star": return `${actor} starred your project.`;
    case "note": return `${actor} left a note on your project.`;
    case "reply": return `${actor} replied to your discussion.`;
    case "update": return `${actor} shared a build update.`;
    case "project": return `${actor} published a new project.`;
    case "collab_interest": return `${actor} is interested in collaborating.`;
    default: return `${actor} shared an update.`;
  }
}
