import { createFileRoute, Link } from "@tanstack/react-router";
import { SignInPanel } from "@/components/sign-in-panel";
import { Shell } from "@/components/shell";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { user, isPending } = useCurrentUserState();
  return (
    <Shell>
      {isPending ? (
        <div className="mx-auto h-48 max-w-md animate-pulse rounded-xl bg-elevated" />
      ) : user ? (
        <div className="mx-auto max-w-md">
          <h1 className="font-display text-4xl tracking-tight">You are signed in.</h1>
          <p className="mt-3 text-muted">The record is open. Publish when you have something that runs.</p>
          <Link to="/" search={{ q: "", lang: "", sort: "new" }} className="mt-6 inline-flex min-h-11 items-center text-sm text-fg underline decoration-line underline-offset-4">
            Back to the record
          </Link>
        </div>
      ) : (
        <SignInPanel title="Sign in" />
      )}
    </Shell>
  );
}
