import { createFileRoute, useRouter } from "@tanstack/react-router";
import { FileIcon, ImageIcon, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { Button } from "@/client/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/client/components/ui/dialog";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { Textarea } from "@/client/components/ui/textarea";
import { formatDay, formatSize, useAction } from "@/client/lib/useAction";
import { deleteMedia, getMedia, updateMedia } from "@/serverFunctions/library";

export const Route = createFileRoute("/_dash/media")({
  loader: () => getMedia(),
  head: () => ({ meta: [{ title: "Media" }] }),
  component: MediaPage,
});

type Item = Awaited<ReturnType<typeof getMedia>>["items"][number];

function typeLabel(item: Item): string {
  const ext = item.filename.includes(".") ? item.filename.split(".").pop()! : item.mime.split("/").pop()!;
  return ext.toUpperCase().slice(0, 8);
}

function MediaPage() {
  const { items, canUpload, maxBytes } = Route.useLoaderData();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [open, setOpen] = useState<Item | null>(null);

  async function upload(files: FileList | File[]) {
    const list = [...files];
    if (list.length === 0) return;
    setUploading(true);
    try {
      for (const file of list) {
        if (file.size > maxBytes) {
          toast.error(`${file.name} is over ${formatSize(maxBytes)}.`);
          continue;
        }
        const form = new FormData();
        form.append("file", file);
        const response = await fetch("/api/media", { method: "POST", body: form });
        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as { error?: string } | null;
          toast.error(body?.error ?? `${file.name} couldn't be uploaded.`);
        }
      }
      await router.invalidate();
    } finally {
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <>
      <PageHeader
        title="Media"
        actions={
          canUpload ? (
            <Button pending={uploading} onClick={() => input.current?.click()}>
              <Upload /> Upload
            </Button>
          ) : null
        }
      />
      {canUpload ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void upload(e.dataTransfer.files);
          }}
          className={`rounded-xl border-2 border-dashed p-6 text-center text-sm text-muted-foreground ${dragging ? "border-primary bg-primary/5" : "border-border"}`}
        >
          Drop files here, up to {formatSize(maxBytes)} each.
          <input
            ref={input}
            type="file"
            multiple
            className="hidden"
            data-testid="media-upload-input"
            onChange={(e) => e.target.files && void upload(e.target.files)}
          />
        </div>
      ) : null}

      {items.length === 0 ? (
        <EmptyState icon={ImageIcon} title="No files yet" description={canUpload ? "Uploaded files appear here." : undefined} />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              data-testid="media-item"
              onClick={() => setOpen(item)}
              className="space-y-2 overflow-hidden rounded-xl border border-border bg-card p-2 text-left shadow-xs transition-colors hover:border-primary"
            >
              {item.mime.startsWith("image/") ? (
                <img src={`/api/media/${item.id}`} alt={item.alt} className="aspect-video w-full rounded-lg object-cover" />
              ) : (
                <div className="flex aspect-video w-full items-center justify-center rounded-lg bg-muted">
                  <FileIcon className="size-8 text-muted-foreground" />
                </div>
              )}
              <div className="space-y-0.5 px-1 text-xs">
                <p className="truncate text-sm font-medium">{item.filename}</p>
                <p className="text-muted-foreground">
                  {typeLabel(item)} · {formatSize(item.size)}
                </p>
                <p className="truncate text-muted-foreground">
                  {formatDay(item.createdAt)} · {item.uploaderName}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
      {open ? <MediaDialog key={open.id} item={open} onClose={() => setOpen(null)} /> : null}
    </>
  );
}

function MediaDialog({ item, onClose }: { item: Item; onClose: () => void }) {
  const { run, pending } = useAction();
  const [title, setTitle] = useState(item.title);
  const [alt, setAlt] = useState(item.alt);
  const [caption, setCaption] = useState(item.caption);
  const [confirm, setConfirm] = useState(false);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="truncate">{item.filename}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {item.mime} · {formatSize(item.size)} · {formatDay(item.createdAt)} · {item.uploaderName}
          </p>
        </DialogHeader>
        {item.mime.startsWith("image/") ? (
          <img src={`/api/media/${item.id}`} alt={item.alt} className="max-h-56 w-full rounded-lg object-contain" />
        ) : (
          <a href={`/api/media/${item.id}`} className="text-sm text-primary hover:underline">
            Download
          </a>
        )}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="media-title">Title</Label>
            <Input id="media-title" data-testid="media-title" value={title} disabled={!item.canChange} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="media-alt">Alt text</Label>
            <Input id="media-alt" data-testid="media-alt" value={alt} disabled={!item.canChange} onChange={(e) => setAlt(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="media-caption">Caption</Label>
            <Textarea id="media-caption" data-testid="media-caption" rows={2} value={caption} disabled={!item.canChange} onChange={(e) => setCaption(e.target.value)} />
          </div>
        </div>
        {item.canChange ? (
          <DialogFooter>
            <Button variant="destructive" data-testid="delete-media" onClick={() => setConfirm(true)}>
              Delete
            </Button>
            <Button
              data-testid="save-media"
              pending={pending}
              onClick={() => run(() => updateMedia({ data: { id: item.id, title, alt, caption } }), "Media saved")}
            >
              Save
            </Button>
          </DialogFooter>
        ) : null}
        {confirm ? (
          <ConfirmDialog
            title={`Delete ${item.filename}?`}
            confirmLabel="Delete"
            destructive
            pending={pending}
            onClose={() => setConfirm(false)}
            onConfirm={async () => {
              await run(() => deleteMedia({ data: { id: item.id } }), "Deleted");
              setConfirm(false);
              onClose();
            }}
          >
            Posts that show it will have an empty image.
          </ConfirmDialog>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
