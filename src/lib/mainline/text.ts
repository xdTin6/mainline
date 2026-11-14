export type Block = { kind: "p"; text: string } | { kind: "code"; text: string };

export function parseWriteup(body: string): Block[] {
  const lines = body.replaceAll("\r\n", "\n").split("\n");
  const blocks: Block[] = [];
  let para: string[] = [];
  let code: string[] | null = null;

  const flush = () => {
    const text = para.join(" ").trim();
    if (text) blocks.push({ kind: "p", text });
    para = [];
  };

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      if (code) {
        blocks.push({ kind: "code", text: code.join("\n").replace(/\s+$/, "") });
        code = null;
      } else {
        flush();
        code = [];
      }
      continue;
    }
    if (code) {
      code.push(line);
      continue;
    }
    if (!line.trim()) flush();
    else para.push(line.trim());
  }
  if (code) blocks.push({ kind: "code", text: code.join("\n").replace(/\s+$/, "") });
  flush();
  return blocks;
}

export function cleanTags(raw: string): string[] {
  const parts = raw
    .split(/[,\s]+/)
    .map((tag) => tag.toLowerCase().replace(/[^a-z0-9-]/g, ""))
    .filter((tag) => tag.length >= 2 && tag.length <= 24);
  return [...new Set(parts)].slice(0, 6);
}

export function formatDay(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${date.getUTCDate()} ${months[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

export function safeHttpUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function countLabel(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

export function slugHandle(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24);
}
