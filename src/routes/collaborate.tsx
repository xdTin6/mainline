import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Handshake, Plus } from "lucide-react";
import { Shell } from "@/components/shell";
import { Button, Field, TextArea, TextInput } from "@/components/ui";
import { SignInGate } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import {
  createCollabPost,
  expressCollabInterest,
  listCollabPosts,
  myCollabState,
  setCollabPostStatus,
} from "@/lib/mainline/community";
import { getMine } from "@/lib/mainline/api";
import type { CollabInterest, CollabPost } from "@/lib/mainline/types";
import { formatDay } from "@/lib/mainline/text";

export const Route = createFileRoute("/collaborate")({
  loader: () => listCollabPosts({ data: { q: "", status: "all" } }),
  component: CollaboratePage,
});

function CollaboratePage() {
  const initialPosts = Route.useLoaderData();
  const { user } = useCurrentUserState();
  const [posts, setPosts] = useState(initialPosts);
  const [status, setStatus] = useState<"open" | "closed" | "all">("all");
  const [query, setQuery] = useState("");
  const [ownedIds, setOwnedIds] = useState<string[]>([]);
  const [interestedIds, setInterestedIds] = useState<string[]>([]);
  const [received, setReceived] = useState<CollabInterest[]>([]);
  const [showComposer, setShowComposer] = useState(false);
  const [error, setError] = useState("");

  async function refresh(nextQuery = query, nextStatus = status) {
    const result = await listCollabPosts({ data: { q: nextQuery, status: nextStatus } });
    setPosts(result);
  }

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setOwnedIds([]);
      setInterestedIds([]);
      setReceived([]);
      return;
    }
    myCollabState()
      .then((state) => {
        if (!cancelled) {
          setOwnedIds(state.ownedIds);
          setInterestedIds(state.interestedIds);
          setReceived(state.received);
        }
      })
      .catch((cause) => {
        console.error("[collaborate] Could not load your collaboration state.", cause);
        if (!cancelled) setError("Your collaboration status could not be loaded.");
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  async function onSearch(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await refresh(query, status);
    } catch (cause) {
      console.error("[collaborate] Could not load requests.", cause);
      setError("Requests could not be loaded. Try again.");
    }
  }

  async function onStatusChange(nextStatus: "open" | "closed" | "all") {
    setStatus(nextStatus);
    setError("");
    try {
      await refresh(query, nextStatus);
    } catch (cause) {
      console.error("[collaborate] Could not filter requests.", cause);
      setError("Requests could not be filtered. Try again.");
    }
  }

  async function onCreated() {
    setShowComposer(false);
    setStatus("open");
    setError("");
    try {
      await refresh(query, "open");
      const next = await myCollabState();
      setOwnedIds(next.ownedIds);
      setInterestedIds(next.interestedIds);
      setReceived(next.received);
    } catch (cause) {
      console.error("[collaborate] Could not refresh requests.", cause);
      setError("Your request was posted, but the list could not be refreshed.");
    }
  }

  return (
    <Shell>
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="font-mono text-xs uppercase tracking-wider text-subtle">Build together</p>
          <h1 className="mt-2 font-display text-4xl tracking-tight sm:text-5xl">Find your next collaborator</h1>
          <p className="mt-3 max-w-2xl text-muted">Requests from makers looking for a review, a skill, or a teammate.</p>
        </div>
        <SignInGate
          fallback={<Link to="/login" className="inline-flex min-h-11 items-center text-sm text-muted hover:text-fg">Sign in to post</Link>}
        >
          <Button onClick={() => setShowComposer((value) => !value)}>
            <Plus className="size-4" />
            {showComposer ? "Close form" : "Post a request"}
          </Button>
        </SignInGate>
      </div>

      {showComposer ? <NewRequest onCreated={() => void onCreated()} onCancel={() => setShowComposer(false)} /> : null}

      <form onSubmit={(event) => void onSearch(event)} className="mt-8 grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem_auto]">
        <TextInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search skills or projects" aria-label="Search collaboration requests" />
        <select
          value={status}
          onChange={(event) => void onStatusChange(event.target.value as "open" | "closed" | "all")}
          className="min-h-11 rounded-sm border border-line bg-bg px-3 text-base text-fg"
          aria-label="Request status"
        >
          <option value="all">All requests</option>
          <option value="open">Open requests</option>
          <option value="closed">Closed requests</option>
        </select>
        <Button type="submit" variant="ghost">Search</Button>
      </form>

      {error ? <p role="alert" className="mt-4 text-sm text-danger">{error}</p> : null}
      <div className="mt-7 space-y-3">
        {posts.map((post) => (
          <RequestCard
            key={post.id}
            post={post}
            isOwner={ownedIds.includes(post.id)}
            interested={interestedIds.includes(post.id)}
            received={received.filter((item) => item.postId === post.id)}
            onChanged={async () => {
              try {
                await refresh();
                if (!user) return;
                const next = await myCollabState();
                setOwnedIds(next.ownedIds);
                setInterestedIds(next.interestedIds);
                setReceived(next.received);
              } catch (cause) {
                console.error("[collaborate] Could not refresh request state.", cause);
                setError("Request status could not be refreshed.");
              }
            }}
          />
        ))}
        {posts.length === 0 ? (
          <div className="rounded-lg border border-line bg-surface p-6">
            <Handshake className="size-5 text-muted" />
            <h2 className="mt-3 font-display text-2xl">No requests here yet</h2>
            <p className="mt-2 text-sm text-muted">Try another search or start the first collaboration.</p>
          </div>
        ) : null}
      </div>
    </Shell>
  );
}

function NewRequest({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [skills, setSkills] = useState("");
  const [projectId, setProjectId] = useState("");
  const [projects, setProjects] = useState<{ id: string; title: string }[]>([]);
  const [hasProfile, setHasProfile] = useState(false);
  const [profileReady, setProfileReady] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getMine()
      .then((mine) => {
        if (cancelled) return;
        setHasProfile(Boolean(mine.profile));
        setProjects(mine.projects.map(({ id, title }) => ({ id, title })));
        setProfileReady(true);
      })
      .catch((cause) => {
        console.error("[collaborate] Could not load your projects.", cause);
        if (!cancelled) {
          setProfileReady(true);
          setError("Your bench could not be loaded.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await createCollabPost({ data: { title, description, skills, projectId } });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onCreated();
    } catch (cause) {
      console.error("[collaborate] Could not post request.", cause);
      setError("The request could not be posted. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="mt-8 space-y-4 rounded-lg border border-line bg-surface p-5">
      <h2 className="font-display text-2xl">What are you building together?</h2>
      <Field label="Request title">
        <TextInput value={title} onChange={(event) => setTitle(event.target.value)} maxLength={100} placeholder="Looking for a Rust reviewer for my parser" />
      </Field>
      <Field label="Details" hint="Explain the project, the help you need, and what a good first step looks like.">
        <TextArea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1000} />
      </Field>
      <Field label="Skills or topics" hint="Comma separated, for example: Rust, parsing, testing">
        <TextInput value={skills} onChange={(event) => setSkills(event.target.value)} maxLength={120} />
      </Field>
      <Field label="Related project (optional)">
        <select value={projectId} onChange={(event) => setProjectId(event.target.value)} className="min-h-11 w-full rounded-sm border border-line bg-bg px-3 text-base text-fg">
          <option value="">No project linked</option>
          {projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
        </select>
      </Field>
      {profileReady && !hasProfile ? (
        <p className="text-sm text-muted">Create your maker profile on <Link to="/you" className="text-fg underline">your bench</Link> before posting.</p>
      ) : null}
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={busy || !profileReady || !hasProfile}>{busy ? "Posting…" : "Post request"}</Button>
        <Button variant="quiet" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

function RequestCard({
  post,
  isOwner,
  interested,
  received,
  onChanged,
}: {
  post: CollabPost;
  isOwner: boolean;
  interested: boolean;
  received: CollabInterest[];
  onChanged: () => Promise<void>;
}) {
  const [replying, setReplying] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onInterest(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await expressCollabInterest({ data: { postId: post.id, message } });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage("");
      setReplying(false);
      await onChanged();
    } catch (cause) {
      console.error("[collaborate] Could not send interest.", cause);
      setError("Your message could not be sent. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function onStatus(status: "open" | "closed") {
    setError("");
    try {
      const result = await setCollabPostStatus({ data: { id: post.id, status } });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      await onChanged();
    } catch (cause) {
      console.error("[collaborate] Could not update request status.", cause);
      setError("The request status could not be updated.");
    }
  }

  return (
    <article className="rounded-lg border border-line bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs text-subtle">
            <Link to="/u/$handle" params={{ handle: post.authorHandle }} className="text-sm text-fg hover:underline">{post.authorName}</Link>
            <span>·</span><span>{formatDay(post.createdAt)}</span>
            <span className="rounded-sm border border-line px-2 py-1">{post.status}</span>
          </div>
          <h2 className="mt-3 font-display text-2xl tracking-tight">{post.title}</h2>
        </div>
        <span className="text-xs text-subtle">{post.interestCount} interested</span>
      </div>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-muted">{post.description}</p>
      {post.projectId ? (
        <Link to="/project/$id" params={{ id: post.projectId }} className="mt-3 inline-flex min-h-11 items-center text-sm text-fg hover:underline">
          Project: {post.projectTitle || post.projectId}
        </Link>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {post.skills.map((skill) => <span key={skill} className="rounded-sm border border-line px-2 py-1 font-mono text-xs text-muted">{skill}</span>)}
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        {isOwner ? (
          <Button variant="ghost" onClick={() => void onStatus(post.status === "open" ? "closed" : "open")}>
            {post.status === "open" ? "Close request" : "Reopen request"}
          </Button>
        ) : post.status === "open" ? (
          interested ? (
            <span className="inline-flex min-h-11 items-center text-sm text-muted">You reached out</span>
          ) : (
            <SignInGate
              fallback={<Link to="/login" className="inline-flex min-h-11 items-center text-sm text-muted hover:text-fg">Sign in to offer help</Link>}
            >
              <Button variant="ghost" onClick={() => setReplying((value) => !value)}>{replying ? "Cancel" : "Offer to help"}</Button>
            </SignInGate>
          )
        ) : null}
      </div>
      {isOwner && received.length ? (
        <div className="mt-5 space-y-3 border-t border-line pt-4">
          <h3 className="text-sm text-fg">People who reached out</h3>
          {received.map((item) => (
            <div key={`${item.postId}-${item.authorHandle}`} className="rounded-sm border border-line bg-bg p-3">
              <div className="flex flex-wrap items-baseline gap-2">
                <Link to="/u/$handle" params={{ handle: item.authorHandle }} className="text-sm text-fg hover:underline">{item.authorName}</Link>
                <span className="text-xs text-subtle">{formatDay(item.createdAt)}</span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-muted">{item.message}</p>
            </div>
          ))}
        </div>
      ) : null}
      {replying ? (
        <form onSubmit={(event) => void onInterest(event)} className="mt-4 space-y-3 border-t border-line pt-4">
          <Field label="How can you help?" hint="The project maker will get a notification.">
            <TextArea value={message} onChange={(event) => setMessage(event.target.value)} maxLength={400} className="min-h-24" />
          </Field>
          {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
          <Button type="submit" disabled={busy}>{busy ? "Sending…" : "Send message"}</Button>
        </form>
      ) : error ? <p role="alert" className="mt-3 text-sm text-danger">{error}</p> : null}
    </article>
  );
}
