import { describe, expect, it } from "vitest";
import { canCreate, canDeleteMedia, canEdit, canModerate, canRead, canSetStatus, type Actor } from "./permissions";
import { blocksText, normalizeBlocks, slugify } from "./blocks";

const as = (role: Actor["role"], id = role): Actor => ({ id, role });

describe("roles", () => {
  it("contributors write their own drafts but never publish or edit published work", () => {
    const c = as("contributor");
    expect(canCreate(c, "post")).toBe(true);
    expect(canCreate(c, "page")).toBe(false);
    expect(canSetStatus(c, "pending")).toBe(true);
    expect(canSetStatus(c, "published")).toBe(false);
    expect(canEdit(c, { type: "post", status: "draft", authorId: "contributor" })).toBe(true);
    expect(canEdit(c, { type: "post", status: "published", authorId: "contributor" })).toBe(false);
  });

  it("authors publish their own posts only", () => {
    const a = as("author");
    expect(canSetStatus(a, "published")).toBe(true);
    expect(canEdit(a, { type: "post", status: "published", authorId: "author" })).toBe(true);
    expect(canEdit(a, { type: "post", status: "draft", authorId: "other" })).toBe(false);
    expect(canRead(a, { type: "post", status: "private", authorId: "other" })).toBe(false);
    expect(canDeleteMedia(a, "other")).toBe(false);
    expect(canModerate(a, "author")).toBe(true);
    expect(canModerate(a, "other")).toBe(false);
  });

  it("editors manage everything; subscribers nothing", () => {
    expect(canEdit(as("editor"), { type: "page", status: "private", authorId: "x" })).toBe(true);
    expect(canCreate(as("subscriber"), "post")).toBe(false);
    expect(canRead(as("subscriber"), { type: "post", status: "draft", authorId: "x" })).toBe(false);
  });
});

describe("blocks", () => {
  it("makes slugs and search text", () => {
    expect(slugify("Ça va? A weekend, on the coast!")).toBe("ca-va-a-weekend-on-the-coast");
    const blocks = normalizeBlocks([
      { type: "paragraph", text: "Hello" },
      { type: "list", ordered: false, text: "one\n\ntwo" },
    ]);
    expect(blocks[1]).toMatchObject({ type: "list", items: ["one", "two"] });
    expect(blocksText(blocks)).toBe("Hello\none two");
  });
});
