import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { Monogram } from "@/components/cover";
import { ProjectCard } from "@/components/project-card";
import { Shell } from "@/components/shell";
import { Button } from "@/components/ui";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { followState, getProfile, starredIds, toggleFollow } from "@/lib/mainline/api";
import { countLabel, safeHttpUrl } from "@/lib/mainline/text";

export const Route = createFileRoute("/u/$handle")({
  loader: ({ params }) => getProfile({ data: params.handle }),
  component: ProfilePage,
});

function ProfilePage() {
  const profile = Route.useLoaderData();
  const { user } = useCurrentUserState();
  const [stars, setStars] = useState<string[]>([]);
  const [following, setFollowing] = useState(false);
  const [self, setSelf] = useState(false);
  const [followers, setFollowers] = useState(profile?.followerCount ?? 0);
  const [error, setError] = useState("");
  const userId = user?.id;

  useEffect(() => {
    setFollowers(profile?.followerCount ?? 0);
  }, [profile?.followerCount]);

  useEffect(() => {
    if (!userId || !profile) return;
    let cancel = false;
    starredIds()
      .then((ids) => {
        if (!cancel) setStars(ids);
      })
      .catch(() => undefined);
    followState({ data: profile.handle })
      .then((state) => {
        if (!cancel) {
          setFollowing(state.following);
          setSelf(state.self);
        }
      })
      .catch(() => undefined);
    return () => {
      cancel = true;
    };
  }, [userId, profile]);

  if (!profile) {
    return (
      <Shell>
        <h1 className="font-display text-4xl tracking-tight">No maker by that name</h1>
        <Link to="/explore" className="mt-6 inline-flex min-h-11 items-center text-sm text-fg">
          Browse the index
        </Link>
      </Shell>
    );
  }

  const website = safeHttpUrl(profile.website);

  async function onFollow() {
    if (!profile) return;
    const result = await toggleFollow({ data: profile.handle });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setFollowing(result.following);
    setFollowers(result.followerCount);
    setError("");
  }

  return (
    <Shell>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <Monogram name={profile.displayName} className="h-16 w-16 text-2xl" />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-4xl tracking-tight">{profile.displayName}</h1>
          <p className="mt-2 text-sm text-muted">
            @{profile.handle}
            {profile.role ? ` · ${profile.role}` : ""}
            {profile.location ? ` · ${profile.location}` : ""}
          </p>
          {profile.bio ? <p className="mt-4 max-w-xl text-base text-fg">{profile.bio}</p> : null}
          <p className="mt-4 text-sm text-subtle tabular-nums">
            {countLabel(profile.projects.length, "project")} · {countLabel(followers, "follower")} · {profile.followingCount} following
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            {self ? (
              <Link to="/you" className="inline-flex min-h-11 items-center rounded-sm border border-line px-4 text-sm">
                Edit bench
              </Link>
            ) : user ? (
              <Button variant="ghost" onClick={() => void onFollow()}>
                {following ? "Following" : "Follow"}
              </Button>
            ) : (
              <Link to="/login" className="inline-flex min-h-11 items-center text-sm text-muted hover:text-fg">
                Sign in to follow
              </Link>
            )}
            {website ? (
              <a href={website} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-1 text-sm text-muted hover:text-fg">
                Website
                <ArrowUpRight className="size-4" />
              </a>
            ) : null}
          </div>
          {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
        </div>
      </div>

      <h2 className="mt-12 font-display text-2xl tracking-tight">Projects</h2>
      {profile.projects.length === 0 ? (
        <p className="mt-3 text-muted">Nothing published yet.</p>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {profile.projects.map((project) => (
            <ProjectCard key={project.id} project={project} starred={stars.includes(project.id)} />
          ))}
        </div>
      )}
    </Shell>
  );
}
