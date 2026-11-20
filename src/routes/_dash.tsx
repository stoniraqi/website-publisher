import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { AppShell } from "@/client/components/AppShell";
import { getMe } from "@/serverFunctions/content";

export const Route = createFileRoute("/_dash")({
  loader: () => getMe(),
  component: Dashboard,
});

const linkClass =
  "shrink-0 text-sm text-muted-foreground transition-colors hover:text-foreground data-[status=active]:font-medium data-[status=active]:text-foreground";

function Dashboard() {
  const me = Route.useLoaderData();
  const links = [
    { to: "/", label: "Content", show: true, exact: true },
    { to: "/media", label: "Media", show: me.canWrite },
    { to: "/comments", label: "Comments", show: true },
    { to: "/terms", label: "Categories", show: true },
    { to: "/people", label: "People", show: me.isAdmin },
    { to: "/settings", label: "Settings", show: me.isAdmin },
    { to: "/profile", label: "Profile", show: true },
  ] as const;
  return (
    <AppShell
      nav={
        <nav className="flex min-w-0 items-center gap-4 overflow-x-auto">
          {links
            .filter((l) => l.show)
            .map((l) => (
              <Link key={l.to} to={l.to} className={linkClass} activeOptions={{ exact: "exact" in l }}>
                {l.label}
              </Link>
            ))}
          <a href="/site" className={linkClass}>
            View site
          </a>
        </nav>
      }
    >
      <Outlet />
    </AppShell>
  );
}
