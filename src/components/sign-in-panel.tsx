import { GROK_PROVIDERS, authEnabled, signIn } from "@/lib/auth/client";

export function SignInPanel({ title = "Sign in to publish" }: { title?: string }) {
  return (
    <div className="mx-auto w-full max-w-md rounded-xl border border-line bg-surface p-6">
      <h1 className="font-display text-3xl tracking-tight text-fg">{title}</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        The record is public. Sign in only to put your name on a project, a star, or a note.
      </p>
      {authEnabled ? (
        <div className="mt-6 flex flex-col gap-3">
          {GROK_PROVIDERS.map((provider) => (
            <button
              key={provider.providerId}
              type="button"
              onClick={() => signIn(provider.providerId, { callbackURL: "/" })}
              className="press min-h-11 rounded-sm border border-line bg-bg px-4 text-sm font-medium text-fg hover:bg-elevated"
            >
              Continue with {provider.label}
            </button>
          ))}
        </div>
      ) : (
        <p className="mt-6 text-sm text-subtle">Sign-in is not available right now.</p>
      )}
    </div>
  );
}
