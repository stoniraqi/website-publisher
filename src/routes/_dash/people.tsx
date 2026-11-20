import { createFileRoute } from "@tanstack/react-router";
import { EmptyState } from "@/client/components/EmptyState";
import { OptionSelect } from "@/client/components/OptionSelect";
import { PageHeader } from "@/client/components/PageHeader";
import { Badge } from "@/client/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/client/components/ui/table";
import { useAction } from "@/client/lib/useAction";
import { ASSIGNABLE_ROLES, ROLE_LABELS, type AssignableRole } from "@/server/permissions";
import { getPeople, setRole } from "@/serverFunctions/library";

export const Route = createFileRoute("/_dash/people")({
  loader: () => getPeople(),
  head: () => ({ meta: [{ title: "People" }] }),
  component: PeoplePage,
});

const roleOptions = ASSIGNABLE_ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }));

function PeoplePage() {
  const data = Route.useLoaderData();
  const { run } = useAction();
  if (!data.allowed) {
    return (
      <>
        <PageHeader title="People" />
        <div data-testid="admin-only">
          <EmptyState kind="error" title="Only administrators can open this page." />
        </div>
      </>
    );
  }
  return (
    <>
      <PageHeader title="People" description="Everyone who has opened the site's dashboard." />
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Person</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="text-right">Posts</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.people.map((p) => (
              <TableRow key={p.id} data-testid="person-row">
                <TableCell className="whitespace-normal">
                  <p className="font-medium">{p.displayName}</p>
                  <p className="text-xs text-muted-foreground">{p.email}</p>
                </TableCell>
                <TableCell>
                  {p.role === "administrator" ? (
                    <Badge variant="soft">Administrator</Badge>
                  ) : (
                    <OptionSelect
                      label={`Role for ${p.email}`}
                      testId="role-select"
                      value={p.role}
                      options={roleOptions}
                      onChange={(role) => run(() => setRole({ data: { userId: p.id, role: role as AssignableRole } }), "Role changed")}
                      className="w-40"
                    />
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">{p.posts}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
