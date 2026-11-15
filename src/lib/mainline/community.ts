import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql, type Sql } from "@/lib/db";
import { cleanTags, safeHttpUrl } from "@/lib/mainline/text";
import type {
  ActivityItem,
  BuildUpdate,
  CollabInterest,
  CollabPost,
  CommunityNotification,
  Prompt,
  PromptEntry,
} from "@/lib/mainline/types";

type Row = Record<string, unknown>;

function text(value: unknown): string {
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  if (value == null) return "";
  return String(value);
}

function num(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function tagsOf(value: unknown): string[] {
  return text(value)
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const PROMPT_CATALOG = [
  {
    title: "Build a tiny local-first tool",
    description: "Make a useful tool that works offline and keeps its data in a format people can inspect.",
    skills: ["offline", "local-first", "storage"],
  },
  {
    title: "Make logs useful",
    description: "Build a small tool that turns noisy logs into one clear answer or next action.",
    skills: ["observability", "cli", "debugging"],
  },
  {
    title: "Search beyond exact words",
    description: "Create a search experience that helps someone find an idea even when they use different words.",
    skills: ["search", "ranking", "ux"],
  },
  {
    title: "Give a command-line tool a human touch",
    description: "Build a CLI that makes one difficult workflow easier to understand and recover from.",
    skills: ["cli", "accessibility", "design"],
  },
  {
    title: "Make a slow task feel fast",
    description: "Improve a real workflow with caching, streaming, or a more responsive interface.",
    skills: ["performance", "ux", "systems"],
  },
  {
    title: "Build a tiny code-reading tool",
    description: "Help developers understand a symbol, a diff, or a dependency without leaving their workflow.",
    skills: ["developer-tools", "code", "search"],
  },
  {
    title: "Make data easier to trust",
    description: "Build a small tool that makes the origin, freshness, or quality of data obvious.",
    skills: ["data", "reliability", "visualization"],
  },
  {
    title: "Ship a thoughtful empty state",
    description: "Turn a blank screen into a useful first step in a small app or developer tool.",
    skills: ["frontend", "product-design", "onboarding"],
  },
] as const;

function currentPrompt(now = new Date()): Prompt {
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const daysSinceMonday = (date.getUTCDay() + 6) % 7;
  const monday = new Date(date.getTime() - daysSinceMonday * 24 * 60 * 60 * 1000);
  const weeksSinceEpoch = Math.floor((monday.getTime() - Date.UTC(2024, 0, 1)) / WEEK_MS);
  const challenge = PROMPT_CATALOG[((weeksSinceEpoch % PROMPT_CATALOG.length) + PROMPT_CATALOG.length) % PROMPT_CATALOG.length];
  const thursday = new Date(monday.getTime() + 3 * 24 * 60 * 60 * 1000);
  const weekYear = thursday.getUTCFullYear();
  const jan4 = Date.UTC(weekYear, 0, 4);
  const firstMonday = jan4 - ((new Date(jan4).getUTCDay() + 6) % 7) * 24 * 60 * 60 * 1000;
  const weekNumber = Math.floor((monday.getTime() - firstMonday) / WEEK_MS) + 1;
  const nextMonday = new Date(monday.getTime() + WEEK_MS);
  const endDate = new Date(nextMonday.getTime() - 24 * 60 * 60 * 1000);
  return {
    key: `${weekYear}-W${String(weekNumber).padStart(2, "0")}`,
    ...challenge,
    skills: [...challenge.skills],
    weekLabel: `${monday.toLocaleDateString("en", { month: "short", day: "numeric", timeZone: "UTC" })} – ${endDate.toLocaleDateString("en", { month: "short", day: "numeric", timeZone: "UTC" })}`,
    endsAt: nextMonday.toISOString(),
  };
}

export async function notifyFollowers(
  sql: Sql,
  actorId: string,
  kind: string,
  projectId: string | null = null,
  updateId: string | null = null,
) {
  await sql.query(
    `insert into notifications (id, user_id, actor_id, kind, project_id, update_id)
     select $1 || ':' || f.follower_id, f.follower_id, $2, $3, $4, $5
     from follows f
     where f.following_id = $2 and f.follower_id <> $2`,
    [crypto.randomUUID(), actorId, kind, projectId, updateId],
  );
}

export const listFollowingActivity = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<ActivityItem[]> => {
    const sql = await getSql();
    const rows = await sql<Row>`
      select * from (
        select 'project' as kind, p.id, p.created_at, p.id as project_id,
          p.title as project_title, p.summary, p.language, '' as body,
          a.handle, a.display_name
        from projects p
        join profiles a on a.user_id = p.user_id
        join follows f on f.following_id = p.user_id
        where f.follower_id = ${context.userId}
        union all
        select 'update' as kind, u.id, u.created_at, p.id as project_id,
          p.title as project_title, p.summary, p.language, u.body,
          a.handle, a.display_name
        from build_updates u
        join projects p on p.id = u.project_id
        join profiles a on a.user_id = u.user_id
        join follows f on f.following_id = u.user_id
        where f.follower_id = ${context.userId}
      ) activity
      order by created_at desc
      limit 60
    `;
    return rows.map((row) => ({
      id: text(row.id),
      kind: text(row.kind) === "update" ? "update" : "project",
      createdAt: text(row.created_at),
      projectId: text(row.project_id),
      projectTitle: text(row.project_title),
      summary: text(row.summary),
      language: text(row.language),
      body: text(row.body),
      authorHandle: text(row.handle),
      authorName: text(row.display_name),
    }));
  });

export const listProjectUpdates = createServerFn({ method: "GET" })
  .validator((id: unknown) => text(id).slice(0, 80))
  .handler(async ({ data: projectId }): Promise<BuildUpdate[]> => {
    const sql = await getSql();
    const rows = await sql<Row>`
      select u.id, u.body, u.created_at, a.handle, a.display_name
      from build_updates u
      join profiles a on a.user_id = u.user_id
      where u.project_id = ${projectId}
      order by u.created_at desc
      limit 40
    `;
    return rows.map((row) => ({
      id: text(row.id),
      body: text(row.body),
      createdAt: text(row.created_at),
      authorHandle: text(row.handle),
      authorName: text(row.display_name),
    }));
  });

export const createBuildUpdate = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = (input ?? {}) as { projectId?: unknown; body?: unknown };
    return {
      projectId: text(raw.projectId).slice(0, 80),
      body: text(raw.body).trim().slice(0, 800),
    };
  })
  .handler(async ({ context, data }) => {
    if (data.body.length < 8) return { ok: false as const, error: "Add a little more detail to your update." };
    const sql = await getSql();
    const project = await sql<{ id: string }>`
      select id from projects where id = ${data.projectId} and user_id = ${context.userId}
    `;
    if (!project[0]) return { ok: false as const, error: "Only the project maker can post a build update." };
    const id = crypto.randomUUID();
    await sql`
      insert into build_updates (id, project_id, user_id, body)
      values (${id}, ${data.projectId}, ${context.userId}, ${data.body})
    `;
    await notifyFollowers(sql, context.userId, "update", data.projectId, id);
    return { ok: true as const, id };
  });

export const listCollabPosts = createServerFn({ method: "GET" })
  .validator((input: unknown) => {
    const raw = (input ?? {}) as { q?: unknown; status?: unknown };
    const status = raw.status === "closed" ? "closed" : raw.status === "all" ? "all" : "open";
    return { q: text(raw.q).trim().slice(0, 80), status } as const;
  })
  .handler(async ({ data }): Promise<CollabPost[]> => {
    const sql = await getSql();
    const pattern = `%${data.q.replace(/[%_\\]/g, "")}%`;
    const rows = await sql.query<Row>(
      `select c.id, c.user_id, c.project_id, c.title, c.description, c.skills, c.status, c.created_at,
         a.handle, a.display_name, p.title as project_title,
         (select count(*)::int from collab_interests i where i.post_id = c.id) as interest_count
       from collab_posts c
       join profiles a on a.user_id = c.user_id
       left join projects p on p.id = c.project_id
       where ($1 = 'all' or c.status = $1)
         and ($2 = '' or c.title ilike $3 or c.description ilike $3 or c.skills ilike $3)
       order by case when c.status = 'open' then 0 else 1 end, c.created_at desc
       limit 60`,
      [data.status, data.q, pattern],
    );
    return rows.map((row) => ({
      id: text(row.id),
      title: text(row.title),
      description: text(row.description),
      skills: tagsOf(row.skills),
      status: text(row.status) === "closed" ? "closed" : "open",
      createdAt: text(row.created_at),
      authorUserId: text(row.user_id),
      authorHandle: text(row.handle),
      authorName: text(row.display_name),
      projectId: text(row.project_id),
      projectTitle: text(row.project_title),
      interestCount: num(row.interest_count),
    }));
  });

export const myCollabState = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<{ ownedIds: string[]; interestedIds: string[]; received: CollabInterest[] }> => {
    const sql = await getSql();
    const [posts, interests, received] = await Promise.all([
      sql<{ id: string }>`select id from collab_posts where user_id = ${context.userId}`,
      sql<{ post_id: string }>`select post_id from collab_interests where user_id = ${context.userId}`,
      sql<Row>`
        select i.post_id, i.message, i.created_at, a.handle, a.display_name
        from collab_interests i
        join collab_posts c on c.id = i.post_id
        join profiles a on a.user_id = i.user_id
        where c.user_id = ${context.userId}
        order by i.created_at desc
      `,
    ]);
    return {
      ownedIds: posts.map((row) => text(row.id)),
      interestedIds: interests.map((row) => text(row.post_id)),
      received: received.map((row) => ({
        postId: text(row.post_id),
        message: text(row.message),
        createdAt: text(row.created_at),
        authorHandle: text(row.handle),
        authorName: text(row.display_name),
      })),
    };
  });

export const createCollabPost = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = (input ?? {}) as Record<string, unknown>;
    return {
      title: text(raw.title).trim().slice(0, 100),
      description: text(raw.description).trim().slice(0, 1000),
      skills: cleanTags(text(raw.skills)).join(","),
      projectId: text(raw.projectId).trim().slice(0, 80),
    };
  })
  .handler(async ({ context, data }) => {
    if (data.title.length < 5) return { ok: false as const, error: "Give the collaboration request a clear title." };
    if (data.description.length < 20) return { ok: false as const, error: "Describe what you need and how someone can help." };
    if (data.skills.length === 0) return { ok: false as const, error: "Add at least one skill or topic." };
    const sql = await getSql();
    const profile = await sql`select user_id from profiles where user_id = ${context.userId}`;
    if (!profile[0]) return { ok: false as const, error: "Claim a handle on your bench before posting." };
    if (data.projectId) {
      const project = await sql`select id from projects where id = ${data.projectId} and user_id = ${context.userId}`;
      if (!project[0]) return { ok: false as const, error: "Link one of your own projects." };
    }
    const id = crypto.randomUUID();
    await sql`
      insert into collab_posts (id, user_id, project_id, title, description, skills)
      values (${id}, ${context.userId}, ${data.projectId || null}, ${data.title}, ${data.description}, ${data.skills})
    `;
    return { ok: true as const, id };
  });

export const setCollabPostStatus = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = (input ?? {}) as { id?: unknown; status?: unknown };
    return {
      id: text(raw.id).slice(0, 80),
      status: raw.status === "closed" ? "closed" : "open",
    } as const;
  })
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const rows = await sql<{ id: string }>`
      update collab_posts set status = ${data.status}, updated_at = now()
      where id = ${data.id} and user_id = ${context.userId}
      returning id
    `;
    if (!rows[0]) return { ok: false as const, error: "That collaboration post is not yours to change." };
    return { ok: true as const };
  });

export const expressCollabInterest = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = (input ?? {}) as { postId?: unknown; message?: unknown };
    return {
      postId: text(raw.postId).slice(0, 80),
      message: text(raw.message).trim().slice(0, 400),
    };
  })
  .handler(async ({ context, data }) => {
    if (data.message.length < 10) return { ok: false as const, error: "Add a short note about how you can help." };
    const sql = await getSql();
    const rows = await sql<{ user_id: string }>`
      select user_id from collab_posts where id = ${data.postId} and status = 'open'
    `;
    if (!rows[0]) return { ok: false as const, error: "That collaboration request is no longer open." };
    if (rows[0].user_id === context.userId) return { ok: false as const, error: "You cannot respond to your own request." };
    const profile = await sql`select user_id from profiles where user_id = ${context.userId}`;
    if (!profile[0]) return { ok: false as const, error: "Claim a handle on your bench before reaching out." };
    const inserted = await sql<{ id: string }>`
      insert into collab_interests (id, post_id, user_id, message)
      values (${crypto.randomUUID()}, ${data.postId}, ${context.userId}, ${data.message})
      on conflict (post_id, user_id) do nothing
      returning id
    `;
    if (!inserted[0]) return { ok: false as const, error: "You have already reached out about this request." };
    await sql`
      insert into notifications (id, user_id, actor_id, kind, collab_post_id)
      values (${crypto.randomUUID()}, ${rows[0].user_id}, ${context.userId}, 'collab_interest', ${data.postId})
    `;
    return { ok: true as const };
  });

export const getWeeklyPrompt = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ prompt: Prompt; entries: PromptEntry[] }> => {
    const prompt = currentPrompt();
    const sql = await getSql();
    const rows = await sql<Row>`
      select e.id, e.user_id, e.body, e.repo_url, e.created_at, e.project_id, p.title as project_title,
        a.handle, a.display_name,
        (select count(*)::int from prompt_votes v where v.entry_id = e.id) as vote_count
      from prompt_entries e
      join profiles a on a.user_id = e.user_id
      left join projects p on p.id = e.project_id
      where e.prompt_key = ${prompt.key}
      order by vote_count desc, e.created_at desc
      limit 100
    `;
    return {
      prompt,
      entries: rows.map((row) => ({
        id: text(row.id),
        body: text(row.body),
        repoUrl: text(row.repo_url),
        createdAt: text(row.created_at),
        authorUserId: text(row.user_id),
        authorHandle: text(row.handle),
        authorName: text(row.display_name),
        projectId: text(row.project_id),
        projectTitle: text(row.project_title),
        voteCount: num(row.vote_count),
        voted: false,
      })),
    };
  },
);

export const getMyPromptVotes = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((ids: unknown) => (Array.isArray(ids) ? ids.map((id) => text(id).slice(0, 80)).slice(0, 100) : []))
  .handler(async ({ context, data }) => {
    if (data.length === 0) return [];
    const sql = await getSql();
    const rows = await sql.query<{ entry_id: string }>(
      "select entry_id from prompt_votes where user_id = $1 and entry_id = any($2)",
      [context.userId, data],
    );
    return rows.map((row) => text(row.entry_id));
  });

export const submitPromptEntry = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = (input ?? {}) as { promptKey?: unknown; body?: unknown; repoUrl?: unknown; projectId?: unknown };
    return {
      promptKey: text(raw.promptKey).slice(0, 16),
      body: text(raw.body).trim().slice(0, 800),
      repoUrl: text(raw.repoUrl).trim().slice(0, 200),
      projectId: text(raw.projectId).slice(0, 80),
    };
  })
  .handler(async ({ context, data }) => {
    if (data.promptKey !== currentPrompt().key) return { ok: false as const, error: "This week's prompt has changed. Refresh and try again." };
    if (data.body.length < 10) return { ok: false as const, error: "Share at least a sentence about your approach." };
    if (data.repoUrl && !safeHttpUrl(data.repoUrl)) return { ok: false as const, error: "Use a valid http or https project link." };
    const sql = await getSql();
    const profile = await sql`select user_id from profiles where user_id = ${context.userId}`;
    if (!profile[0]) return { ok: false as const, error: "Claim a handle on your bench before submitting." };
    if (data.projectId) {
      const project = await sql`select id from projects where id = ${data.projectId}`;
      if (!project[0]) return { ok: false as const, error: "Choose a project that is on the record." };
    }
    const entryId = crypto.randomUUID();
    const rows = await sql<{ id: string }>`
      insert into prompt_entries (id, prompt_key, user_id, project_id, body, repo_url)
      values (${entryId}, ${data.promptKey}, ${context.userId}, ${data.projectId || null}, ${data.body}, ${safeHttpUrl(data.repoUrl) ?? ""})
      on conflict (prompt_key, user_id) do update
      set project_id = excluded.project_id, body = excluded.body, repo_url = excluded.repo_url
      returning id
    `;
    return { ok: true as const, id: text(rows[0]?.id) };
  });

export const togglePromptVote = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: unknown) => text(id).slice(0, 80))
  .handler(async ({ context, data: entryId }) => {
    const sql = await getSql();
    const entry = await sql<{ id: string; user_id: string }>`
      select id, user_id from prompt_entries where id = ${entryId} and prompt_key = ${currentPrompt().key}
    `;
    if (!entry[0]) return { ok: false as const, error: "That submission is no longer available." };
    if (entry[0].user_id === context.userId) return { ok: false as const, error: "You cannot vote for your own submission." };
    const existing = await sql`
      select entry_id from prompt_votes where entry_id = ${entryId} and user_id = ${context.userId}
    `;
    if (existing[0]) {
      await sql`delete from prompt_votes where entry_id = ${entryId} and user_id = ${context.userId}`;
    } else {
      await sql`insert into prompt_votes (entry_id, user_id) values (${entryId}, ${context.userId})`;
    }
    const count = await sql<{ n: number }>`select count(*)::int as n from prompt_votes where entry_id = ${entryId}`;
    return { ok: true as const, voted: !existing[0], voteCount: num(count[0]?.n) };
  });

export const listNotifications = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<CommunityNotification[]> => {
    const sql = await getSql();
    const rows = await sql<Row>`
      select n.id, n.kind, n.created_at, n.read_at, n.project_id, n.update_id, n.collab_post_id,
        a.handle, a.display_name, p.title as project_title
      from notifications n
      left join profiles a on a.user_id = n.actor_id
      left join projects p on p.id = n.project_id
      where n.user_id = ${context.userId}
      order by n.created_at desc
      limit 100
    `;
    return rows.map((row) => ({
      id: text(row.id),
      kind: text(row.kind),
      createdAt: text(row.created_at),
      readAt: text(row.read_at),
      actorHandle: text(row.handle),
      actorName: text(row.display_name),
      projectId: text(row.project_id),
      projectTitle: text(row.project_title),
      updateId: text(row.update_id),
      collabPostId: text(row.collab_post_id),
    }));
  });

export const unreadNotificationCount = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql<{ n: number }>`
      select count(*)::int as n from notifications
      where user_id = ${context.userId} and read_at is null
    `;
    return num(rows[0]?.n);
  });

export const markNotificationsRead = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: unknown) => text(id).slice(0, 80))
  .handler(async ({ context, data: id }) => {
    const sql = await getSql();
    if (id) {
      await sql`
        update notifications set read_at = now()
        where id = ${id} and user_id = ${context.userId} and read_at is null
      `;
    } else {
      await sql`
        update notifications set read_at = now()
        where user_id = ${context.userId} and read_at is null
      `;
    }
    return { ok: true as const };
  });
