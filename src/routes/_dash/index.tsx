import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { FileText, Plus } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { EmptyState } from "@/client/components/EmptyState";
import { OptionSelect } from "@/client/components/OptionSelect";
import { PageHeader } from "@/client/components/PageHeader";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/client/components/ui/table";
import { formatDate } from "@/client/lib/useAction";
import { STATUSES, STATUS_LABELS, type Status } from "@/server/permissions";
import { getContentList, getMe } from "@/serverFunctions/content";

const search = z.object({
  type: z.enum(["all", "post", "page"]).catch("all").optional(),
  status: z.enum(["all", ...STATUSES]).catch("all").optional(),
  author: z.string().optional().catch(undefined),
  category: z.string().optional().catch(undefined),
  q: z.string().optional().catch(undefined),
  page: z.coerce.number().int().min(1).optional().catch(undefined),
});

export const Route = createFileRoute("/_dash/")({
  validateSearch: search,
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const [list, me] = await Promise.all([getContentList({ data: deps }), getMe()]);
    return { list, me };
  },
  head: () => ({ meta: [{ title: "Content" }] }),
  component: ContentPage,
});

const TAB_LABELS: Record<"all" | Status, string> = {
  all: "All",
  draft: "Drafts",
  pending: "Pending",
  scheduled: "Scheduled",
  published: "Published",
  private: "Private",
  trash: "Trash",
};

const statusVariant: Record<Status, "secondary" | "warning" | "info" | "success" | "outline" | "destructive"> = {
  draft: "secondary",
  pending: "warning",
  scheduled: "info",
  published: "success",
  private: "outline",
  trash: "destructive",
};

function ContentPage() {
  const { list, me } = Route.useLoaderData();
  const filters = Route.useSearch();
  const navigate = useNavigate({ from: "/" });
  const [q, setQ] = useState(filters.q ?? "");
  const status = filters.status ?? "all";
  const pages = Math.max(1, Math.ceil(list.total / list.pageSize));
  const filtered = Boolean(filters.q || filters.author || filters.category || (filters.type && filters.type !== "all"));
  const setFilter = (patch: Partial<z.infer<typeof search>>) =>
    navigate({ search: (prev) => ({ ...prev, ...patch, page: undefined }) });

  return (
    <>
      <PageHeader
        title="Content"
        actions={
          me.canWrite ? (
            <>
              <Button render={<Link to="/edit/$id" params={{ id: "new" }} search={{ type: "post" }} />} data-testid="new-post">
                <Plus /> New post
              </Button>
              {me.canCreatePages ? (
                <Button
                  variant="outline"
                  render={<Link to="/edit/$id" params={{ id: "new" }} search={{ type: "page" }} />}
                  data-testid="new-page"
                >
                  <Plus /> New page
                </Button>
              ) : null}
            </>
          ) : null
        }
      />

      <div className="space-y-4">
        <nav className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
          {(["all", ...STATUSES] as const).map((s) => (
            <Link
              key={s}
              to="/"
              search={(prev) => ({ ...prev, status: s === "all" ? undefined : s, page: undefined })}
              data-testid={`status-tab-${s}`}
              className={
                s === status
                  ? "font-medium text-foreground"
                  : "text-muted-foreground transition-colors hover:text-foreground"
              }
            >
              {TAB_LABELS[s]} <span className="text-muted-foreground">({list.counts[s] ?? 0})</span>
            </Link>
          ))}
        </nav>

        <div className="grid gap-2 sm:grid-cols-4">
          <form
            className="sm:col-span-4"
            onSubmit={(e) => {
              e.preventDefault();
              setFilter({ q: q.trim() || undefined });
            }}
          >
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search titles and text"
              aria-label="Search"
              data-testid="content-search"
              className="bg-card"
            />
          </form>
          <OptionSelect
            label="Type"
            testId="filter-type"
            value={filters.type ?? "all"}
            onChange={(v) => setFilter({ type: v === "all" ? undefined : (v as "post" | "page") })}
            options={[
              { value: "all", label: "Posts and pages" },
              { value: "post", label: "Posts" },
              { value: "page", label: "Pages" },
            ]}
          />
          <OptionSelect
            label="Author"
            testId="filter-author"
            value={filters.author ?? "all"}
            onChange={(v) => setFilter({ author: v === "all" ? undefined : v })}
            options={[{ value: "all", label: "Any author" }, ...list.authors.map((a) => ({ value: a.id, label: a.name }))]}
          />
          <OptionSelect
            label="Category"
            testId="filter-category"
            value={filters.category ?? "all"}
            onChange={(v) => setFilter({ category: v === "all" ? undefined : v })}
            options={[
              { value: "all", label: "Any category" },
              ...list.categories.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
        </div>

        {list.items.length === 0 ? (
          <EmptyState
            kind={filtered ? "filtered" : "no-data"}
            icon={filtered ? undefined : FileText}
            title={filtered ? "Nothing matches these filters" : status === "trash" ? "The trash is empty" : "Nothing here yet"}
            description={
              filtered || status !== "all" || !me.canWrite ? undefined : "Write a post and it will appear here."
            }
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead className="hidden sm:table-cell">Author</TableHead>
                  <TableHead className="hidden md:table-cell">Categories</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden sm:table-cell">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.items.map((item) => (
                  <TableRow key={item.id} data-testid="content-row">
                    <TableCell className="max-w-64 whitespace-normal">
                      <Link to="/edit/$id" params={{ id: item.id }} className="font-medium hover:underline">
                        {item.title || "(no title)"}
                      </Link>
                      {item.type === "page" ? <span className="ml-2 text-xs text-muted-foreground">Page</span> : null}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">{item.authorName}</TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {item.categories.join(", ")}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[item.status]}>{STATUS_LABELS[item.status]}</Badge>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground">
                      {formatDate(item.publishAt ?? item.updatedAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {pages > 1 ? (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Page {list.page} of {pages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={list.page <= 1}
                onClick={() => navigate({ search: (prev) => ({ ...prev, page: list.page - 1 }) })}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={list.page >= pages}
                onClick={() => navigate({ search: (prev) => ({ ...prev, page: list.page + 1 }) })}
              >
                Next
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
