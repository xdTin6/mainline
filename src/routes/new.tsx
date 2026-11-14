import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Cover } from "@/components/cover";
import { Shell } from "@/components/shell";
import { SignInPanel } from "@/components/sign-in-panel";
import { Button, Field, TextArea, TextInput } from "@/components/ui";
import { SignInGate } from "@/lib/auth/gates";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { getMine, publishProject } from "@/lib/mainline/api";
import { LANGUAGES } from "@/lib/mainline/types";
import { slugHandle } from "@/lib/mainline/text";

export const Route = createFileRoute("/new")({
  component: NewPage,
});

function NewPage() {
  return (
    <Shell>
      <SignInGate fallback={<SignInPanel title="Sign in to publish" />}>
        <Composer />
      </SignInGate>
    </Shell>
  );
}

function Composer() {
  const user = useCurrentUser();
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [handle, setHandle] = useState(slugHandle(user?.displayName ?? ""));
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [body, setBody] = useState("");
  const [language, setLanguage] = useState<string>(LANGUAGES[0]);
  const [tags, setTags] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [demoUrl, setDemoUrl] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancel = false;
    getMine()
      .then((mine) => {
        if (cancel) return;
        if (mine.profile) {
          setHasProfile(true);
          setDisplayName(mine.profile.displayName);
          setHandle(mine.profile.handle);
        }
        setReady(true);
      })
      .catch(() => {
        if (!cancel) setReady(true);
      });
    return () => {
      cancel = true;
    };
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const result = await publishProject({
      data: { title, summary, body, language, tags, repoUrl, demoUrl, displayName, handle },
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast("Published to the record.");
    await navigate({ to: "/project/$id", params: { id: result.id } });
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="min-w-0">
        <h1 className="font-display text-4xl tracking-tight sm:text-5xl">Publish a project</h1>
        <p className="mt-3 max-w-xl text-muted">
          One project, described well. Title, what it does, and the writeup you would send a peer.
        </p>
        {!ready ? <div className="mt-8 h-40 animate-pulse rounded-xl bg-elevated" /> : null}
        {ready ? (
          <form onSubmit={(event) => void onSubmit(event)} className="mt-8 space-y-5">
            {hasProfile ? (
              <p className="text-sm text-muted">
                Publishing as <span className="text-fg">@{handle}</span>
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Name">
                  <TextInput
                    value={displayName}
                    onChange={(event) => {
                      setDisplayName(event.target.value);
                      if (!handle || handle === slugHandle(displayName)) setHandle(slugHandle(event.target.value));
                    }}
                    maxLength={60}
                  />
                </Field>
                <Field label="Handle" hint="Shown as @handle on your bench.">
                  <TextInput value={handle} onChange={(event) => setHandle(slugHandle(event.target.value))} maxLength={24} />
                </Field>
              </div>
            )}
            <Field label="Title">
              <TextInput value={title} onChange={(event) => setTitle(event.target.value)} maxLength={80} />
            </Field>
            <Field label="Summary" hint="One sentence. It is what the record shows first.">
              <TextArea value={summary} onChange={(event) => setSummary(event.target.value)} className="min-h-24" maxLength={240} />
            </Field>
            <Field label="Writeup" hint="Blank line between paragraphs. Use three backticks for code.">
              <TextArea value={body} onChange={(event) => setBody(event.target.value)} className="min-h-48" maxLength={8000} />
            </Field>
            <Field label="Language">
              <div className="flex flex-wrap gap-2">
                {LANGUAGES.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setLanguage(item)}
                    className={
                      item === language
                        ? "press min-h-11 rounded-sm border border-fg bg-fg px-3 text-sm text-accent-fg"
                        : "press min-h-11 rounded-sm border border-line px-3 text-sm text-muted"
                    }
                  >
                    {item}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Tags" hint="Comma separated. Six at most.">
              <TextInput value={tags} onChange={(event) => setTags(event.target.value)} placeholder="sync, files" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Repository" hint="Optional.">
                <TextInput value={repoUrl} onChange={(event) => setRepoUrl(event.target.value)} placeholder="https://" />
              </Field>
              <Field label="Live demo" hint="Optional.">
                <TextInput value={demoUrl} onChange={(event) => setDemoUrl(event.target.value)} placeholder="https://" />
              </Field>
            </div>
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            <Button type="submit" disabled={busy}>
              {busy ? "Publishing…" : "Publish"}
            </Button>
          </form>
        ) : null}
      </div>
      <aside className="hidden lg:block">
        <p className="text-sm text-subtle">Preview</p>
        <article className="mt-3 overflow-hidden rounded-xl border border-line bg-surface">
          <Cover id={title || "draft"} language={language} className="h-28" />
          <div className="p-4">
            <h2 className="font-display text-2xl tracking-tight">{title || "Untitled project"}</h2>
            <p className="mt-2 text-sm text-muted">{summary || "The summary shows up here."}</p>
          </div>
        </article>
      </aside>
    </div>
  );
}
