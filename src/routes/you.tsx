import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Shell } from "@/components/shell";
import { SignInPanel } from "@/components/sign-in-panel";
import { Button, Field, TextArea, TextInput } from "@/components/ui";
import { SignInGate } from "@/lib/auth/gates";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { getMine, saveProfile } from "@/lib/mainline/api";
import type { Mine } from "@/lib/mainline/types";
import { slugHandle } from "@/lib/mainline/text";

export const Route = createFileRoute("/you")({
  component: YouPage,
});

function YouPage() {
  return (
    <Shell>
      <SignInGate fallback={<SignInPanel title="Sign in to open your bench" />}>
        <Bench />
      </SignInGate>
    </Shell>
  );
}

function Bench() {
  const user = useCurrentUser();
  const [mine, setMine] = useState<Mine | null>(null);
  const [error, setError] = useState("");

  async function load() {
    const next = await getMine();
    setMine(next);
  }

  useEffect(() => {
    let cancel = false;
    getMine()
      .then((next) => {
        if (!cancel) setMine(next);
      })
      .catch(() => {
        if (!cancel) setError("Could not load your bench.");
      });
    return () => {
      cancel = true;
    };
  }, []);

  if (error) return <p className="text-danger">{error}</p>;
  if (!mine) return <div className="h-48 animate-pulse rounded-xl bg-elevated" />;

  return (
    <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="min-w-0">
        <h1 className="font-display text-4xl tracking-tight sm:text-5xl">Bench</h1>
        <p className="mt-3 max-w-xl text-muted">
          {mine.profile
            ? "This is how you appear next to the work."
            : "Claim a handle. Then the projects you publish have a name on them."}
        </p>
        <ProfileForm
          initial={mine.profile}
          fallbackName={user?.displayName ?? ""}
          onSaved={async (handle) => {
            toast("Bench updated.");
            await load();
            if (handle) setMine((current) => current);
          }}
        />
      </div>
      <aside className="min-w-0 space-y-8">
        <section>
          <h2 className="font-display text-2xl">Your projects</h2>
          {mine.projects.length === 0 ? (
            <p className="mt-2 text-sm text-subtle">Nothing published yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line border-y border-line">
              {mine.projects.map((project) => (
                <li key={project.id}>
                  <Link to="/project/$id" params={{ id: project.id }} className="flex min-h-11 items-center justify-between gap-3 text-sm">
                    <span className="truncate">{project.title}</span>
                    <span className="shrink-0 text-subtle">{project.language}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link to="/new" className="mt-3 inline-flex min-h-11 items-center text-sm text-muted hover:text-fg">
            Publish a project
          </Link>
        </section>
        <section>
          <h2 className="font-display text-2xl">Starred</h2>
          {mine.starred.length === 0 ? (
            <p className="mt-2 text-sm text-subtle">Stars you give show up here.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line border-y border-line">
              {mine.starred.map((project) => (
                <li key={project.id}>
                  <Link to="/project/$id" params={{ id: project.id }} className="flex min-h-11 items-center text-sm">
                    {project.title}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section>
          <h2 className="font-display text-2xl">Following</h2>
          {mine.following.length === 0 ? (
            <p className="mt-2 text-sm text-subtle">Makers you follow will be listed here.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line border-y border-line">
              {mine.following.map((maker) => (
                <li key={maker.handle}>
                  <Link to="/u/$handle" params={{ handle: maker.handle }} className="flex min-h-11 items-center text-sm">
                    {maker.displayName}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </aside>
    </div>
  );
}

function ProfileForm({
  initial,
  fallbackName,
  onSaved,
}: {
  initial: Mine["profile"];
  fallbackName: string;
  onSaved: (handle: string) => Promise<void>;
}) {
  const [displayName, setDisplayName] = useState(initial?.displayName || fallbackName);
  const [handle, setHandle] = useState(initial?.handle || slugHandle(fallbackName));
  const [role, setRole] = useState(initial?.role ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [bio, setBio] = useState(initial?.bio ?? "");
  const [website, setWebsite] = useState(initial?.website ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!initial) return;
    setDisplayName(initial.displayName);
    setHandle(initial.handle);
    setRole(initial.role);
    setLocation(initial.location);
    setBio(initial.bio);
    setWebsite(initial.website);
  }, [initial]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const result = await saveProfile({
      data: { displayName, handle, role, location, bio, website },
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    await onSaved(result.handle);
  }

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="mt-8 max-w-xl space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name">
          <TextInput value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={60} />
        </Field>
        <Field label="Handle">
          <TextInput value={handle} onChange={(event) => setHandle(slugHandle(event.target.value))} maxLength={24} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Role">
          <TextInput value={role} onChange={(event) => setRole(event.target.value)} maxLength={60} placeholder="Systems" />
        </Field>
        <Field label="Location">
          <TextInput value={location} onChange={(event) => setLocation(event.target.value)} maxLength={60} />
        </Field>
      </div>
      <Field label="Bio">
        <TextArea value={bio} onChange={(event) => setBio(event.target.value)} className="min-h-24" maxLength={280} />
      </Field>
      <Field label="Website" hint="Optional. http or https.">
        <TextInput value={website} onChange={(event) => setWebsite(event.target.value)} placeholder="https://" />
      </Field>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <Button type="submit" disabled={busy}>
        {busy ? "Saving…" : initial ? "Save bench" : "Claim handle"}
      </Button>
    </form>
  );
}
