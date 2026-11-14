import { createFileRoute, Link } from "@tanstack/react-router";
import { Shell } from "@/components/shell";
import { Monogram } from "@/components/cover";
import { listDirectory } from "@/lib/mainline/api";
import { countLabel } from "@/lib/mainline/text";

export const Route = createFileRoute("/explore")({
  loader: () => listDirectory(),
  component: ExplorePage,
});

function ExplorePage() {
  const directory = Route.useLoaderData();
  return (
    <Shell>
      <h1 className="font-display text-4xl tracking-tight sm:text-5xl">Index</h1>
      <p className="mt-3 max-w-xl text-muted">
        Stacks, makers, and the words projects use to describe themselves.
      </p>

      <section className="mt-10">
        <h2 className="text-sm text-subtle">Stacks</h2>
        <ul className="mt-3 divide-y divide-line border-y border-line">
          {directory.languages.map((language) => (
            <li key={language.name} className="grid gap-2 py-4 sm:grid-cols-[10rem_minmax(0,1fr)_auto] sm:items-baseline">
              <Link
                to="/"
                search={{ q: "", lang: language.name, sort: "new" }}
                className="font-display text-2xl text-fg"
              >
                {language.name}
              </Link>
              <Link to="/project/$id" params={{ id: language.topId }} className="min-w-0 truncate text-sm text-muted hover:text-fg">
                {language.topTitle}
              </Link>
              <span className="text-sm text-subtle tabular-nums">{countLabel(language.count, "project")}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12">
        <h2 className="text-sm text-subtle">Makers</h2>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2">
          {directory.makers.map((maker) => (
            <li key={maker.handle}>
              <Link
                to="/u/$handle"
                params={{ handle: maker.handle }}
                className="flex gap-3 rounded-xl border border-line bg-surface p-4"
              >
                <Monogram name={maker.displayName} />
                <span className="min-w-0">
                  <span className="block truncate text-fg">{maker.displayName}</span>
                  <span className="mt-1 block text-sm text-muted">{maker.role || "Builder"}</span>
                  <span className="mt-2 block text-sm text-subtle">
                    {countLabel(maker.projectCount, "project")}
                    {maker.location ? ` · ${maker.location}` : ""}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {directory.tags.length ? (
        <section className="mt-12">
          <h2 className="text-sm text-subtle">Words</h2>
          <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
            {directory.tags.map((tag) => (
              <li key={tag.name}>
                <Link
                  to="/"
                  search={{ q: tag.name, lang: "", sort: "new" }}
                  className="inline-flex min-h-11 items-center font-mono text-sm text-muted hover:text-fg"
                >
                  {tag.name}
                  <span className="ml-2 text-subtle tabular-nums">{tag.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </Shell>
  );
}
