import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, Heading, Image, List, Minus, Pilcrow, Quote, Trash2, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Blocks } from "@/client/components/Blocks";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { EmptyState } from "@/client/components/EmptyState";
import { OptionSelect } from "@/client/components/OptionSelect";
import { PageHeader } from "@/client/components/PageHeader";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { Checkbox } from "@/client/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/client/components/ui/dialog";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { Switch } from "@/client/components/ui/switch";
import { Textarea } from "@/client/components/ui/textarea";
import { errorMessage, formatDate, useAction } from "@/client/lib/useAction";
import type { Block } from "@/server/blocks";
import { STATUS_LABELS, type Status } from "@/server/permissions";
import {
  createContent,
  deleteContent,
  getEditor,
  getRevision,
  restoreRevision,
  saveContent,
} from "@/serverFunctions/content";

export const Route = createFileRoute("/_dash/edit/$id")({
  validateSearch: z.object({ type: z.enum(["post", "page"]).optional().catch(undefined) }),
  loaderDeps: ({ search }) => ({ type: search.type }),
  loader: ({ params, deps }) => getEditor({ data: { id: params.id, type: deps.type } }),
  head: () => ({ meta: [{ title: "Editor" }] }),
  component: EditorPage,
  errorComponent: ({ error }) => (
    <>
      <PageHeader title="Not available" backLink={<BackToContent />} />
      <EmptyState kind="error" title={errorMessage(error)} />
    </>
  ),
});

function BackToContent() {
  return (
    <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
      ← Content
    </Link>
  );
}

type Data = Awaited<ReturnType<typeof getEditor>>;

interface Draft {
  title: string;
  slug: string;
  excerpt: string;
  blocks: Block[];
  status: Status;
  publishAt: string;
  parentId: string | null;
  commentsOpen: boolean;
  categories: string[];
  tags: string[];
}

function toLocalInput(ms: number | null): string {
  if (!ms) return "";
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function EditorPage() {
  const data = Route.useLoaderData();
  const key = data.editor ? `${data.editor.item.id}:${data.editor.item.updatedAt}:${data.editor.revisions.length}` : "new";
  return <Editor key={key} data={data} />;
}

function Editor({ data }: { data: Data }) {
  const navigate = useNavigate();
  const { run, pending } = useAction();
  const existing = data.editor;
  const type = existing?.item.type ?? data.newType ?? "post";
  const editable = existing ? existing.canEdit : data.canCreate;
  const [draft, setDraft] = useState<Draft>(() => ({
    title: existing?.item.title ?? "",
    slug: existing?.item.slug ?? "",
    excerpt: existing?.item.excerpt ?? "",
    blocks: existing?.item.blocks ?? [],
    status: existing?.item.status ?? "draft",
    publishAt: toLocalInput(existing?.item.publishAt ?? null),
    parentId: existing?.item.parentId ?? null,
    commentsOpen: existing?.item.commentsOpen ?? data.commentsDefaultOpen,
    categories: existing?.categoryIds ?? [],
    tags: existing?.tags ?? [],
  }));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof getRevision>> | null>(null);
  const update = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const setBlocks = (blocks: Block[]) => update({ blocks });
  const inTrash = existing?.item.status === "trash";

  if (!existing && !data.canCreate) {
    return (
      <>
        <PageHeader title={type === "page" ? "New page" : "New post"} backLink={<BackToContent />} />
        <EmptyState kind="error" title="Your role can't create this." />
      </>
    );
  }

  const statusOptions = (data.canPublish
    ? (["draft", "pending", "published", "private"] as const)
    : (["draft", "pending"] as const)
  ).map((s) => ({ value: s, label: STATUS_LABELS[s] }));
  const statusValue = draft.status === "scheduled" ? "published" : draft.status;
  const publishAtMs = draft.publishAt ? new Date(draft.publishAt).getTime() : null;
  const willSchedule = statusValue === "published" && publishAtMs !== null && publishAtMs > Date.now();

  function payload() {
    return {
      title: draft.title,
      slug: draft.slug || undefined,
      excerpt: draft.excerpt,
      blocks: draft.blocks,
      ...(inTrash ? {} : { status: statusValue as Status }),
      ...(data.canPublish ? { publishAt: publishAtMs } : {}),
      parentId: type === "page" ? draft.parentId : null,
      commentsOpen: draft.commentsOpen,
      ...(type === "post" ? { categories: draft.categories, tags: draft.tags } : {}),
    };
  }

  async function save() {
    if (!existing) {
      const created = await run(() => createContent({ data: { type, ...payload(), status: statusValue as Status } }), "Saved");
      if (created) await navigate({ to: "/edit/$id", params: { id: created.id }, search: {}, replace: true });
      return;
    }
    await run(() => saveContent({ data: { id: existing.item.id, changes: payload() } }), "Saved");
  }

  const parentOptions = [
    { value: "none", label: "No parent" },
    ...data.pages.filter((p) => p.id !== existing?.item.id).map((p) => ({ value: p.id, label: p.title || "(no title)" })),
  ];

  return (
    <>
      <PageHeader
        title={existing ? existing.item.title || "(no title)" : type === "page" ? "New page" : "New post"}
        backLink={<BackToContent />}
        description={
          existing ? (
            <span className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{STATUS_LABELS[existing.item.status]}</Badge>
              {existing.item.status === "scheduled" ? <span>for {formatDate(existing.item.publishAt)}</span> : null}
              {existing.item.status === "published" ? (
                <a
                  href={type === "post" ? `/site/post/${existing.item.slug}` : `/site/${existing.item.slug}`}
                  className="text-primary hover:underline"
                  data-testid="view-public"
                >
                  View on site
                </a>
              ) : null}
            </span>
          ) : undefined
        }
        actions={
          editable ? (
            inTrash ? (
              <>
                <Button
                  variant="outline"
                  data-testid="restore"
                  pending={pending}
                  onClick={() => run(() => saveContent({ data: { id: existing!.item.id, changes: { status: "draft" } } }), "Restored as a draft")}
                >
                  Restore
                </Button>
                <Button variant="destructive" data-testid="delete-permanently" onClick={() => setConfirmDelete(true)}>
                  Delete permanently
                </Button>
              </>
            ) : (
              <>
                {existing ? (
                  <Button
                    variant="ghost"
                    data-testid="trash"
                    onClick={() => run(() => saveContent({ data: { id: existing.item.id, changes: { status: "trash" } } }), "Moved to trash")}
                  >
                    <Trash2 /> Trash
                  </Button>
                ) : null}
                <Button data-testid="save" pending={pending} onClick={save}>
                  {willSchedule ? "Schedule" : "Save"}
                </Button>
              </>
            )
          ) : null
        }
      />

      <div className="space-y-8">
        <section className="space-y-4">
          <Field label="Title" htmlFor="title">
            <Input
              id="title"
              data-testid="title-input"
              value={draft.title}
              disabled={!editable}
              onChange={(e) => update({ title: e.target.value })}
              className="bg-card text-lg"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Slug" htmlFor="slug">
              <Input
                id="slug"
                data-testid="slug-input"
                value={draft.slug}
                disabled={!editable}
                placeholder="From the title"
                onChange={(e) => update({ slug: e.target.value })}
                className="bg-card"
              />
            </Field>
            {type === "page" ? (
              <Field label="Parent page">
                <OptionSelect
                  label="Parent page"
                  testId="parent-select"
                  value={draft.parentId ?? "none"}
                  options={parentOptions}
                  disabled={!editable}
                  onChange={(v) => update({ parentId: v === "none" ? null : v })}
                />
              </Field>
            ) : null}
          </div>
          <Field label="Excerpt" htmlFor="excerpt">
            <Textarea
              id="excerpt"
              data-testid="excerpt-input"
              value={draft.excerpt}
              disabled={!editable}
              rows={2}
              onChange={(e) => update({ excerpt: e.target.value })}
              className="bg-card"
            />
          </Field>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold tracking-tight">Body</h2>
          {draft.blocks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No blocks yet. Add one below.</p>
          ) : null}
          {draft.blocks.map((block, index) => (
            <BlockEditor
              key={block.id}
              block={block}
              disabled={!editable}
              library={data.library}
              first={index === 0}
              last={index === draft.blocks.length - 1}
              onChange={(next) => setBlocks(draft.blocks.map((b, i) => (i === index ? next : b)))}
              onMove={(delta) => {
                const next = [...draft.blocks];
                const [moved] = next.splice(index, 1);
                next.splice(index + delta, 0, moved!);
                setBlocks(next);
              }}
              onRemove={() => setBlocks(draft.blocks.filter((_, i) => i !== index))}
            />
          ))}
          {editable ? (
            <div className="flex flex-wrap gap-2">
              {ADDERS.map(({ type: t, label, icon }) => (
                <Button
                  key={t}
                  variant="outline"
                  size="sm"
                  data-testid={`add-${t}`}
                  onClick={() => setBlocks([...draft.blocks, newBlock(t)])}
                >
                  {icon} {label}
                </Button>
              ))}
            </div>
          ) : null}
        </section>

        <section className="grid gap-6 rounded-xl border border-border bg-card p-5 shadow-xs sm:grid-cols-2">
          {!inTrash ? (
            <Field label="Status">
              <OptionSelect
                label="Status"
                testId="status-select"
                value={statusValue}
                options={statusOptions.some((o) => o.value === statusValue) ? statusOptions : [...statusOptions, { value: statusValue, label: STATUS_LABELS[statusValue] }]}
                disabled={!editable}
                onChange={(v) => update({ status: v as Status })}
              />
            </Field>
          ) : null}
          {data.canPublish && !inTrash ? (
            <Field label="Publish date" htmlFor="publish-at">
              <Input
                id="publish-at"
                type="datetime-local"
                data-testid="publish-at"
                value={draft.publishAt}
                disabled={!editable}
                onChange={(e) => update({ publishAt: e.target.value })}
                className="bg-card"
              />
            </Field>
          ) : null}
          <div className="flex items-center gap-3">
            <Switch
              id="comments-open"
              data-testid="comments-open"
              checked={draft.commentsOpen}
              disabled={!editable}
              onCheckedChange={(checked) => update({ commentsOpen: checked })}
            />
            <Label htmlFor="comments-open">Allow comments</Label>
          </div>
        </section>

        {type === "post" ? (
          <section className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <h2 className="text-base font-semibold tracking-tight">Categories</h2>
              <div className="space-y-2">
                {data.categories.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      aria-label={c.name}
                      checked={draft.categories.includes(c.id)}
                      disabled={!editable}
                      onCheckedChange={(checked) =>
                        update({
                          categories: checked
                            ? [...draft.categories, c.id]
                            : draft.categories.filter((id) => id !== c.id),
                        })
                      }
                    />
                    {c.name}
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-base font-semibold tracking-tight">Tags</h2>
              <TagInput tags={draft.tags} disabled={!editable} onChange={(tags) => update({ tags })} />
            </div>
          </section>
        ) : null}

        {existing ? (
          <section className="space-y-3">
            <h2 className="text-base font-semibold tracking-tight">Revisions</h2>
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-xs">
              {existing.revisions.map((rev, i) => (
                <li key={rev.id} data-testid="revision-row" className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                  <span className="min-w-0">
                    <span className="font-medium">{rev.authorName}</span>{" "}
                    <span className="text-muted-foreground">{formatDate(rev.createdAt)}</span>
                    {i === 0 ? <span className="ml-2 text-xs text-muted-foreground">Current</span> : null}
                  </span>
                  <span className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      data-testid="revision-preview"
                      onClick={async () => {
                        try {
                          setPreview(await getRevision({ data: { id: existing.item.id, revisionId: rev.id } }));
                        } catch (cause) {
                          toast.error(errorMessage(cause));
                        }
                      }}
                    >
                      Preview
                    </Button>
                    {editable && i > 0 ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        data-testid="revision-restore"
                        onClick={() =>
                          run(() => restoreRevision({ data: { id: existing.item.id, revisionId: rev.id } }), "Revision restored")
                        }
                      >
                        Restore
                      </Button>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      {preview ? (
        <Dialog open onOpenChange={(open) => !open && setPreview(null)}>
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{preview.title || "(no title)"}</DialogTitle>
              <p className="text-sm text-muted-foreground">{formatDate(preview.createdAt)}</p>
            </DialogHeader>
            {preview.excerpt ? <p className="text-sm italic text-muted-foreground">{preview.excerpt}</p> : null}
            <Blocks blocks={preview.blocks} mediaBase="/api/media" />
          </DialogContent>
        </Dialog>
      ) : null}

      {confirmDelete && existing ? (
        <ConfirmDialog
          title="Delete permanently?"
          confirmLabel="Delete"
          destructive
          pending={pending}
          onClose={() => setConfirmDelete(false)}
          onConfirm={async () => {
            const done = await run(() => deleteContent({ data: { id: existing.item.id } }).then(() => true), "Deleted");
            setConfirmDelete(false);
            if (done) await navigate({ to: "/", search: { status: "trash" } });
          }}
        >
          Its revisions and comments are deleted too.
        </ConfirmDialog>
      ) : null}
    </>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

const ADDERS = [
  { type: "paragraph", label: "Paragraph", icon: <Pilcrow /> },
  { type: "heading", label: "Heading", icon: <Heading /> },
  { type: "list", label: "List", icon: <List /> },
  { type: "quote", label: "Quote", icon: <Quote /> },
  { type: "image", label: "Image", icon: <Image /> },
  { type: "separator", label: "Separator", icon: <Minus /> },
] as const;

function newBlock(type: Block["type"]): Block {
  const id = crypto.randomUUID();
  switch (type) {
    case "paragraph":
      return { id, type, text: "" };
    case "heading":
      return { id, type, text: "", level: 2 };
    case "list":
      return { id, type, ordered: false, items: [] };
    case "quote":
      return { id, type, text: "", cite: "" };
    case "image":
      return { id, type, mediaId: null, alt: "", caption: "" };
    case "separator":
      return { id, type };
  }
}

type LibraryItem = Data["library"][number];

function BlockEditor({
  block,
  disabled,
  library,
  first,
  last,
  onChange,
  onMove,
  onRemove,
}: {
  block: Block;
  disabled: boolean;
  library: LibraryItem[];
  first: boolean;
  last: boolean;
  onChange: (block: Block) => void;
  onMove: (delta: number) => void;
  onRemove: () => void;
}) {
  const [picking, setPicking] = useState(false);
  const label = ADDERS.find((a) => a.type === block.type)?.label ?? block.type;
  return (
    <div data-testid="block" className="space-y-2 rounded-xl border border-border bg-card p-3 shadow-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground uppercase">{label}</span>
        {!disabled ? (
          <span className="flex gap-0.5">
            <Button variant="ghost" size="icon-sm" aria-label="Move up" data-testid="block-up" disabled={first} onClick={() => onMove(-1)}>
              <ArrowUp />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="Move down" data-testid="block-down" disabled={last} onClick={() => onMove(1)}>
              <ArrowDown />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="Remove block" data-testid="block-remove" onClick={onRemove}>
              <X />
            </Button>
          </span>
        ) : null}
      </div>
      {block.type === "paragraph" ? (
        <Textarea
          data-testid="block-text"
          aria-label="Paragraph"
          rows={3}
          value={block.text}
          disabled={disabled}
          onChange={(e) => onChange({ ...block, text: e.target.value })}
        />
      ) : null}
      {block.type === "heading" ? (
        <div className="flex gap-2">
          <OptionSelect
            label="Heading level"
            testId="block-level"
            value={String(block.level)}
            disabled={disabled}
            options={[
              { value: "2", label: "H2" },
              { value: "3", label: "H3" },
              { value: "4", label: "H4" },
            ]}
            onChange={(v) => onChange({ ...block, level: Number(v) as 2 | 3 | 4 })}
            className="w-20"
          />
          <Input
            data-testid="block-text"
            aria-label="Heading"
            value={block.text}
            disabled={disabled}
            onChange={(e) => onChange({ ...block, text: e.target.value })}
            className="font-semibold"
          />
        </div>
      ) : null}
      {block.type === "list" ? (
        <>
          <Textarea
            data-testid="block-text"
            aria-label="List items, one per line"
            placeholder="One item per line"
            rows={3}
            value={block.items.join("\n")}
            disabled={disabled}
            onChange={(e) => onChange({ ...block, items: e.target.value.split("\n") })}
          />
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              aria-label="Numbered"
              checked={block.ordered}
              disabled={disabled}
              onCheckedChange={(checked) => onChange({ ...block, ordered: Boolean(checked) })}
            />
            Numbered
          </label>
        </>
      ) : null}
      {block.type === "quote" ? (
        <>
          <Textarea
            data-testid="block-text"
            aria-label="Quote"
            rows={2}
            value={block.text}
            disabled={disabled}
            onChange={(e) => onChange({ ...block, text: e.target.value })}
            className="italic"
          />
          <Input
            data-testid="block-cite"
            aria-label="Source"
            placeholder="Source"
            value={block.cite}
            disabled={disabled}
            onChange={(e) => onChange({ ...block, cite: e.target.value })}
          />
        </>
      ) : null}
      {block.type === "image" ? (
        <div className="space-y-2">
          {block.mediaId ? (
            <img src={`/api/media/${block.mediaId}`} alt={block.alt} className="max-h-64 rounded-lg border border-border" />
          ) : null}
          {!disabled ? (
            <Button variant="outline" size="sm" data-testid="block-pick-image" onClick={() => setPicking(true)}>
              <Image /> {block.mediaId ? "Replace image" : "Choose image"}
            </Button>
          ) : null}
          <Input
            data-testid="block-alt"
            aria-label="Alt text"
            placeholder="Alt text"
            value={block.alt}
            disabled={disabled}
            onChange={(e) => onChange({ ...block, alt: e.target.value })}
          />
          <Input
            data-testid="block-caption"
            aria-label="Caption"
            placeholder="Caption"
            value={block.caption}
            disabled={disabled}
            onChange={(e) => onChange({ ...block, caption: e.target.value })}
          />
          {picking ? (
            <Dialog open onOpenChange={(open) => !open && setPicking(false)}>
              <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Choose an image</DialogTitle>
                </DialogHeader>
                {library.length === 0 ? (
                  <EmptyState
                    title="No images in the library"
                    description={<Link to="/media" className="text-primary hover:underline">Upload one in Media.</Link>}
                  />
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {library.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        data-testid="media-option"
                        className="space-y-1 rounded-lg border border-border p-2 text-left text-xs hover:border-primary"
                        onClick={() => {
                          onChange({ ...block, mediaId: m.id, alt: block.alt || m.alt, caption: block.caption || m.caption });
                          setPicking(false);
                        }}
                      >
                        <img src={`/api/media/${m.id}`} alt={m.alt} className="aspect-video w-full rounded object-cover" />
                        <span className="block truncate">{m.filename}</span>
                      </button>
                    ))}
                  </div>
                )}
              </DialogContent>
            </Dialog>
          ) : null}
        </div>
      ) : null}
      {block.type === "separator" ? <hr className="border-border" /> : null}
    </div>
  );
}

function TagInput({ tags, disabled, onChange }: { tags: string[]; disabled: boolean; onChange: (tags: string[]) => void }) {
  const [value, setValue] = useState("");
  const add = () => {
    const names = value.split(",").map((t) => t.trim()).filter(Boolean);
    const next = [...tags];
    for (const n of names) if (!next.some((t) => t.toLowerCase() === n.toLowerCase())) next.push(n);
    onChange(next);
    setValue("");
  };
  return (
    <div className="space-y-2">
      <Input
        data-testid="tag-input"
        aria-label="Add tags"
        placeholder="Type a tag and press Enter"
        value={value}
        disabled={disabled}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add();
          }
        }}
        onBlur={() => value.trim() && add()}
        className="bg-card"
      />
      <div className="flex flex-wrap gap-1.5">
        {tags.map((t) => (
          <Badge key={t} variant="secondary" data-testid="tag-chip">
            {t}
            {!disabled ? (
              <button type="button" aria-label={`Remove ${t}`} onClick={() => onChange(tags.filter((x) => x !== t))}>
                <X className="size-3" />
              </button>
            ) : null}
          </Badge>
        ))}
      </div>
    </div>
  );
}
