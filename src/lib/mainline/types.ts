export type ProjectCard = {
  id: string;
  title: string;
  summary: string;
  language: string;
  tags: string[];
  repoUrl: string;
  demoUrl: string;
  createdAt: string;
  updatedAt: string;
  starCount: number;
  noteCount: number;
  authorHandle: string;
  authorName: string;
  authorRole: string;
};

export type ProjectDetail = ProjectCard & {
  body: string;
  authorUserId: string;
  authorBio: string;
  authorLocation: string;
};

export type Note = {
  id: string;
  body: string;
  createdAt: string;
  authorUserId: string;
  authorHandle: string;
  authorName: string;
  parentId: string | null;
};

export type BuildUpdate = {
  id: string;
  body: string;
  createdAt: string;
  authorHandle: string;
  authorName: string;
};

export type ActivityItem = {
  id: string;
  kind: "project" | "update";
  createdAt: string;
  projectId: string;
  projectTitle: string;
  summary: string;
  language: string;
  body: string;
  authorHandle: string;
  authorName: string;
};

export type CollabPost = {
  id: string;
  title: string;
  description: string;
  skills: string[];
  status: "open" | "closed";
  createdAt: string;
  authorUserId: string;
  authorHandle: string;
  authorName: string;
  projectId: string;
  projectTitle: string;
  interestCount: number;
};

export type CollabInterest = {
  postId: string;
  message: string;
  createdAt: string;
  authorHandle: string;
  authorName: string;
};

export type Prompt = {
  key: string;
  title: string;
  description: string;
  skills: string[];
  weekLabel: string;
  endsAt: string;
};

export type PromptEntry = {
  id: string;
  body: string;
  repoUrl: string;
  createdAt: string;
  authorUserId: string;
  authorHandle: string;
  authorName: string;
  projectId: string;
  projectTitle: string;
  voteCount: number;
  voted: boolean;
};

export type CommunityNotification = {
  id: string;
  kind: string;
  createdAt: string;
  readAt: string;
  actorHandle: string;
  actorName: string;
  projectId: string;
  projectTitle: string;
  updateId: string;
  collabPostId: string;
};

export type Maker = {
  handle: string;
  displayName: string;
  role: string;
  bio: string;
  location: string;
  projectCount: number;
  followerCount: number;
};

export type LanguageStat = {
  name: string;
  count: number;
  topId: string;
  topTitle: string;
};

export type TagStat = {
  name: string;
  count: number;
};

export type Directory = {
  projectCount: number;
  languages: LanguageStat[];
  tags: TagStat[];
  makers: Maker[];
};

export type Profile = {
  userId: string;
  handle: string;
  displayName: string;
  bio: string;
  role: string;
  location: string;
  website: string;
  avatarImage: string;
  bannerImage: string;
  githubHandle: string;
  linkedinUrl: string;
  xHandle: string;
  blueskyHandle: string;
  followerCount: number;
  followingCount: number;
  projects: ProjectCard[];
};

export type Mine = {
  profile: {
    handle: string;
    displayName: string;
    bio: string;
    role: string;
    location: string;
    website: string;
    avatarImage: string;
    bannerImage: string;
    githubHandle: string;
    linkedinUrl: string;
    xHandle: string;
    blueskyHandle: string;
  } | null;
  projects: { id: string; title: string; language: string }[];
  starred: { id: string; title: string; authorHandle: string }[];
  following: { handle: string; displayName: string }[];
};

export type ActionResult<T extends Record<string, unknown> = Record<string, never>> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

export const LANGUAGES = [
  "TypeScript",
  "Rust",
  "Go",
  "Python",
  "Swift",
  "Kotlin",
  "Zig",
  "C",
] as const;
