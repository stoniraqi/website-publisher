import type { Block } from "@/server/blocks";

/** A post or page body, read-only. `mediaBase` is where images are served from. */
export function Blocks({ blocks, mediaBase }: { blocks: Block[]; mediaBase: string }) {
  return (
    <div className="space-y-5 text-base leading-relaxed">
      {blocks.map((block) => {
        switch (block.type) {
          case "paragraph":
            return (
              <p key={block.id} className="whitespace-pre-line">
                {block.text}
              </p>
            );
          case "heading": {
            const Tag = `h${block.level}` as "h2" | "h3" | "h4";
            const size = block.level === 2 ? "text-2xl" : block.level === 3 ? "text-xl" : "text-lg";
            return (
              <Tag key={block.id} className={`${size} pt-2 font-semibold tracking-tight`}>
                {block.text}
              </Tag>
            );
          }
          case "list": {
            const Tag = block.ordered ? "ol" : "ul";
            return (
              <Tag key={block.id} className={`${block.ordered ? "list-decimal" : "list-disc"} space-y-1 pl-6`}>
                {block.items.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </Tag>
            );
          }
          case "quote":
            return (
              <blockquote key={block.id} className="border-l-4 border-primary/40 pl-4 text-lg italic">
                <p className="whitespace-pre-line">{block.text}</p>
                {block.cite ? <footer className="mt-1 text-sm not-italic text-muted-foreground">{block.cite}</footer> : null}
              </blockquote>
            );
          case "image":
            if (!block.mediaId) return null;
            return (
              <figure key={block.id} className="space-y-2">
                <img
                  src={`${mediaBase}/${block.mediaId}`}
                  alt={block.alt}
                  className="w-full rounded-lg border border-border"
                />
                {block.caption ? (
                  <figcaption className="text-center text-sm text-muted-foreground">{block.caption}</figcaption>
                ) : null}
              </figure>
            );
          case "separator":
            return <hr key={block.id} className="mx-auto w-24 border-border" />;
          default:
            return null;
        }
      })}
    </div>
  );
}
