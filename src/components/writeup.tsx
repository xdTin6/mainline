import { parseWriteup } from "@/lib/mainline/text";

export function Writeup({ body }: { body: string }) {
  const blocks = parseWriteup(body);
  if (!blocks.length) return null;
  return (
    <div className="space-y-4">
      {blocks.map((block, index) =>
        block.kind === "code" ? (
          <pre
            key={index}
            className="overflow-x-auto rounded-sm border border-line bg-bg p-4 font-mono text-sm leading-relaxed text-fg"
          >
            <code>{block.text}</code>
          </pre>
        ) : (
          <p key={index} className="text-base leading-relaxed text-fg">
            {block.text}
          </p>
        ),
      )}
    </div>
  );
}
