import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Compass, Plus, SquarePen, UserRound } from "lucide-react";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { cn } from "@/lib/cn";

const NAV = [
  { to: "/", label: "Record", icon: SquarePen, match: (path: string) => path === "/" },
  { to: "/explore", label: "Index", icon: Compass, match: (path: string) => path.startsWith("/explore") },
  { to: "/new", label: "Publish", icon: Plus, match: (path: string) => path.startsWith("/new") },
  { to: "/you", label: "Bench", icon: UserRound, match: (path: string) => path.startsWith("/you") },
] as const;

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-line bg-bg">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <Link to="/" search={{ q: "", lang: "", sort: "new" }} className="flex min-h-11 items-center gap-2">
            <Mark />
            <span className="font-display text-xl tracking-tight text-fg">Mainline</span>
          </Link>
          <nav className="hidden items-center gap-1 sm:flex">
            <Link to="/explore" className="inline-flex min-h-11 items-center px-2 text-sm text-muted hover:text-fg">
              Index
            </Link>
            <Link to="/you" className="inline-flex min-h-11 items-center px-2 text-sm text-muted hover:text-fg">
              Bench
            </Link>
          </nav>
          <SearchBox />
          <Link
            to="/new"
            className="press hidden min-h-11 items-center gap-2 rounded-sm bg-accent px-4 text-sm font-medium text-accent-fg sm:inline-flex"
          >
            <Plus className="size-4" />
            Publish
          </Link>
          <AuthSlot />
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-4 pt-8 pb-28 sm:pb-16">{children}</div>
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg sm:hidden">
        <ul className="grid grid-cols-4">
          {NAV.map((item) => (
            <NavItem key={item.to} {...item} />
          ))}
        </ul>
      </nav>
    </div>
  );
}

function Mark() {
  return (
    <span className="relative grid h-8 w-8 place-items-center border border-line bg-surface" aria-hidden="true">
      <span className="absolute top-2 right-1.5 left-1.5 h-px bg-fg" />
      <span className="font-display text-sm leading-none text-fg">M</span>
    </span>
  );
}

function SearchBox() {
  const navigate = useNavigate();
  const raw = useRouterState({ select: (state) => state.location.search }) as { q?: unknown };
  const initial = typeof raw?.q === "string" ? raw.q : "";
  const [value, setValue] = useState(initial);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void navigate({
      to: "/",
      search: { q: value.trim(), lang: "", sort: "new" },
    });
  }

  return (
    <form onSubmit={onSubmit} className="ml-auto hidden min-w-0 flex-1 sm:block sm:max-w-xs">
      <label className="sr-only" htmlFor="record-search">
        Search the record
      </label>
      <input
        id="record-search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Search projects"
        className="min-h-11 w-full rounded-sm border border-line bg-surface px-3 text-base text-fg placeholder:text-subtle"
      />
    </form>
  );
}

function AuthSlot() {
  const { user, isPending } = useCurrentUserState();
  if (isPending) return <div className="h-9 w-9 animate-pulse rounded-full bg-elevated" />;
  if (!user) {
    return (
      <Link to="/login" className="inline-flex min-h-11 items-center px-2 text-sm text-muted hover:text-fg">
        Sign in
      </Link>
    );
  }
  return (
    <div className="max-w-[40vw] sm:max-w-none [&_span]:truncate">
      <UserButton />
    </div>
  );
}

function NavItem({
  to,
  label,
  icon: Icon,
  match,
}: {
  to: (typeof NAV)[number]["to"];
  label: string;
  icon: (typeof NAV)[number]["icon"];
  match: (path: string) => boolean;
}) {
  const path = useRouterState({ select: (state) => state.location.pathname });
  const active = match(path);
  const className = cn(
    "flex min-h-14 flex-col items-center justify-center gap-1 text-xs",
    active ? "text-fg" : "text-subtle",
  );
  if (to === "/") {
    return (
      <li>
        <Link to="/" search={{ q: "", lang: "", sort: "new" }} className={className}>
          <Icon className="size-4" strokeWidth={1.75} />
          {label}
        </Link>
      </li>
    );
  }
  return (
    <li>
      <Link to={to} className={className}>
        <Icon className="size-4" strokeWidth={1.75} />
        {label}
      </Link>
    </li>
  );
}

export function MobileSearch() {
  const navigate = useNavigate();
  const [value, setValue] = useState("");
  return (
    <form
      className="mb-6 sm:hidden"
      onSubmit={(event) => {
        event.preventDefault();
        void navigate({ to: "/", search: { q: value.trim(), lang: "", sort: "new" } });
      }}
    >
      <label className="sr-only" htmlFor="mobile-search">
        Search the record
      </label>
      <input
        id="mobile-search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Search projects"
        className="min-h-11 w-full rounded-sm border border-line bg-surface px-3 text-base text-fg placeholder:text-subtle"
      />
    </form>
  );
}
