-- Mainline: public project record, profiles, stars, notes, follows.

create table if not exists profiles (
  user_id text primary key,
  handle text not null unique,
  display_name text not null,
  bio text not null default '',
  role text not null default '',
  location text not null default '',
  website text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists projects (
  id text primary key,
  user_id text not null references profiles (user_id),
  title text not null,
  summary text not null,
  body text not null default '',
  language text not null,
  tags text not null default '',
  repo_url text not null default '',
  demo_url text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists projects_user_idx on projects (user_id);
create index if not exists projects_language_idx on projects (language);
create index if not exists projects_created_idx on projects (created_at desc);

create table if not exists stars (
  user_id text not null,
  project_id text not null references projects (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, project_id)
);

create index if not exists stars_project_idx on stars (project_id);

create table if not exists notes (
  id text primary key,
  project_id text not null references projects (id) on delete cascade,
  user_id text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists notes_project_idx on notes (project_id, created_at);

create table if not exists follows (
  follower_id text not null,
  following_id text not null,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id)
);

insert into profiles (user_id, handle, display_name, bio, role, location) values
  ('mira', 'mira', 'Mira Chen', 'I build sync that still works when the network does not.', 'Systems', 'Lisbon'),
  ('ade', 'ade', 'Ade Okonkwo', 'Terminal tools, scrollback, and the long session.', 'Terminal tools', 'Lagos'),
  ('jules', 'jules', 'Jules Park', 'Type, paper, and compilers that respect a paragraph.', 'Typography', 'Seoul'),
  ('ellis', 'ellis', 'Ellis Ward', 'Debuggers that stop on the frame before the bug.', 'Devtools', 'Montreal'),
  ('noor', 'noor', 'Noor Alvi', 'On-call software that remembers people sleep.', 'Infrastructure', 'Berlin'),
  ('sable', 'sable', 'Sable Ito', 'Notebooks that are just files you can diff.', 'Data tools', 'Kyoto'),
  ('rowan', 'rowan', 'Rowan Hale', 'Native apps for reading repositories.', 'Native apps', 'Edinburgh'),
  ('imani', 'imani', 'Imani Brooks', 'Registries and the boring parts of shipping a CLI.', 'Platform', 'Accra'),
  ('leo', 'leo', 'Leo Marquez', 'Search that remembers what a symbol used to be called.', 'Code search', 'Mexico City')
on conflict (user_id) do nothing;

insert into projects (id, user_id, title, summary, body, language, tags, created_at) values
(
  'loom', 'mira', 'Loom',
  'A sync engine that keeps a notebook, a board, and a scratch buffer in agreement without a server in the middle.',
  $loom$Loom is for apps that should keep working on a train.

The log is one append-only file. Every change is an operation with a causal stamp. Devices merge by replaying what they have not seen. There is no central writer, and there is no last-write-wins surprise.

Adapters ship for a notes file, a kanban board, and a scratch buffer. The notes adapter is the whole idea, in miniature:

```
export function apply(doc: Doc, op: Op): Doc {
  if (op.kind === "insert") return insert(doc, op.at, op.text)
  if (op.kind === "erase") return erase(doc, op.at, op.len)
  return doc
}
```

If two people type into the same sentence, both sentences survive. You can read the file with cat. That was the constraint that kept the design honest.$loom$,
  'TypeScript', 'crdt,local-first,sync', '2026-11-10 15:00:00+00'
),
(
  'harbor', 'ade', 'Harbor',
  'A terminal multiplexer that treats scrollback as a document you can grep, not a bucket you lose.',
  $harbor$Harbor keeps panes, sessions, and history. The part that matters is the scrollback. It is stored as lines with timestamps, so you can search a session the way you search a repository.

Detach is boring on purpose. The session is still there after the laptop sleeps. Reattach prints where you were, including the command that was running, not a redrawn guess.

It is Rust because the process model should be obvious and the binary should start before your coffee cools.$harbor$,
  'Rust', 'terminal,multiplexer,cli', '2026-11-08 11:00:00+00'
),
(
  'paperplane', 'jules', 'Paperplane',
  'A small typesetting compiler. Write in a plain markup, get a PDF that looks like a book, not a default stylesheet.',
  $paper$Paperplane turns a markup file into a PDF with real measure, real margins, and hyphenation that does not embarrass the paragraph.

There is no theme gallery. There is a page, a type size, and a line length. If the line is too long it tells you, instead of shrinking the font until the page looks like a legal notice.

I use it for essays and for the occasional release note that deserves to be a pamphlet.$paper$,
  'Rust', 'typography,compiler,pdf', '2026-11-06 09:30:00+00'
),
(
  'trace', 'ellis', 'Trace',
  'A time-travel debugger for browser apps. Scrub to the exact frame a state update went wrong.',
  $trace$Trace records a session in the browser and lets you move through it like a timeline. State, the DOM, and the event that caused the change stay attached to the same frame.

The useful moment is never the crash. It is the update three frames earlier that blanked a list. Trace stops there and shows the value before and after.

Recordings stay on the machine that made them. Nothing about a debugging session should need an account on someone else's server.$trace$,
  'TypeScript', 'debugging,devtools,replay', '2026-11-04 18:10:00+00'
),
(
  'nightshift', 'noor', 'Nightshift',
  'On-call schedules that rotate people, not just calendar blocks, and page the person least likely to be in deep work.',
  $night$Nightshift builds a rotation from the humans you actually have. It knows who was up last night, who is in a focus block, and who already took the last holiday incident.

Pages go to one person. Escalation is a second person after a quiet interval, not a channel where everyone is half awake.

The scheduler is a single Go service with a config file. If you cannot explain the rotation from the file, the file is wrong.$night$,
  'Go', 'on-call,ops,scheduling', '2026-11-01 08:00:00+00'
),
(
  'silt', 'sable', 'Silt',
  'Notebooks as plain directories. A markdown file, a Python file, cached outputs, and no hidden state.',
  $silt$Silt runs a folder from top to bottom. Inputs are files. Outputs are files. There is no kernel quietly remembering a variable you defined on Tuesday.

A notebook is a directory you can diff. Cached outputs sit next to the cell that produced them, so a review can see the figure without rerunning the world.

If a cell is not deterministic, Silt marks it. It does not pretend the rerun will match.$silt$,
  'Python', 'notebooks,python,reproducible', '2026-10-27 13:20:00+00'
),
(
  'keel', 'rowan', 'Keel',
  'A native git client that draws the commit graph as a river of work, not a subway map from 2009.',
  $keel$Keel is a Mac app for reading a repository. The graph is quiet: one line per branch you have checked out, everything else tucked until you ask.

Staging is line by line, and the commit message field is large enough to write in. Blame is a sidebar, not a mode that takes over the file.

It shells out to git. The point is the reading view, not a second implementation of merge.$keel$,
  'Swift', 'git,macos,client', '2026-10-22 16:40:00+00'
),
(
  'parcel', 'imani', 'Parcel',
  'Publish an internal CLI in one command. Artifacts are signed, old versions stay fetchable, and nothing phones home.',
  $parcel$Parcel is a registry for tools your company actually runs. You publish a build, the checksum is signed, and anyone inside can install a pinned version later.

There is no telemetry in the client. An installer that reports home is a supply-chain problem wearing a feature badge.

Yank is a flag, not a delete. The bytes remain so a build from last March can still be reproduced.$parcel$,
  'Go', 'registry,cli,supply-chain', '2026-10-18 10:00:00+00'
),
(
  'fathom', 'leo', 'Fathom',
  'Code search that follows renames. Finding a symbol means finding the names it used to have.',
  $fathom$Fathom indexes a TypeScript project and remembers when a symbol moves. Search for the current name and you also get the call sites that still use the old one, across packages.

Rename is how bugs hide. A grep of the new name looks clean while a stale string keeps the old behavior alive in a worker.

The index is local. Query it from the editor or from a small CLI that prints file, line, and the name it matched.$fathom$,
  'TypeScript', 'search,refactor,typescript', '2026-10-12 12:00:00+00'
)
on conflict (id) do nothing;

insert into stars (user_id, project_id) values
  ('ade', 'loom'), ('jules', 'loom'), ('ellis', 'loom'), ('noor', 'loom'), ('sable', 'loom'), ('leo', 'loom'),
  ('mira', 'harbor'), ('jules', 'harbor'), ('rowan', 'harbor'), ('imani', 'harbor'),
  ('mira', 'paperplane'), ('ellis', 'paperplane'), ('sable', 'paperplane'),
  ('mira', 'trace'), ('ade', 'trace'), ('leo', 'trace'), ('noor', 'trace'),
  ('ade', 'nightshift'), ('imani', 'nightshift'), ('rowan', 'nightshift'),
  ('jules', 'silt'), ('ellis', 'silt'),
  ('mira', 'keel'), ('leo', 'keel'),
  ('noor', 'parcel'), ('ade', 'parcel'), ('sable', 'parcel'),
  ('ellis', 'fathom'), ('mira', 'fathom'), ('jules', 'fathom'), ('rowan', 'fathom')
on conflict do nothing;

insert into notes (id, project_id, user_id, body, created_at) values
  ('n1', 'loom', 'ade', 'Ran this on two laptops with the wifi off. The notes file merged cleanly once they saw each other again.', '2026-11-11 09:00:00+00'),
  ('n2', 'loom', 'jules', 'Keeping the log as a file you can cat is the whole product.', '2026-11-11 14:12:00+00'),
  ('n3', 'harbor', 'mira', 'Scrollback as a document is the feature I did not know I wanted.', '2026-11-09 08:40:00+00'),
  ('n4', 'paperplane', 'sable', 'Set a short essay with it. The PDF looks like a book, which is rarer than it should be.', '2026-11-07 17:05:00+00'),
  ('n5', 'trace', 'leo', 'Scrubbing to the exact update that blanked a list saved an afternoon.', '2026-11-05 11:22:00+00'),
  ('n6', 'fathom', 'ellis', 'It followed a rename across three packages. Grep of the new name would have looked clean.', '2026-10-20 15:30:00+00')
on conflict (id) do nothing;

insert into follows (follower_id, following_id) values
  ('mira', 'ade'), ('mira', 'jules'), ('mira', 'ellis'),
  ('ade', 'mira'), ('ade', 'noor'),
  ('jules', 'mira'), ('jules', 'sable'),
  ('ellis', 'leo'), ('ellis', 'mira'),
  ('noor', 'imani'), ('noor', 'ade'),
  ('sable', 'jules'), ('rowan', 'ade'),
  ('imani', 'noor'), ('leo', 'ellis'), ('leo', 'mira')
on conflict do nothing;
