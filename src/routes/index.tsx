import { createFileRoute, Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, Radio, Search } from "lucide-react";
import { ProjectCard } from "@/components/project-card";
import { Shell } from "@/components/shell";
import { SignInPanel } from "@/components/sign-in-panel";
import { Button, TextInput } from "@/components/ui";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { listFeed, starredIds } from "@/lib/mainline/api";
import { listFollowingActivity } from "@/lib/mainline/community";
import type { ActivityItem } from "@/lib/mainline/types";
import { formatDay } from "@/lib/mainline/text";
import { LANGUAGES } from "@/lib/mainline/types";

export const Route = createFileRoute("/")({
  loader: () => listFeed({ data: { q: "", lang: "", tag: "", sort: "new" } }),
  component: Mainline,
});

function Mainline() {
  const initialProjects = Route.useLoaderData();
  const rawSearch = useRouterState({ select: (state) => state.location.search }) as Record<string, unknown>;
  const routeQuery = typeof rawSearch.q === "string" ? rawSearch.q : "";
  const routeLanguage = typeof rawSearch.lang === "string" ? rawSearch.lang : "";
  const routeTag = typeof rawSearch.tag === "string" ? rawSearch.tag : "";
  const routeSort = rawSearch.sort === "stars" || rawSearch.sort === "updated" ? rawSearch.sort : "new";
  const { user } = useCurrentUserState();
  const [scope, setScope] = useState<"latest" | "following">("latest");
  const [projects, setProjects] = useState(initialProjects);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [starred, setStarred] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [language, setLanguage] = useState("");
  const [tag, setTag] = useState("");
  const [sort, setSort] = useState<"new" | "stars" | "updated">("new");
  const [error, setError] = useState("");
  const [loadingActivity, setLoadingActivity] = useState(false);

  useEffect(() => {
    setQuery(routeQuery);
    setLanguage(routeLanguage);
    setTag(routeTag);
    setSort(routeSort);
    if (!routeQuery && !routeLanguage && !routeTag && routeSort === "new") {
      setProjects(initialProjects);
      setError("");
      return;
    }
    listFeed({ data: { q: routeQuery, lang: routeLanguage, tag: routeTag, sort: routeSort } })
      .then(setProjects)
      .catch((cause) => {
        console.error("[feed] Could not load linked project filters.", cause);
        setError("Projects could not be loaded. Try again.");
      });
  }, [initialProjects, routeQuery, routeLanguage, routeTag, routeSort]);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setStarred([]);
      return;
    }
    starredIds()
      .then((ids) => {
        if (!cancelled) setStarred(ids);
      })
      .catch((cause) => console.error("[feed] Could not load starred projects.", cause));
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  async function onFilter(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      setProjects(await listFeed({ data: { q: query, lang: language, tag, sort } }));
    } catch (cause) {
      console.error("[feed] Could not filter projects.", cause);
      setError("Projects could not be loaded. Try again.");
    }
  }

  async function showFollowing() {
    setScope("following");
    if (!user) return;
    setLoadingActivity(true);
    setError("");
    try {
      setActivity(await listFollowingActivity());
    } catch (cause) {
      console.error("[feed] Could not load your following feed.", cause);
      setError("Your following feed could not be loaded. Try again.");
    } finally {
      setLoadingActivity(false);
    }
  }

  return (
    <Shell>
      <section className="grid gap-8 border-b border-line pb-8 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div>
          <p className="font-mono text-xs uppercase tracking-wider text-subtle">A social record for people who build software</p>
          <h1 className="mt-3 max-w-3xl font-display text-5xl tracking-tight sm:text-6xl">Make the work visible.</h1>
          <p className="mt-4 max-w-2xl text-lg text-muted">Projects, progress, and the people behind them. Follow a maker, find your stack, or share what you are building.</p>
        </div>
        <Link to="/showcase" className="inline-flex min-h-11 items-center gap-2 text-sm text-fg hover:underline">
          This week’s showcase <ArrowRight className="size-4" />
        </Link>
      </section>

      <div className="mt-7 flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-2" role="tablist" aria-label="Project feed">
          <button
            type="button"
            role="tab"
            aria-selected={scope === "latest"}
            className={`min-h-11 border-b px-3 text-sm ${scope === "latest" ? "border-fg text-fg" : "border-transparent text-muted"}`}
            onClick={() => setScope("latest")}
          >
            Latest
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={scope === "following"}
            className={`min-h-11 border-b px-3 text-sm ${scope === "following" ? "border-fg text-fg" : "border-transparent text-muted"}`}
            onClick={() => void showFollowing()}
          >
            Following
          </button>
        </div>
        <Link to="/collaborate" className="inline-flex min-h-11 items-center gap-2 text-sm text-muted hover:text-fg">
          Find collaborators <ArrowRight className="size-4" />
        </Link>
      </div>

      {scope === "latest" ? (
        <>
          <form onSubmit={(event) => void onFilter(event)} className="mt-4 grid gap-3 rounded-lg border border-line bg-surface p-4 sm:grid-cols-[minmax(0,1fr)_10rem_10rem_9rem_auto] sm:items-center">
            <label className="relative block">
              <span className="sr-only">Search projects, people, and topics</span>
              <Search className="pointer-events-none absolute top-3.5 left-3 size-4 text-subtle" />
              <TextInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search projects, people, topics" className="pl-9" />
            </label>
            <select value={language} onChange={(event) => setLanguage(event.target.value)} className="min-h-11 rounded-sm border border-line bg-bg px-3 text-base text-fg" aria-label="Filter by language">
              <option value="">All stacks</option>
              {LANGUAGES.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <TextInput value={tag} onChange={(event) => setTag(event.target.value)} placeholder="Topic tag" aria-label="Filter by topic tag" />
            <select value={sort} onChange={(event) => setSort(event.target.value as "new" | "stars" | "updated")} className="min-h-11 rounded-sm border border-line bg-bg px-3 text-base text-fg" aria-label="Sort projects">
              <option value="new">Newest</option>
              <option value="updated">Recently updated</option>
              <option value="stars">Most starred</option>
            </select>
            <Button type="submit" variant="ghost">Filter</Button>
          </form>

          <div className="mt-6 flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="font-display text-3xl tracking-tight">Projects on the record</h2>
            <Link to="/explore" className="min-h-11 text-sm text-muted hover:text-fg">Explore stacks and makers</Link>
          </div>
          {error ? <p role="alert" className="mt-4 text-sm text-danger">{error}</p> : null}
          {projects.length === 0 ? (
            <div className="mt-5 rounded-lg border border-line bg-surface p-6">
              <h3 className="font-display text-2xl">No projects match that search</h3>
              <p className="mt-2 text-sm text-muted">Try another language or topic, or clear a filter.</p>
            </div>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {projects.map((project, index) => (
                <ProjectCard key={project.id} project={project} starred={starred.includes(project.id)} featured={index === 0} />
              ))}
            </div>
          )}
        </>
      ) : (
        <FollowingFeed
          userPresent={Boolean(user)}
          activity={activity}
          loading={loadingActivity}
          error={error}
          onRetry={() => void showFollowing()}
        />
      )}
    </Shell>
  );
}

function FollowingFeed({
  userPresent,
  activity,
  loading,
  error,
  onRetry,
}: {
  userPresent: boolean;
  activity: ActivityItem[];
  loading: boolean;
  error: string;
  onRetry: () => void;
}) {
  if (!userPresent) {
    return (
      <div className="mt-6">
        <SignInPanel title="Sign in to see updates from makers you follow" />
      </div>
    );
  }
  if (loading) return <div className="mt-6 h-44 animate-pulse rounded-lg bg-elevated" />;
  if (error) return <div role="alert" className="mt-6 rounded-lg border border-line bg-surface p-5 text-sm text-danger">{error} <button className="ml-2 underline" onClick={onRetry}>Retry</button></div>;
  if (activity.length === 0) {
    return (
      <div className="mt-6 rounded-lg border border-line bg-surface p-6">
        <h2 className="font-display text-2xl">Your feed starts with a follow</h2>
        <p className="mt-2 text-sm text-muted">Follow makers to see their new projects and build-log updates here.</p>
        <Link to="/explore" className="mt-3 inline-flex min-h-11 items-center text-sm text-fg hover:underline">Find makers</Link>
      </div>
    );
  }
  return (
    <ol className="mt-5 divide-y divide-line border-y border-line">
      {activity.map((item) => (
        <li key={`${item.kind}-${item.id}`} className="py-5">
          <div className="flex items-center gap-2 text-xs text-subtle">
            <Radio className="size-3.5" />
            <span>{item.kind === "update" ? "Build update" : "New project"}</span>
            <span>·</span><span>{formatDay(item.createdAt)}</span>
          </div>
          <p className="mt-2 text-sm text-muted">
            <Link to="/u/$handle" params={{ handle: item.authorHandle }} className="text-fg hover:underline">{item.authorName}</Link>
            {item.kind === "update" ? " shared progress on " : " published "}
            <Link to="/project/$id" params={{ id: item.projectId }} className="text-fg hover:underline">{item.projectTitle}</Link>
          </p>
          {item.kind === "update" ? (
            <p className="mt-2 max-w-3xl whitespace-pre-wrap text-sm leading-relaxed text-muted">{item.body}</p>
          ) : (
            <p className="mt-2 max-w-3xl text-sm text-muted">{item.summary}</p>
          )}
          <p className="mt-2 font-mono text-xs text-subtle">{item.language}</p>
        </li>
      ))}
    </ol>
  );
}
