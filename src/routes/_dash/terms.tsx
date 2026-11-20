import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { OptionSelect } from "@/client/components/OptionSelect";
import { PageHeader } from "@/client/components/PageHeader";
import { Button } from "@/client/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/client/components/ui/dialog";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { useAction } from "@/client/lib/useAction";
import { createTerm, deleteTerm, getTerms, updateTerm } from "@/serverFunctions/library";

export const Route = createFileRoute("/_dash/terms")({
  loader: () => getTerms(),
  head: () => ({ meta: [{ title: "Categories and tags" }] }),
  component: TermsPage,
});

type Data = Awaited<ReturnType<typeof getTerms>>;
type Term = Data["tags"][number] & { depth?: number };

function TermsPage() {
  const { categories, tags, canManage } = Route.useLoaderData();
  const [editing, setEditing] = useState<Term | null>(null);
  const [removing, setRemoving] = useState<Term | null>(null);
  const { run, pending } = useAction();
  const parentOptions = [
    { value: "none", label: "No parent" },
    ...categories.map((c) => ({ value: c.id, label: `${"— ".repeat(c.depth)}${c.name}` })),
  ];

  return (
    <>
      <PageHeader title="Categories and tags" />
      <TermSection
        title="Categories"
        kind="category"
        terms={categories}
        canManage={canManage}
        parentOptions={parentOptions}
        onEdit={setEditing}
        onDelete={setRemoving}
      />
      <TermSection title="Tags" kind="tag" terms={tags} canManage={canManage} onEdit={setEditing} onDelete={setRemoving} />

      {editing ? (
        <RenameDialog
          key={editing.id}
          term={editing}
          parentOptions={editing.kind === "category" ? parentOptions.filter((o) => o.value !== editing.id) : null}
          onClose={() => setEditing(null)}
        />
      ) : null}
      {removing ? (
        <ConfirmDialog
          title={`Delete ${removing.name}?`}
          confirmLabel="Delete"
          destructive
          pending={pending}
          onClose={() => setRemoving(null)}
          onConfirm={async () => {
            await run(() => deleteTerm({ data: { id: removing.id } }), "Deleted");
            setRemoving(null);
          }}
        >
          {removing.kind === "category"
            ? "Its posts stay; any left without a category move to Uncategorized."
            : "Its posts stay, without this tag."}
        </ConfirmDialog>
      ) : null}
    </>
  );
}

function TermSection({
  title,
  kind,
  terms,
  canManage,
  parentOptions,
  onEdit,
  onDelete,
}: {
  title: string;
  kind: "category" | "tag";
  terms: Term[];
  canManage: boolean;
  parentOptions?: { value: string; label: string }[];
  onEdit: (t: Term) => void;
  onDelete: (t: Term) => void;
}) {
  const { run, pending } = useAction();
  const [name, setName] = useState("");
  const [parent, setParent] = useState("none");
  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      {canManage ? (
        <form
          className="flex flex-wrap gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const done = await run(
              () => createTerm({ data: { kind, name, parentId: parent === "none" ? null : parent } }),
              "Added",
            );
            if (done) setName("");
          }}
        >
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={kind === "category" ? "New category" : "New tag"}
            aria-label={kind === "category" ? "New category" : "New tag"}
            data-testid={`${kind}-name`}
            className="min-w-40 flex-1 bg-card"
          />
          {parentOptions ? (
            <OptionSelect label="Parent category" testId="category-parent" value={parent} options={parentOptions} onChange={setParent} className="w-48" />
          ) : null}
          <Button type="submit" pending={pending} data-testid={`${kind}-add`}>
            Add
          </Button>
        </form>
      ) : null}
      {terms.length === 0 ? (
        <p className="text-sm text-muted-foreground">No tags yet. Tags typed in while writing a post appear here.</p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-xs">
          {terms.map((t) => (
            <li key={t.id} data-testid="term-row" className="flex items-center justify-between gap-2 px-4 py-2 text-sm">
              <span className="min-w-0" style={{ paddingLeft: `${(t.depth ?? 0) * 1.25}rem` }}>
                <a href={`/site/${kind}/${t.slug}`} className="font-medium hover:underline">
                  {t.name}
                </a>{" "}
                <span className="text-muted-foreground">
                  /{t.slug} · {t.count} {t.count === 1 ? "item" : "items"}
                </span>
              </span>
              {canManage ? (
                <span className="flex shrink-0 gap-0.5">
                  <Button variant="ghost" size="icon-sm" aria-label={`Rename ${t.name}`} data-testid="term-rename" onClick={() => onEdit(t)}>
                    <Pencil />
                  </Button>
                  {t.id !== "uncategorized" ? (
                    <Button variant="ghost" size="icon-sm" aria-label={`Delete ${t.name}`} data-testid="term-delete" onClick={() => onDelete(t)}>
                      <Trash2 />
                    </Button>
                  ) : null}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RenameDialog({
  term,
  parentOptions,
  onClose,
}: {
  term: Term;
  parentOptions: { value: string; label: string }[] | null;
  onClose: () => void;
}) {
  const { run, pending } = useAction();
  const [name, setName] = useState(term.name);
  const [slug, setSlug] = useState(term.slug);
  const [parent, setParent] = useState(term.parentId ?? "none");
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit {term.kind === "category" ? "category" : "tag"}</DialogTitle>
        </DialogHeader>
        <form
          id="rename-form"
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const done = await run(
              () =>
                updateTerm({
                  data: {
                    id: term.id,
                    name,
                    slug,
                    ...(parentOptions ? { parentId: parent === "none" ? null : parent } : {}),
                  },
                }).then(() => true),
              "Renamed",
            );
            if (done) onClose();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="term-name">Name</Label>
            <Input id="term-name" data-testid="term-rename-input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="term-slug">Slug</Label>
            <Input id="term-slug" value={slug} onChange={(e) => setSlug(e.target.value)} />
          </div>
          {parentOptions ? (
            <div className="space-y-1.5">
              <Label>Parent</Label>
              <OptionSelect label="Parent category" value={parent} options={parentOptions} onChange={setParent} />
            </div>
          ) : null}
        </form>
        <DialogFooter>
          <Button type="submit" form="rename-form" pending={pending} data-testid="term-rename-save">
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
