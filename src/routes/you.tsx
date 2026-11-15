import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Camera, ImagePlus, Trash2 } from "lucide-react";
import { ProfileAvatar, ProfileBanner } from "@/components/cover";
import { Shell } from "@/components/shell";
import { SignInPanel } from "@/components/sign-in-panel";
import { Button, Field, TextArea, TextInput } from "@/components/ui";
import { SignInGate } from "@/lib/auth/gates";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { getMine, saveProfile } from "@/lib/mainline/api";
import { prepareProfileImage } from "@/lib/mainline/profile-image";
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
  const [avatarImage, setAvatarImage] = useState(initial?.avatarImage ?? "");
  const [bannerImage, setBannerImage] = useState(initial?.bannerImage ?? "");
  const [githubHandle, setGithubHandle] = useState(initial?.githubHandle ?? "");
  const [linkedinUrl, setLinkedinUrl] = useState(initial?.linkedinUrl ?? "");
  const [xHandle, setXHandle] = useState(initial?.xHandle ?? "");
  const [blueskyHandle, setBlueskyHandle] = useState(initial?.blueskyHandle ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [imageBusy, setImageBusy] = useState<"avatar" | "banner" | "">("");
  const [imageError, setImageError] = useState("");
  const avatarInput = useRef<HTMLInputElement>(null);
  const bannerInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!initial) return;
    setDisplayName(initial.displayName);
    setHandle(initial.handle);
    setRole(initial.role);
    setLocation(initial.location);
    setBio(initial.bio);
    setWebsite(initial.website);
    setAvatarImage(initial.avatarImage);
    setBannerImage(initial.bannerImage);
    setGithubHandle(initial.githubHandle);
    setLinkedinUrl(initial.linkedinUrl);
    setXHandle(initial.xHandle);
    setBlueskyHandle(initial.blueskyHandle);
  }, [initial]);

  async function onImageSelected(file: File, kind: "avatar" | "banner") {
    setImageBusy(kind);
    setImageError("");
    try {
      const image = await prepareProfileImage(file, kind);
      if (kind === "avatar") setAvatarImage(image);
      else setBannerImage(image);
    } catch (reason) {
      setImageError(reason instanceof Error ? reason.message : "Could not prepare this image.");
    } finally {
      setImageBusy("");
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    let result: Awaited<ReturnType<typeof saveProfile>>;
    try {
      result = await saveProfile({
        data: {
          displayName,
          handle,
          role,
          location,
          bio,
          website,
          avatarImage,
          bannerImage,
          githubHandle,
          linkedinUrl,
          xHandle,
          blueskyHandle,
        },
      });
    } catch {
      setError("Could not save your profile right now. Please try again.");
      setBusy(false);
      return;
    }
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    await onSaved(result.handle);
  }

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="mt-8 max-w-xl space-y-4">
      <div className="space-y-4 rounded-xl border border-line bg-surface p-4 sm:p-5">
        <div>
          <p className="text-sm font-medium text-fg">Profile look</p>
          <p className="mt-1 text-xs text-subtle">
            JPG, PNG, or WebP up to 10 MB. Images are cropped and compressed before saving.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <ProfileAvatar
            name={displayName || fallbackName}
            image={avatarImage}
            className="h-20 w-20 rounded-full text-3xl"
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="ghost" onClick={() => avatarInput.current?.click()} disabled={!!imageBusy}>
              <Camera className="size-4" />
              {imageBusy === "avatar" ? "Preparing…" : "Upload photo"}
            </Button>
            {avatarImage ? (
              <Button type="button" variant="quiet" onClick={() => setAvatarImage("")} aria-label="Remove profile photo">
                <Trash2 className="size-4" />
                Remove
              </Button>
            ) : null}
          </div>
          <input
            ref={avatarInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (file) void onImageSelected(file, "avatar");
              event.currentTarget.value = "";
            }}
          />
        </div>
        <Field label="Profile banner">
          <div className="relative h-28 overflow-hidden rounded-lg border border-line">
            <ProfileBanner image={bannerImage} alt="Banner preview" className="h-full w-full" />
            <div className="absolute bottom-2 right-2 flex gap-2 rounded-sm bg-bg/80 p-1">
              <Button
                type="button"
                variant="ghost"
                className="min-h-9 px-3"
                onClick={() => bannerInput.current?.click()}
                disabled={!!imageBusy}
              >
                <ImagePlus className="size-4" />
                {imageBusy === "banner" ? "Preparing…" : "Upload banner"}
              </Button>
              {bannerImage ? (
                <Button type="button" variant="ghost" className="min-h-9 px-3" onClick={() => setBannerImage("")}>
                  Remove
                </Button>
              ) : null}
            </div>
            <input
              ref={bannerInput}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (file) void onImageSelected(file, "banner");
                event.currentTarget.value = "";
              }}
            />
          </div>
        </Field>
        {imageError ? <p className="text-sm text-danger" role="alert">{imageError}</p> : null}
      </div>
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
      <div className="space-y-4 border-t border-line pt-5">
        <div>
          <p className="text-sm font-medium text-fg">Around the web</p>
          <p className="mt-1 text-xs text-subtle">Add the profiles you want other makers to find.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="GitHub" hint="Username only">
            <TextInput
              value={githubHandle}
              onChange={(event) => setGithubHandle(event.target.value)}
              placeholder="octocat"
              maxLength={39}
            />
          </Field>
          <Field label="LinkedIn" hint="Profile URL">
            <TextInput
              value={linkedinUrl}
              onChange={(event) => setLinkedinUrl(event.target.value)}
              placeholder="https://linkedin.com/in/you"
              maxLength={200}
            />
          </Field>
          <Field label="X" hint="Username only">
            <TextInput
              value={xHandle}
              onChange={(event) => setXHandle(event.target.value)}
              placeholder="yourhandle"
              maxLength={15}
            />
          </Field>
          <Field label="Bluesky" hint="Handle, with or without @">
            <TextInput
              value={blueskyHandle}
              onChange={(event) => setBlueskyHandle(event.target.value)}
              placeholder="you.bsky.social"
              maxLength={253}
            />
          </Field>
        </div>
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <Button type="submit" disabled={busy || !!imageBusy}>
        {busy ? "Saving…" : initial ? "Save bench" : "Claim handle"}
      </Button>
    </form>
  );
}
