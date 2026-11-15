import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowUpRight, Star } from "lucide-react";
import { ProjectCard } from "@/components/project-card";
import { Shell } from "@/components/shell";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { listShowcase, starredIds } from "@/lib/mainline/api";

export const Route = createFileRoute("/showcase")({
  loader: () => listShowcase(),
  component: ShowcasePage,
});

function ShowcasePage() {
  const projects = Route.useLoaderData();
  const { user } = useCurrentUserState();
  const [stars, setStars] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setStars([]);
      return;
    }
    starredIds()
      .then((ids) => {
        if (!cancelled) setStars(ids);
      })
      .catch((cause) => console.error("[showcase] Could not load starred projects.", cause));
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return (
    <Shell>
      <p className="font-mono text-xs uppercase tracking-wider text-subtle">A weekly edit</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1 className="font-display text-4xl tracking-tight sm:text-5xl">Community showcase</h1>
          <p className="mt-3 max-w-2xl text-muted">Projects earning the community’s attention this week. When the week is quiet, the most-starred work stays in view.</p>
        </div>
        <Link to="/" className="inline-flex min-h-11 items-center gap-2 text-sm text-muted hover:text-fg">
          Browse all projects
          <ArrowUpRight className="size-4" />
        </Link>
      </div>
      <p className="mt-7 flex items-center gap-2 text-sm text-subtle">
        <Star className="size-4" />
        Ranked by community stars, with recent work first when scores match.
      </p>
      {projects.length === 0 ? (
        <p className="mt-6 rounded-lg border border-line bg-surface p-5 text-sm text-muted">The showcase is waiting for its first project.</p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {projects.map((project, index) => (
            <ProjectCard key={project.id} project={project} starred={stars.includes(project.id)} featured={index === 0} />
          ))}
        </div>
      )}
    </Shell>
  );
}
