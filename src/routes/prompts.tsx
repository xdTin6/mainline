import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowUpRight, Lightbulb, ThumbsUp } from "lucide-react";
import { Shell } from "@/components/shell";
import { SignInPanel } from "@/components/sign-in-panel";
import { Button, Field, TextArea, TextInput } from "@/components/ui";
import { SignInGate } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import {
  getMyPromptVotes,
  getWeeklyPrompt,
  submitPromptEntry,
  togglePromptVote,
} from "@/lib/mainline/community";
import type { PromptEntry } from "@/lib/mainline/types";
import { formatDay } from "@/lib/mainline/text";

export const Route = createFileRoute("/prompts")({
  loader: () => getWeeklyPrompt(),
  component: PromptsPage,
});

function PromptsPage() {
  const initial = Route.useLoaderData();
  const { user } = useCurrentUserState();
  const [entries, setEntries] = useState(initial.entries);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    if (!user || initial.entries.length === 0) return;
    getMyPromptVotes({ data: initial.entries.map((entry) => entry.id) })
      .then((ids) => {
        if (!cancelled) {
          const voted = new Set(ids);
          setEntries((current) => current.map((entry) => ({ ...entry, voted: voted.has(entry.id) })));
        }
      })
      .catch((cause) => {
        console.error("[prompts] Could not load your votes.", cause);
        if (!cancelled) setError("Your vote status could not be loaded.");
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id, initial.entries]);

  async function refreshEntries() {
    try {
      const refreshed = await getWeeklyPrompt();
      if (!user || refreshed.entries.length === 0) {
        setEntries(refreshed.entries);
        return;
      }
      const ids = await getMyPromptVotes({ data: refreshed.entries.map((entry) => entry.id) });
      const voted = new Set(ids);
      setEntries(refreshed.entries.map((entry) => ({ ...entry, voted: voted.has(entry.id) })));
    } catch (cause) {
      console.error("[prompts] Could not refresh submissions.", cause);
      setError("Your submission was saved, but the list could not be refreshed.");
    }
  }

  async function onVote(entry: PromptEntry) {
    setError("");
    try {
      const result = await togglePromptVote({ data: entry.id });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setEntries((current) => current.map((item) =>
        item.id === entry.id ? { ...item, voted: result.voted, voteCount: result.voteCount } : item,
      ));
    } catch (cause) {
      console.error("[prompts] Could not update vote.", cause);
      setError("Your vote could not be saved. Try again.");
    }
  }

  return (
    <Shell>
      <p className="font-mono text-xs uppercase tracking-wider text-subtle">A small shared challenge</p>
      <h1 className="mt-2 font-display text-4xl tracking-tight sm:text-5xl">This week on Mainline</h1>
      <section className="mt-7 rounded-lg border border-line bg-surface p-5 sm:p-7">
        <div className="flex items-start gap-4">
          <span className="grid size-10 shrink-0 place-items-center border border-line bg-elevated text-muted">
            <Lightbulb className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="font-mono text-xs text-subtle">{initial.prompt.weekLabel} · New prompt every Monday (UTC)</p>
            <h2 className="mt-2 font-display text-3xl tracking-tight">{initial.prompt.title}</h2>
            <p className="mt-3 max-w-2xl text-muted">{initial.prompt.description}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {initial.prompt.skills.map((skill) => (
                <span key={skill} className="rounded-sm border border-line px-2 py-1 font-mono text-xs text-muted">{skill}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <SignInGate fallback={<div className="mt-7"><SignInPanel title="Sign in to share your solution" /></div>}>
        <PromptEntryForm promptKey={initial.prompt.key} onSubmitted={() => void refreshEntries()} />
      </SignInGate>

      <section className="mt-10">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-display text-3xl tracking-tight">Community solutions</h2>
          <span className="text-sm text-subtle">{entries.length} submitted</span>
        </div>
        {error ? <p role="alert" className="mt-3 text-sm text-danger">{error}</p> : null}
        {entries.length === 0 ? (
          <p className="mt-4 rounded-lg border border-line bg-surface p-5 text-sm text-muted">
            Be the first to share how you approached this week's challenge.
          </p>
        ) : (
          <div className="mt-4 grid gap-3">
            {entries.map((entry) => (
              <article key={entry.id} className="rounded-lg border border-line bg-surface p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Link to="/u/$handle" params={{ handle: entry.authorHandle }} className="text-sm text-fg hover:underline">{entry.authorName}</Link>
                    <span className="ml-2 text-xs text-subtle">{formatDay(entry.createdAt)}</span>
                  </div>
                  {user ? (
                    <Button
                      variant="ghost"
                      disabled={user.id === entry.authorUserId}
                      aria-pressed={entry.voted}
                      onClick={() => void onVote(entry)}
                    >
                      <ThumbsUp className="size-4" />
                      {entry.voted ? "Appreciated" : "Appreciate"} · {entry.voteCount}
                    </Button>
                  ) : <span className="text-sm text-subtle">{entry.voteCount} appreciations</span>}
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-muted">{entry.body}</p>
                <div className="mt-3 flex flex-wrap gap-4">
                  {entry.projectId ? (
                    <Link to="/project/$id" params={{ id: entry.projectId }} className="inline-flex min-h-11 items-center gap-1 text-sm text-fg hover:underline">
                      {entry.projectTitle || "View project"}
                    </Link>
                  ) : null}
                  {entry.repoUrl ? (
                    <a href={entry.repoUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-1 text-sm text-muted hover:text-fg">
                      Source
                      <ArrowUpRight className="size-4" />
                    </a>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </Shell>
  );
}

function PromptEntryForm({ promptKey, onSubmitted }: { promptKey: string; onSubmitted: () => void }) {
  const [body, setBody] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await submitPromptEntry({ data: { promptKey, body, repoUrl } });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setBody("");
      setRepoUrl("");
      onSubmitted();
    } catch (cause) {
      console.error("[prompts] Could not submit solution.", cause);
      setError("Your solution could not be submitted. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="mt-7 rounded-lg border border-line bg-surface p-5">
      <h2 className="font-display text-2xl">Share your approach</h2>
      <div className="mt-4 space-y-4">
        <Field label="What did you build, and what did you learn?">
          <TextArea value={body} onChange={(event) => setBody(event.target.value)} maxLength={800} className="min-h-24" />
        </Field>
        <Field label="Source link (optional)" hint="Use a public repository or demo URL.">
          <TextInput value={repoUrl} onChange={(event) => setRepoUrl(event.target.value)} maxLength={200} placeholder="https://" />
        </Field>
        {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
        <Button type="submit" disabled={busy}>{busy ? "Sharing…" : "Share solution"}</Button>
      </div>
    </form>
  );
}
