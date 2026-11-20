import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { EmptyState } from "@/client/components/EmptyState";
import { OptionSelect } from "@/client/components/OptionSelect";
import { PageHeader } from "@/client/components/PageHeader";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { Switch } from "@/client/components/ui/switch";
import { useAction } from "@/client/lib/useAction";
import { ASSIGNABLE_ROLES, ROLE_LABELS, type AssignableRole } from "@/server/permissions";
import { getSiteSettings, saveSiteSettings } from "@/serverFunctions/library";

export const Route = createFileRoute("/_dash/settings")({
  loader: () => getSiteSettings(),
  head: () => ({ meta: [{ title: "Settings" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const data = Route.useLoaderData();
  if (!data.allowed || !data.settings) {
    return (
      <>
        <PageHeader title="Settings" />
        <div data-testid="admin-only">
          <EmptyState kind="error" title="Only administrators can open this page." />
        </div>
      </>
    );
  }
  return <SettingsForm settings={data.settings} pages={data.pages} />;
}

type Settings = NonNullable<Awaited<ReturnType<typeof getSiteSettings>>["settings"]>;

function SettingsForm({ settings, pages }: { settings: Settings; pages: { id: string; title: string; status: string }[] }) {
  const { run, pending } = useAction();
  const [form, setForm] = useState({ ...settings, postsPerPage: String(settings.postsPerPage) });
  const update = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  const frontOptions = [
    { value: "latest", label: "Latest posts" },
    ...pages.filter((p) => p.status === "published").map((p) => ({ value: p.id, label: p.title || "(no title)" })),
  ];
  return (
    <>
      <PageHeader title="Settings" />
      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          void run(
            () => saveSiteSettings({ data: { ...form, postsPerPage: Number(form.postsPerPage) } }),
            "Settings saved",
          );
        }}
      >
        <section className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-xs">
          <h2 className="text-base font-semibold tracking-tight">Site</h2>
          <div className="space-y-1.5">
            <Label htmlFor="site-title">Site title</Label>
            <Input id="site-title" data-testid="site-title" value={form.siteTitle} onChange={(e) => update({ siteTitle: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tagline">Tagline</Label>
            <Input id="tagline" data-testid="tagline" value={form.tagline} onChange={(e) => update({ tagline: e.target.value })} />
          </div>
        </section>
        <section className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-xs">
          <h2 className="text-base font-semibold tracking-tight">Reading</h2>
          <div className="space-y-1.5">
            <Label>Home shows</Label>
            <OptionSelect
              label="Home shows"
              testId="front-page"
              value={form.frontPageId ?? "latest"}
              options={frontOptions}
              onChange={(v) => update({ frontPageId: v === "latest" ? null : v })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="posts-per-page">Posts per page</Label>
            <Input
              id="posts-per-page"
              data-testid="posts-per-page"
              type="number"
              min={1}
              max={50}
              value={form.postsPerPage}
              onChange={(e) => update({ postsPerPage: e.target.value })}
              className="w-28"
            />
          </div>
        </section>
        <section className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-xs">
          <h2 className="text-base font-semibold tracking-tight">Writing and people</h2>
          <div className="space-y-1.5">
            <Label>Role for new members</Label>
            <OptionSelect
              label="Role for new members"
              testId="default-role"
              value={form.defaultRole}
              options={ASSIGNABLE_ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
              onChange={(v) => update({ defaultRole: v as AssignableRole })}
              className="w-48"
            />
          </div>
          <div className="flex items-center gap-3">
            <Switch
              id="comments-default"
              data-testid="comments-default"
              checked={form.commentsDefaultOpen}
              onCheckedChange={(checked) => update({ commentsDefaultOpen: checked })}
            />
            <Label htmlFor="comments-default">Allow comments on new posts</Label>
          </div>
        </section>
        <Button type="submit" pending={pending} data-testid="save-settings">
          Save
        </Button>
      </form>
    </>
  );
}
