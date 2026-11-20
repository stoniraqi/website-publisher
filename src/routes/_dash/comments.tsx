import { createFileRoute, Link } from "@tanstack/react-router";
import { MessageSquare } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { Button } from "@/client/components/ui/button";
import { Textarea } from "@/client/components/ui/textarea";
import { formatDate, useAction } from "@/client/lib/useAction";
import { COMMENT_STATUSES, type CommentStatus } from "@/server/permissions";
import { deleteComment, getComments, moderateComment, replyToComment } from "@/serverFunctions/library";

export const Route = createFileRoute("/_dash/comments")({
  validateSearch: z.object({ status: z.enum(COMMENT_STATUSES).optional().catch(undefined) }),
  loaderDeps: ({ search }) => ({ status: search.status ?? "pending" }),
  loader: ({ deps }) => getComments({ data: deps }),
  head: () => ({ meta: [{ title: "Comments" }] }),
  component: CommentsPage,
});

const TABS: Record<CommentStatus, string> = { pending: "Pending", approved: "Approved", spam: "Spam", trash: "Trash" };
type Action = "approve" | "unapprove" | "spam" | "trash" | "restore";
const ACTION_LABELS: Record<Action, [string, string]> = {
  approve: ["Approve", "Comment approved"],
  unapprove: ["Unapprove", "Comment held"],
  spam: ["Spam", "Marked as spam"],
  trash: ["Trash", "Moved to trash"],
  restore: ["Restore", "Restored"],
};
const ACTIONS_BY_STATUS: Record<CommentStatus, Action[]> = {
  pending: ["approve", "spam", "trash"],
  approved: ["unapprove", "spam", "trash"],
  spam: ["restore"],
  trash: ["restore"],
};

function CommentsPage() {
  const { counts, items, canModerate } = Route.useLoaderData();
  const status = Route.useSearch().status ?? "pending";
  const { run, pending } = useAction();
  const [replying, setReplying] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [removing, setRemoving] = useState<string | null>(null);

  return (
    <>
      <PageHeader title="Comments" />
      <nav className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
        {COMMENT_STATUSES.map((s) => (
          <Link
            key={s}
            to="/comments"
            search={{ status: s }}
            data-testid={`comment-tab-${s}`}
            className={s === status ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground"}
          >
            {TABS[s]} <span className="text-muted-foreground">({counts[s]})</span>
          </Link>
        ))}
      </nav>

      {items.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title={canModerate ? `No ${TABS[status].toLowerCase()} comments` : "No comments to moderate"}
        />
      ) : (
        <ul className="space-y-3">
          {items.map((c) => (
            <li key={c.id} data-testid="comment-row" className="space-y-2 rounded-xl border border-border bg-card p-4 shadow-xs">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm">
                <span>
                  <span className="font-medium">{c.authorName}</span>{" "}
                  <span className="text-muted-foreground">{c.authorEmail}</span>
                </span>
                <span className="text-muted-foreground">{formatDate(c.createdAt)}</span>
              </div>
              <p className="text-sm whitespace-pre-line">{c.body}</p>
              <p className="text-xs text-muted-foreground">
                On <Link to="/edit/$id" params={{ id: c.postId }} className="hover:underline">{c.postTitle || "(no title)"}</Link>
              </p>
              <div className="flex flex-wrap gap-1">
                {ACTIONS_BY_STATUS[status].map((a) => (
                  <Button
                    key={a}
                    variant="ghost"
                    size="sm"
                    data-testid={`comment-${a}`}
                    disabled={pending}
                    onClick={() => run(() => moderateComment({ data: { id: c.id, action: a } }), ACTION_LABELS[a][1])}
                  >
                    {ACTION_LABELS[a][0]}
                  </Button>
                ))}
                {status === "approved" || status === "pending" ? (
                  <Button variant="ghost" size="sm" data-testid="comment-reply" onClick={() => { setReplying(c.id); setReply(""); }}>
                    Reply
                  </Button>
                ) : null}
                {status === "spam" || status === "trash" ? (
                  <Button variant="ghost" size="sm" className="text-destructive" data-testid="comment-delete" onClick={() => setRemoving(c.id)}>
                    Delete permanently
                  </Button>
                ) : null}
              </div>
              {replying === c.id ? (
                <form
                  className="space-y-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const done = await run(() => replyToComment({ data: { id: c.id, body: reply } }).then(() => true), "Reply posted");
                    if (done) setReplying(null);
                  }}
                >
                  <Textarea data-testid="reply-body" aria-label="Reply" rows={3} value={reply} onChange={(e) => setReply(e.target.value)} />
                  <div className="flex gap-2">
                    <Button type="submit" size="sm" pending={pending} data-testid="reply-submit">
                      Post reply
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setReplying(null)}>
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {removing ? (
        <ConfirmDialog
          title="Delete this comment permanently?"
          confirmLabel="Delete"
          destructive
          pending={pending}
          onClose={() => setRemoving(null)}
          onConfirm={async () => {
            await run(() => deleteComment({ data: { id: removing } }), "Deleted");
            setRemoving(null);
          }}
        />
      ) : null}
    </>
  );
}
