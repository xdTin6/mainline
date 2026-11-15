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
import { createBuildUpdate, listProjectUpdates } from "@/lib/mainline/community";
import type { BuildUpdate } from "@/lib/mainline/types";
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
  const [replyingTo, setReplyingTo] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const [replyError, setReplyError] = useState("");
  const [updates, setUpdates] = useState<BuildUpdate[]>([]);
  const [updateBody, setUpdateBody] = useState("");
  const [updateError, setUpdateError] = useState("");
  const [loadingUpdates, setLoadingUpdates] = useState(true);
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

  useEffect(() => {
    let cancel = false;
    listProjectUpdates({ data: project.id })
      .then((items) => {
        if (!cancel) setUpdates(items);
      })
      .catch((cause) => {
        console.error("[project] Could not load build updates.", cause);
        if (!cancel) setUpdateError("Build updates could not be loaded.");
      })
      .finally(() => {
        if (!cancel) setLoadingUpdates(false);
      });
    return () => {
      cancel = true;
    };
  }, [project.id]);

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
    try {
      const result = await addNote({ data: { projectId: project.id, body: note } });
      if (!result.ok) {
        setNoteError(result.error);
        return;
      }
      setNote("");
      await onRefresh();
    } catch (cause) {
      console.error("[project] Could not post note.", cause);
      setNoteError("Your note could not be posted. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function onReply(event: FormEvent, parentId: string) {
    event.preventDefault();
    setBusy(true);
    setReplyError("");
    try {
      const result = await addNote({ data: { projectId: project.id, body: replyBody, parentId } });
      if (!result.ok) {
        setReplyError(result.error);
        return;
      }
      setReplyBody("");
      setReplyingTo("");
      await onRefresh();
    } catch (cause) {
      console.error("[project] Could not post reply.", cause);
      setReplyError("Your reply could not be posted. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function onBuildUpdate(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setUpdateError("");
    try {
      const result = await createBuildUpdate({ data: { projectId: project.id, body: updateBody } });
      if (!result.ok) {
        setUpdateError(result.error);
        return;
      }
      setUpdateBody("");
      setUpdates(await listProjectUpdates({ data: project.id }));
    } catch (cause) {
      console.error("[project] Could not post build update.", cause);
      setUpdateError("Your update could not be posted. Try again.");
    } finally {
      setBusy(false);
    }
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
          <section className="mt-12 border-t border-line pt-8">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="font-display text-2xl tracking-tight">Build log</h2>
              <span className="text-xs text-subtle">{updates.length} updates</span>
            </div>
            {owns ? (
              <form onSubmit={(event) => void onBuildUpdate(event)} className="mt-5 space-y-3 rounded-lg border border-line bg-surface p-4">
                <Field label="Share a progress update" hint="What changed, what surprised you, or what is next?">
                  <TextArea value={updateBody} onChange={(event) => setUpdateBody(event.target.value)} maxLength={800} className="min-h-24" />
                </Field>
                {updateError ? <p role="alert" className="text-sm text-danger">{updateError}</p> : null}
                <Button type="submit" disabled={busy}>{busy ? "Posting…" : "Post update"}</Button>
              </form>
            ) : null}
            {loadingUpdates ? <div className="mt-5 h-20 animate-pulse rounded-lg bg-elevated" /> : null}
            {updateError && !owns ? <p role="alert" className="mt-4 text-sm text-danger">{updateError}</p> : null}
            {!loadingUpdates && updates.length === 0 ? <p className="mt-4 text-sm text-subtle">No progress updates yet.</p> : null}
            {updates.length ? (
              <ol className="mt-5 space-y-5 border-l border-line pl-5">
                {updates.map((item) => (
                  <li key={item.id} className="relative">
                    <span className="absolute -left-[1.4rem] top-2 size-2 rounded-full bg-line-strong" />
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <Link to="/u/$handle" params={{ handle: item.authorHandle }} className="text-sm text-fg hover:underline">{item.authorName}</Link>
                      <span className="text-xs text-subtle">{formatDay(item.createdAt)}</span>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted">{item.body}</p>
                  </li>
                ))}
              </ol>
            ) : null}
          </section>
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
              {notes.filter((item) => !item.parentId).map((item) => (
                <li key={item.id} className="border-b border-line pb-5">
                  <div className="flex items-baseline justify-between gap-3">
                    <Link to="/u/$handle" params={{ handle: item.authorHandle }} className="text-sm text-fg">
                      {item.authorName}
                    </Link>
                    <span className="text-xs text-subtle tabular-nums">{formatDay(item.createdAt)}</span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{item.body}</p>
                  <div className="mt-2 flex flex-wrap gap-3">
                    <SignInGate fallback={<Link to="/login" className="inline-flex min-h-11 items-center text-xs text-subtle hover:text-fg">Sign in to reply</Link>}>
                      <button
                        type="button"
                        className="min-h-11 text-xs text-subtle hover:text-fg"
                        onClick={() => {
                          setReplyingTo(replyingTo === item.id ? "" : item.id);
                          setReplyError("");
                        }}
                      >
                        {replyingTo === item.id ? "Cancel reply" : "Reply"}
                      </button>
                    </SignInGate>
                  {userId && userId === item.authorUserId ? (
                    <button
                      type="button"
                      className="mt-2 min-h-11 text-xs text-subtle hover:text-danger"
                      onClick={() => void onDeleteNote(item.id)}
                    >
                      Remove note
                    </button>
                  ) : null}
                  </div>
                  {notes.filter((reply) => reply.parentId === item.id).map((reply) => (
                    <div key={reply.id} className="ml-4 mt-4 border-l border-line pl-4 sm:ml-8">
                      <div className="flex items-baseline justify-between gap-3">
                        <Link to="/u/$handle" params={{ handle: reply.authorHandle }} className="text-sm text-fg">
                          {reply.authorName}
                        </Link>
                        <span className="text-xs text-subtle tabular-nums">{formatDay(reply.createdAt)}</span>
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-muted">{reply.body}</p>
                      {userId && userId === reply.authorUserId ? (
                        <button
                          type="button"
                          className="mt-2 min-h-11 text-xs text-subtle hover:text-danger"
                          onClick={() => void onDeleteNote(reply.id)}
                        >
                          Remove reply
                        </button>
                      ) : null}
                    </div>
                  ))}
                  {replyingTo === item.id ? (
                    <form onSubmit={(event) => void onReply(event, item.id)} className="ml-4 mt-4 space-y-3 border-l border-line pl-4 sm:ml-8">
                      <Field label={`Reply to ${item.authorName}`}>
                        <TextArea value={replyBody} onChange={(event) => setReplyBody(event.target.value)} maxLength={800} className="min-h-20" />
                      </Field>
                      {replyError ? <p role="alert" className="text-sm text-danger">{replyError}</p> : null}
                      <Button type="submit" disabled={busy}>{busy ? "Sending…" : "Post reply"}</Button>
                    </form>
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
