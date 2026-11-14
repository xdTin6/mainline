import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { cleanTags, safeHttpUrl, slugHandle } from "@/lib/mainline/text";
import { LANGUAGES, type Directory, type Mine, type Note, type Profile, type ProjectCard, type ProjectDetail } from "@/lib/mainline/types";

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
  if (Array.isArray(value)) return value.map((item) => text(item)).filter(Boolean);
  return text(value)
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function card(row: Row): ProjectCard {
  return {
    id: text(row.id),
    title: text(row.title),
    summary: text(row.summary),
    language: text(row.language),
    tags: tagsOf(row.tags),
    repoUrl: text(row.repo_url),
    demoUrl: text(row.demo_url),
    createdAt: text(row.created_at),
    starCount: num(row.star_count),
    noteCount: num(row.note_count),
    authorHandle: text(row.handle),
    authorName: text(row.display_name),
    authorRole: text(row.role),
  };
}

const FEED_SELECT = `
  select
    p.id, p.title, p.summary, p.language, p.tags, p.repo_url, p.demo_url, p.created_at,
    a.handle, a.display_name, a.role,
    (select count(*)::int from stars s where s.project_id = p.id) as star_count,
    (select count(*)::int from notes n where n.project_id = p.id) as note_count
  from projects p
  join profiles a on a.user_id = p.user_id
`;

function feedQuery(sort: "new" | "stars") {
  const order = sort === "stars" ? "star_count desc, created_at desc" : "created_at desc";
  return `
    select * from (${FEED_SELECT}) t
    where ($1 = '' or language = $1)
      and (
        $2 = ''
        or title ilike $3
        or summary ilike $3
        or display_name ilike $3
        or tags ilike $3
        or role ilike $3
      )
    order by ${order}
    limit 60
  `;
}

export const listFeed = createServerFn({ method: "GET" })
  .validator((input: unknown) => {
    const raw = (input ?? {}) as { q?: unknown; lang?: unknown; sort?: unknown };
    const q = text(raw.q).trim().slice(0, 80);
    const lang = text(raw.lang).trim().slice(0, 40);
    const sort = raw.sort === "stars" ? "stars" : "new";
    return { q, lang, sort } as const;
  })
  .handler(async ({ data }) => {
    const sql = await getSql();
    const pattern = `%${data.q.replace(/[%_\\]/g, "")}%`;
    const rows = await sql.query<Row>(feedQuery(data.sort), [data.lang, data.q, pattern]);
    return rows.map(card);
  });

export const listDirectory = createServerFn({ method: "GET" }).handler(async (): Promise<Directory> => {
  const sql = await getSql();
  const [projects, makers] = await Promise.all([
    sql<Row>`
      select p.id, p.title, p.language, p.tags,
        (select count(*)::int from stars s where s.project_id = p.id) as star_count
      from projects p
    `,
    sql<Row>`
      select a.handle, a.display_name, a.role, a.bio, a.location,
        (select count(*)::int from projects p where p.user_id = a.user_id) as project_count,
        (select count(*)::int from follows f where f.following_id = a.user_id) as follower_count
      from profiles a
      order by follower_count desc, display_name asc
      limit 24
    `,
  ]);

  const byLang = new Map<string, { count: number; topId: string; topTitle: string; stars: number }>();
  const tagCounts = new Map<string, number>();
  for (const row of projects) {
    const language = text(row.language);
    const stars = num(row.star_count);
    const current = byLang.get(language);
    if (!current) {
      byLang.set(language, { count: 1, topId: text(row.id), topTitle: text(row.title), stars });
    } else {
      current.count += 1;
      if (stars > current.stars) {
        current.stars = stars;
        current.topId = text(row.id);
        current.topTitle = text(row.title);
      }
    }
    for (const tag of tagsOf(row.tags)) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }

  return {
    projectCount: projects.length,
    languages: [...byLang.entries()]
      .map(([name, stat]) => ({ name, count: stat.count, topId: stat.topId, topTitle: stat.topTitle }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    tags: [...tagCounts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, 24),
    makers: makers.map((row) => ({
      handle: text(row.handle),
      displayName: text(row.display_name),
      role: text(row.role),
      bio: text(row.bio),
      location: text(row.location),
      projectCount: num(row.project_count),
      followerCount: num(row.follower_count),
    })),
  };
});

export const getProject = createServerFn({ method: "GET" })
  .validator((id: unknown) => text(id).slice(0, 80))
  .handler(async ({ data: id }): Promise<{ project: ProjectDetail; notes: Note[] } | null> => {
    const sql = await getSql();
    const rows = await sql<Row>`
      select p.id, p.user_id, p.title, p.summary, p.body, p.language, p.tags,
        p.repo_url, p.demo_url, p.created_at,
        a.handle, a.display_name, a.role, a.bio, a.location,
        (select count(*)::int from stars s where s.project_id = p.id) as star_count,
        (select count(*)::int from notes n where n.project_id = p.id) as note_count
      from projects p
      join profiles a on a.user_id = p.user_id
      where p.id = ${id}
    `;
    const row = rows[0];
    if (!row) return null;
    const notes = await sql<Row>`
      select n.id, n.body, n.created_at, n.user_id, a.handle, a.display_name
      from notes n
      join profiles a on a.user_id = n.user_id
      where n.project_id = ${id}
      order by n.created_at asc
    `;
    const base = card(row);
    return {
      project: {
        ...base,
        body: text(row.body),
        authorUserId: text(row.user_id),
        authorBio: text(row.bio),
        authorLocation: text(row.location),
      },
      notes: notes.map((note) => ({
        id: text(note.id),
        body: text(note.body),
        createdAt: text(note.created_at),
        authorUserId: text(note.user_id),
        authorHandle: text(note.handle),
        authorName: text(note.display_name),
      })),
    };
  });

export const getProfile = createServerFn({ method: "GET" })
  .validator((handle: unknown) => text(handle).slice(0, 40))
  .handler(async ({ data: handle }): Promise<Profile | null> => {
    const sql = await getSql();
    const rows = await sql<Row>`
      select a.user_id, a.handle, a.display_name, a.bio, a.role, a.location, a.website,
        (select count(*)::int from follows f where f.following_id = a.user_id) as follower_count,
        (select count(*)::int from follows f where f.follower_id = a.user_id) as following_count
      from profiles a
      where a.handle = ${handle}
    `;
    const row = rows[0];
    if (!row) return null;
    const projects = await sql.query<Row>(
      `${FEED_SELECT} where a.handle = $1 order by p.created_at desc`,
      [handle],
    );
    return {
      userId: text(row.user_id),
      handle: text(row.handle),
      displayName: text(row.display_name),
      bio: text(row.bio),
      role: text(row.role),
      location: text(row.location),
      website: text(row.website),
      followerCount: num(row.follower_count),
      followingCount: num(row.following_count),
      projects: projects.map(card),
    };
  });

export const starredIds = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql<{ project_id: string }>`
      select project_id from stars where user_id = ${context.userId}
    `;
    return rows.map((row) => row.project_id);
  });

export const followState = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((handle: unknown) => text(handle).slice(0, 40))
  .handler(async ({ context, data: handle }) => {
    const sql = await getSql();
    const rows = await sql<Row>`
      select
        (select user_id from profiles where user_id = ${context.userId}) as me,
        (select user_id from profiles where handle = ${handle}) as them
    `;
    const me = text(rows[0]?.me);
    const them = text(rows[0]?.them);
    if (!them) return { self: false, following: false, known: false };
    if (me && me === them) return { self: true, following: false, known: true };
    const hits = await sql<{ n: number }>`
      select count(*)::int as n from follows
      where follower_id = ${context.userId} and following_id = ${them}
    `;
    return { self: false, following: num(hits[0]?.n) > 0, known: true };
  });

export const getMine = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<Mine> => {
    const sql = await getSql();
    const profiles = await sql<Row>`
      select handle, display_name, bio, role, location, website
      from profiles where user_id = ${context.userId}
    `;
    const profileRow = profiles[0];
    const [projects, starred, following] = await Promise.all([
      sql<Row>`
        select id, title, language from projects
        where user_id = ${context.userId}
        order by created_at desc
      `,
      sql<Row>`
        select p.id, p.title, a.handle
        from stars s
        join projects p on p.id = s.project_id
        join profiles a on a.user_id = p.user_id
        where s.user_id = ${context.userId}
        order by s.created_at desc
      `,
      sql<Row>`
        select a.handle, a.display_name
        from follows f
        join profiles a on a.user_id = f.following_id
        where f.follower_id = ${context.userId}
        order by a.display_name asc
      `,
    ]);
    return {
      profile: profileRow
        ? {
            handle: text(profileRow.handle),
            displayName: text(profileRow.display_name),
            bio: text(profileRow.bio),
            role: text(profileRow.role),
            location: text(profileRow.location),
            website: text(profileRow.website),
          }
        : null,
      projects: projects.map((row) => ({
        id: text(row.id),
        title: text(row.title),
        language: text(row.language),
      })),
      starred: starred.map((row) => ({
        id: text(row.id),
        title: text(row.title),
        authorHandle: text(row.handle),
      })),
      following: following.map((row) => ({
        handle: text(row.handle),
        displayName: text(row.display_name),
      })),
    };
  });

type ProfileInput = {
  displayName: string;
  handle: string;
  role: string;
  location: string;
  bio: string;
  website: string;
};

function readProfile(input: unknown): ProfileInput | { error: string } {
  const raw = (input ?? {}) as Record<string, unknown>;
  const displayName = text(raw.displayName).trim().slice(0, 60);
  const handle = slugHandle(text(raw.handle));
  const role = text(raw.role).trim().slice(0, 60);
  const location = text(raw.location).trim().slice(0, 60);
  const bio = text(raw.bio).trim().slice(0, 280);
  const websiteRaw = text(raw.website).trim().slice(0, 200);
  if (displayName.length < 2) return { error: "Add the name you want on the record." };
  if (handle.length < 2) return { error: "Handle needs at least two letters or numbers." };
  if (websiteRaw && !safeHttpUrl(websiteRaw)) return { error: "Website must be an http or https link." };
  return {
    displayName,
    handle,
    role,
    location,
    bio,
    website: websiteRaw ? (safeHttpUrl(websiteRaw) ?? "") : "",
  };
}

async function handleTaken(handle: string, userId: string) {
  const sql = await getSql();
  const rows = await sql<{ user_id: string }>`select user_id from profiles where handle = ${handle}`;
  return rows[0] ? rows[0].user_id !== userId : false;
}

export const saveProfile = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => input)
  .handler(async ({ context, data }) => {
    const parsed = readProfile(data);
    if ("error" in parsed) return { ok: false as const, error: parsed.error };
    if (await handleTaken(parsed.handle, context.userId)) {
      return { ok: false as const, error: "That handle is already on the record." };
    }
    const sql = await getSql();
    const existing = await sql`select user_id from profiles where user_id = ${context.userId}`;
    if (existing[0]) {
      await sql`
        update profiles
        set handle = ${parsed.handle},
            display_name = ${parsed.displayName},
            role = ${parsed.role},
            location = ${parsed.location},
            bio = ${parsed.bio},
            website = ${parsed.website}
        where user_id = ${context.userId}
      `;
    } else {
      await sql`
        insert into profiles (user_id, handle, display_name, role, location, bio, website)
        values (
          ${context.userId}, ${parsed.handle}, ${parsed.displayName},
          ${parsed.role}, ${parsed.location}, ${parsed.bio}, ${parsed.website}
        )
      `;
    }
    return { ok: true as const, handle: parsed.handle };
  });

type ProjectInput = {
  title: string;
  summary: string;
  body: string;
  language: string;
  tags: string;
  repoUrl: string;
  demoUrl: string;
  displayName?: string;
  handle?: string;
};

function readProject(input: unknown): ProjectInput | { error: string } {
  const raw = (input ?? {}) as Record<string, unknown>;
  const title = text(raw.title).trim().slice(0, 80);
  const summary = text(raw.summary).trim().slice(0, 240);
  const body = text(raw.body).trim().slice(0, 8000);
  const language = text(raw.language).trim().slice(0, 40);
  const tags = cleanTags(text(raw.tags)).join(",");
  const repoRaw = text(raw.repoUrl).trim().slice(0, 200);
  const demoRaw = text(raw.demoUrl).trim().slice(0, 200);
  if (title.length < 2) return { error: "Give the project a title." };
  if (summary.length < 12) return { error: "Add a one-line summary of what it does." };
  if (!LANGUAGES.includes(language as (typeof LANGUAGES)[number])) {
    return { error: "Pick a language from the list." };
  }
  if (repoRaw && !safeHttpUrl(repoRaw)) return { error: "Repository must be an http or https link." };
  if (demoRaw && !safeHttpUrl(demoRaw)) return { error: "Demo must be an http or https link." };
  return {
    title,
    summary,
    body,
    language,
    tags,
    repoUrl: repoRaw ? (safeHttpUrl(repoRaw) ?? "") : "",
    demoUrl: demoRaw ? (safeHttpUrl(demoRaw) ?? "") : "",
    displayName: text(raw.displayName),
    handle: text(raw.handle),
  };
}

async function uniqueProjectId(title: string) {
  const sql = await getSql();
  const base =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "project";
  let id = base;
  for (let n = 2; n < 40; n += 1) {
    const rows = await sql<{ id: string }>`select id from projects where id = ${id}`;
    if (!rows[0]) return id;
    id = `${base}-${n}`;
  }
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

export const publishProject = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => input)
  .handler(async ({ context, data }) => {
    const parsed = readProject(data);
    if ("error" in parsed) return { ok: false as const, error: parsed.error };
    const sql = await getSql();
    const existing = await sql<Row>`select handle from profiles where user_id = ${context.userId}`;
    let handle = text(existing[0]?.handle);
    if (!handle) {
      const profile = readProfile({
        displayName: parsed.displayName,
        handle: parsed.handle,
        role: "",
        location: "",
        bio: "",
        website: "",
      });
      if ("error" in profile) return { ok: false as const, error: profile.error };
      if (await handleTaken(profile.handle, context.userId)) {
        return { ok: false as const, error: "That handle is already on the record." };
      }
      await sql`
        insert into profiles (user_id, handle, display_name, role, location, bio, website)
        values (${context.userId}, ${profile.handle}, ${profile.displayName}, '', '', '', '')
      `;
      handle = profile.handle;
    }
    const id = await uniqueProjectId(parsed.title);
    await sql`
      insert into projects (id, user_id, title, summary, body, language, tags, repo_url, demo_url)
      values (
        ${id}, ${context.userId}, ${parsed.title}, ${parsed.summary}, ${parsed.body},
        ${parsed.language}, ${parsed.tags}, ${parsed.repoUrl}, ${parsed.demoUrl}
      )
    `;
    return { ok: true as const, id, handle };
  });

export const updateProject = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => input)
  .handler(async ({ context, data }) => {
    const raw = (data ?? {}) as Record<string, unknown>;
    const id = text(raw.id).slice(0, 80);
    const parsed = readProject(data);
    if ("error" in parsed) return { ok: false as const, error: parsed.error };
    const sql = await getSql();
    const rows = await sql<{ id: string }>`
      update projects
      set title = ${parsed.title},
          summary = ${parsed.summary},
          body = ${parsed.body},
          language = ${parsed.language},
          tags = ${parsed.tags},
          repo_url = ${parsed.repoUrl},
          demo_url = ${parsed.demoUrl},
          updated_at = now()
      where id = ${id} and user_id = ${context.userId}
      returning id
    `;
    if (!rows[0]) return { ok: false as const, error: "That project is not yours to edit." };
    return { ok: true as const, id };
  });

export const deleteProject = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: unknown) => text(id).slice(0, 80))
  .handler(async ({ context, data: id }) => {
    const sql = await getSql();
    const rows = await sql<{ id: string }>`
      delete from projects where id = ${id} and user_id = ${context.userId} returning id
    `;
    if (!rows[0]) return { ok: false as const, error: "That project is not yours to remove." };
    return { ok: true as const };
  });

export const toggleStar = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: unknown) => text(id).slice(0, 80))
  .handler(async ({ context, data: id }) => {
    const sql = await getSql();
    const found = await sql`select id from projects where id = ${id}`;
    if (!found[0]) return { ok: false as const, error: "Project not found." };
    const existing = await sql`
      select project_id from stars where user_id = ${context.userId} and project_id = ${id}
    `;
    if (existing[0]) {
      await sql`delete from stars where user_id = ${context.userId} and project_id = ${id}`;
    } else {
      await sql`insert into stars (user_id, project_id) values (${context.userId}, ${id})`;
    }
    const counts = await sql<{ n: number }>`select count(*)::int as n from stars where project_id = ${id}`;
    return { ok: true as const, starred: !existing[0], starCount: num(counts[0]?.n) };
  });

export const toggleFollow = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((handle: unknown) => text(handle).slice(0, 40))
  .handler(async ({ context, data: handle }) => {
    const sql = await getSql();
    const them = await sql<{ user_id: string }>`select user_id from profiles where handle = ${handle}`;
    const target = them[0]?.user_id;
    if (!target) return { ok: false as const, error: "That maker is not on the record." };
    if (target === context.userId) return { ok: false as const, error: "You already follow your own work." };
    const me = await sql`select user_id from profiles where user_id = ${context.userId}`;
    if (!me[0]) return { ok: false as const, error: "Claim a handle on your bench before following someone." };
    const existing = await sql`
      select follower_id from follows where follower_id = ${context.userId} and following_id = ${target}
    `;
    if (existing[0]) {
      await sql`delete from follows where follower_id = ${context.userId} and following_id = ${target}`;
    } else {
      await sql`insert into follows (follower_id, following_id) values (${context.userId}, ${target})`;
    }
    const counts = await sql<{ n: number }>`
      select count(*)::int as n from follows where following_id = ${target}
    `;
    return { ok: true as const, following: !existing[0], followerCount: num(counts[0]?.n) };
  });

export const addNote = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const raw = (input ?? {}) as { projectId?: unknown; body?: unknown };
    return {
      projectId: text(raw.projectId).slice(0, 80),
      body: text(raw.body).trim().slice(0, 800),
    };
  })
  .handler(async ({ context, data }) => {
    if (data.body.length < 2) return { ok: false as const, error: "Write a note before sending it." };
    const sql = await getSql();
    const me = await sql`select user_id from profiles where user_id = ${context.userId}`;
    if (!me[0]) return { ok: false as const, error: "Claim a handle on your bench before leaving a note." };
    const project = await sql`select id from projects where id = ${data.projectId}`;
    if (!project[0]) return { ok: false as const, error: "Project not found." };
    const id = crypto.randomUUID();
    await sql`
      insert into notes (id, project_id, user_id, body)
      values (${id}, ${data.projectId}, ${context.userId}, ${data.body})
    `;
    return { ok: true as const, id };
  });

export const deleteNote = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: unknown) => text(id).slice(0, 80))
  .handler(async ({ context, data: id }) => {
    const sql = await getSql();
    const rows = await sql<{ id: string }>`
      delete from notes where id = ${id} and user_id = ${context.userId} returning id
    `;
    if (!rows[0]) return { ok: false as const, error: "That note is not yours." };
    return { ok: true as const };
  });
