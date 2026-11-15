import { Link } from "@tanstack/react-router";
import { Cover, ProfileAvatar } from "@/components/cover";
import { StarButton } from "@/components/star-button";
import type { ProjectCard as Project } from "@/lib/mainline/types";
import { formatDay } from "@/lib/mainline/text";
import { cn } from "@/lib/cn";

export function ProjectCard({
  project,
  starred,
  featured = false,
}: {
  project: Project;
  starred: boolean;
  featured?: boolean;
}) {
  const tags = project.tags.slice(0, 3).join(" · ");
  return (
    <article
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border border-line bg-surface",
        featured && "sm:col-span-2",
      )}
    >
      <Link
        to="/project/$id"
        params={{ id: project.id }}
        className="block min-w-0 text-fg"
      >
        <Cover id={project.id} language={project.language} className={featured ? "h-40 sm:h-52" : "h-28"} />
        <div className="p-4">
          <h2 className={cn("font-display tracking-tight text-fg", featured ? "text-4xl" : "text-2xl")}>
            {project.title}
          </h2>
          <p className={cn("mt-2 text-muted", featured ? "max-w-2xl text-base" : "text-sm")}>{project.summary}</p>
          {tags ? <p className="mt-3 font-mono text-xs text-subtle">{tags}</p> : null}
        </div>
      </Link>
      <div className="mt-auto flex items-center justify-between gap-3 px-4 pb-3">
        <Link
          to="/u/$handle"
          params={{ handle: project.authorHandle }}
          className="flex min-h-11 min-w-0 items-center gap-2 py-2 text-sm text-muted hover:text-fg"
        >
          <ProfileAvatar
            name={project.authorName}
            image={project.authorAvatarImage}
            className="h-7 w-7 rounded-full"
          />
          <span className="min-w-0 truncate">
            {project.authorName}
            <span className="text-subtle"> · {formatDay(project.updatedAt || project.createdAt)}</span>
          </span>
        </Link>
        <StarButton projectId={project.id} count={project.starCount} starred={starred} />
      </div>
    </article>
  );
}
