import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { Cover } from "@/components/cover";
import { Shell } from "@/components/shell";
import { SignInPanel } from "@/components/sign-in-panel";
import { StarButton } from "@/components/star-button";
import { Button, Field, TextArea, TextInput } from "@/components/ui";
import { Writeup } from "@/components/writeup";
import { SignInGate } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import {
  addNote,
  deleteNote,
  deleteProject,
  followState,
  getProject,
  starredIds,
  toggleFollow,
  updateProject,
} from "@/lib/mainline/api";
import { LANGUAGES } from "@/lib/mainline/types";
import { formatDay, safeHttpUrl } from "@/lib/mainline/text";

export const Route = createFileRoute("/project/$id")({
  loader: ({ params }) => getProject({ data: params.id }),
  component: ProjectPage,
});

function ProjectPage() {
  const data = Route.useLoaderData();
  const router = useRouter();
  if (!data) {
    return (
      <Shell>
        <h1 className="font-display text-4xl tracking-tight">Not on the record</h1>
        <p className="mt-3 text-muted">That project is not here.</p>
        <Link to="/" search={{ q: "", lang: "", sort: "new" }} className="mt-6 inline-flex min-h-11 items-center text-sm text-fg">
          Back to the record
        </Link>
      </Shell>
    );
  }

  return <ProjectView key={data.project.id + data.project.summary} initial={data} onRefresh={() => router.invalidate()} />;
}

function ProjectView({
  initial,
  onRefresh,
}: {
  initial: NonNullable<Awaited<ReturnType<typeof getProject>>>;
  onRefresh: () => Promise<void>;
}) {
  const { project, notes } = initial;
  const { user } = useCurrentUserState();
  const router = useRouter();
  const navigate = Route.useNavigate();
  const [starred, setStarred] = useState(false);
  const [starCount, setStarCount] = useState(project.starCount);
  const [editing, setEditing] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState("");
  const [busy, setBusy] = useState(false);
  const [relation, setRelation] = useState<{ self: boolean; following: boolean } | null>(null);
  const [followers, setFollowers] = useState<number | null>(null);
  const userId = user?.id;
  const owns = Boolean(userId && userId === project.authorUserId);

  useEffect(() => {
    if (!userId) {
      setStarred(false);
      setRelation(null);
      return;
    }
    let cancel = false;
    starredIds()
      .then((ids) => {
        if (!cancel) setStarred(ids.includes(project.id));
      })
      .catch(() => undefined);
    followState({ data: project.authorHandle })
      .then((state) => {
        if (!cancel) setRelation({ self: state.self, following: state.following });
      })
      .catch(() => undefined);
    return () => {
      cancel = true;
    };
  }, [userId, project.id, project.authorHandle]);

  async function onFollow() {
    const result = await toggleFollow({ data: project.authorHandle });
    if (!result.ok) {
      setNoteError(result.error);
      return;
    }
    setRelation({ self: false, following: result.following });
    setFollowers(result.followerCount);
  }

  async function onNote(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setNoteError("");
    const result = await addNote({ data: { projectId: project.id, body: note } });
    setBusy(false);
    if (!result.ok) {
      setNoteError(result.error);
      return;
    }
    setNote("");
    await onRefresh();
  }

  async function onDeleteNote(id: string) {
    const result = await deleteNote({ data: id });
    if (result.ok) await onRefresh();
  }

  async function onDeleteProject() {
    const result = await deleteProject({ data: project.id });
    if (!result.ok) {
      setNoteError(result.error);
      return;
    }
    await navigate({ to: "/", search: { q: "", lang: "", sort: "new" } });
  }

  const repo = safeHttpUrl(project.repoUrl);
  const demo = safeHttpUrl(project.demoUrl);

  return (
    <Shell>
      <Link
        to="/"
        search={{ q: "", lang: "", sort: "new" }}
        className="inline-flex min-h-11 items-center gap-2 text-sm text-muted hover:text-fg"
      >
        <ArrowLeft className="size-4" />
        Record
      </Link>
      <Cover id={project.id} language={project.language} className="mt-4 h-40 sm:h-56 rounded-xl border border-line" />
      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <article className="min-w-0">
          <h1 className="font-display text-4xl tracking-tight sm:text-5xl">{project.title}</h1>
          <p className="mt-4 max-w-2xl text-lg text-muted">{project.summary}</p>
          <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2">
            <Link to="/u/$handle" params={{ handle: project.authorHandle }} className="text-sm text-fg hover:underline">
              {project.authorName}
            </Link>
            <span className="text-sm text-subtle">{project.authorRole}</span>
            <span className="text-sm text-subtle tabular-nums">{formatDay(project.createdAt)}</span>
            <StarButton
              projectId={project.id}
              count={starCount}
              starred={starred}
              onChange={(next) => {
                setStarred(next.starred);
                setStarCount(next.starCount);
              }}
            />
            {relation && !relation.self ? (
              <Button variant="ghost" onClick={() => void onFollow()}>
                {relation.following ? "Following" : "Follow"}
                {followers != null ? ` · ${followers}` : ""}
              </Button>
            ) : null}
          </div>
          {project.tags.length ? (
            <p className="mt-4 font-mono text-xs text-subtle">{project.tags.join(" · ")}</p>
          ) : null}
          <div className="mt-8">
            {editing ? (
              <EditForm
                project={project}
                onCancel={() => setEditing(false)}
                onSaved={async () => {
                  setEditing(false);
                  await router.invalidate();
                }}
              />
            ) : (
              <Writeup body={project.body} />
            )}
          </div>
          {owns && !editing ? (
            <div className="mt-8 flex flex-wrap gap-3">
              <Button variant="ghost" onClick={() => setEditing(true)}>
                Edit
              </Button>
              {confirmRemove ? (
                <>
                  <Button variant="danger" onClick={() => void onDeleteProject()}>
                    Remove
                  </Button>
                  <Button variant="quiet" onClick={() => setConfirmRemove(false)}>
                    Cancel
                  </Button>
                </>
              ) : (
                <Button variant="quiet" onClick={() => setConfirmRemove(true)}>
                  Remove from the record
                </Button>
              )}
            </div>
          ) : null}

          <section className="mt-12 border-t border-line pt-8">
            <h2 className="font-display text-2xl tracking-tight">Notes</h2>
            {notes.length === 0 ? <p className="mt-3 text-sm text-subtle">No notes yet.</p> : null}
            <ul className="mt-4 space-y-5">
              {notes.map((item) => (
                <li key={item.id} className="border-b border-line pb-5">
                  <div className="flex items-baseline justify-between gap-3">
                    <Link to="/u/$handle" params={{ handle: item.authorHandle }} className="text-sm text-fg">
                      {item.authorName}
                    </Link>
                    <span className="text-xs text-subtle tabular-nums">{formatDay(item.createdAt)}</span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{item.body}</p>
                  {userId && userId === item.authorUserId ? (
                    <button
                      type="button"
                      className="mt-2 min-h-11 text-xs text-subtle hover:text-danger"
                      onClick={() => void onDeleteNote(item.id)}
                    >
                      Remove note
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
            <SignInGate
              fallback={
                <div className="mt-8">
                  <SignInPanel title="Sign in to leave a note" />
                </div>
              }
            >
              <form onSubmit={(event) => void onNote(event)} className="mt-8 space-y-3">
                <Field label="Leave a note">
                  <TextArea value={note} onChange={(event) => setNote(event.target.value)} maxLength={800} />
                </Field>
                {noteError ? <p className="text-sm text-danger">{noteError}</p> : null}
                <Button type="submit" disabled={busy}>
                  {busy ? "Sending…" : "Post note"}
                </Button>
              </form>
            </SignInGate>
          </section>
        </article>

        <aside className="h-fit rounded-xl border border-line bg-surface p-4 lg:sticky lg:top-24">
          <p className="text-sm text-muted tabular-nums">{starCount} stars</p>
          <p className="mt-1 text-xs text-subtle">{project.noteCount} notes</p>
          <div className="mt-4 flex flex-col gap-2">
            {repo ? <OutLink href={repo} label="Repository" /> : null}
            {demo ? <OutLink href={demo} label="Live demo" /> : null}
          </div>
          <p className="mt-4 text-sm text-muted">{project.authorLocation}</p>
        </aside>
      </div>
    </Shell>
  );
}

function OutLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex min-h-11 items-center justify-between gap-2 rounded-sm border border-line px-3 text-sm text-fg hover:bg-elevated"
    >
      {label}
      <ArrowUpRight className="size-4 text-subtle" />
    </a>
  );
}

function EditForm({
  project,
  onCancel,
  onSaved,
}: {
  project: NonNullable<Awaited<ReturnType<typeof getProject>>>["project"];
  onCancel: () => void;
  onSaved: () => Promise<void>;
}) {
  const [title, setTitle] = useState(project.title);
  const [summary, setSummary] = useState(project.summary);
  const [body, setBody] = useState(project.body);
  const [language, setLanguage] = useState(project.language);
  const [tags, setTags] = useState(project.tags.join(", "));
  const [repoUrl, setRepoUrl] = useState(project.repoUrl);
  const [demoUrl, setDemoUrl] = useState(project.demoUrl);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const result = await updateProject({
      data: { id: project.id, title, summary, body, language, tags, repoUrl, demoUrl },
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    await onSaved();
  }

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="space-y-4 rounded-xl border border-line bg-surface p-4">
      <Field label="Title">
        <TextInput value={title} onChange={(event) => setTitle(event.target.value)} maxLength={80} />
      </Field>
      <Field label="Summary">
        <TextArea value={summary} onChange={(event) => setSummary(event.target.value)} className="min-h-20" maxLength={240} />
      </Field>
      <Field label="Writeup" hint="Blank line for a new paragraph. Fenced code with three backticks.">
        <TextArea value={body} onChange={(event) => setBody(event.target.value)} className="min-h-48" maxLength={8000} />
      </Field>
      <Field label="Language">
        <select
          value={language}
          onChange={(event) => setLanguage(event.target.value)}
          className="min-h-11 w-full rounded-sm border border-line bg-bg px-3 text-base text-fg"
        >
          {LANGUAGES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Tags">
        <TextInput value={tags} onChange={(event) => setTags(event.target.value)} />
      </Field>
      <Field label="Repository">
        <TextInput value={repoUrl} onChange={(event) => setRepoUrl(event.target.value)} />
      </Field>
      <Field label="Live demo">
        <TextInput value={demoUrl} onChange={(event) => setDemoUrl(event.target.value)} />
      </Field>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <div className="flex gap-3">
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
