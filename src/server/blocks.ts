import { z } from "zod";

const text = z.string().max(20_000);
const blockId = z.string().max(64).optional();

export const blockSchema = z.discriminatedUnion("type", [
  z.object({ id: blockId, type: z.literal("paragraph"), text }),
  z.object({ id: blockId, type: z.literal("heading"), text, level: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(2) }),
  z.object({ id: blockId, type: z.literal("list"), ordered: z.boolean().default(false), items: z.array(z.string().max(2_000)).max(200).optional(), text: text.optional() }),
  z.object({ id: blockId, type: z.literal("quote"), text, cite: z.string().max(500).default("") }),
  z.object({ id: blockId, type: z.literal("image"), mediaId: z.string().max(64).nullable().default(null), alt: z.string().max(500).default(""), caption: z.string().max(1_000).default("") }),
  z.object({ id: blockId, type: z.literal("separator") }),
]);
export const blocksSchema = z.array(blockSchema).max(500);

export type Block =
  | { id: string; type: "paragraph"; text: string }
  | { id: string; type: "heading"; text: string; level: 2 | 3 | 4 }
  | { id: string; type: "list"; ordered: boolean; items: string[] }
  | { id: string; type: "quote"; text: string; cite: string }
  | { id: string; type: "image"; mediaId: string | null; alt: string; caption: string }
  | { id: string; type: "separator" };

/** Blocks with ids and list items filled in, ready to store. */
export function normalizeBlocks(input: z.infer<typeof blocksSchema>): Block[] {
  return input.map((block) => {
    const id = block.id || crypto.randomUUID();
    if (block.type === "list") {
      const items = block.items ?? (block.text ?? "").split("\n");
      return { id, type: "list", ordered: block.ordered, items: items.map((i) => i.trim()).filter(Boolean) };
    }
    return { ...block, id } as Block;
  });
}

export function parseBlocks(json: string): Block[] {
  try {
    const value = JSON.parse(json);
    return Array.isArray(value) ? (value as Block[]) : [];
  } catch {
    return [];
  }
}

/** The words of the blocks, for search. */
export function blocksText(blocks: Block[]): string {
  return blocks
    .map((b) => {
      switch (b.type) {
        case "paragraph":
        case "heading":
          return b.text;
        case "quote":
          return `${b.text} ${b.cite}`;
        case "list":
          return b.items.join(" ");
        case "image":
          return `${b.alt} ${b.caption}`;
        default:
          return "";
      }
    })
    .filter(Boolean)
    .join("\n");
}

export function mediaIdsOf(blocks: Block[]): string[] {
  return blocks.flatMap((b) => (b.type === "image" && b.mediaId ? [b.mediaId] : []));
}

export function slugify(value: string): string {
  const slug = value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
  return slug || "untitled";
}
