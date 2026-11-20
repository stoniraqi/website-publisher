import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/client/components/PageHeader";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { Textarea } from "@/client/components/ui/textarea";
import { useAction } from "@/client/lib/useAction";
import { ROLE_LABELS } from "@/server/permissions";
import { getProfile, updateProfile } from "@/serverFunctions/library";

export const Route = createFileRoute("/_dash/profile")({
  loader: () => getProfile(),
  head: () => ({ meta: [{ title: "Profile" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const profile = Route.useLoaderData();
  const { run, pending } = useAction();
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [bio, setBio] = useState(profile.bio);
  return (
    <>
      <PageHeader title="Profile" description={`${profile.email} · ${ROLE_LABELS[profile.role]}`} />
      <form
        className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-xs"
        onSubmit={(e) => {
          e.preventDefault();
          void run(() => updateProfile({ data: { displayName, bio } }), "Profile saved");
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="display-name">Display name</Label>
          <Input id="display-name" data-testid="display-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bio">Bio</Label>
          <Textarea id="bio" data-testid="bio" rows={3} value={bio} onChange={(e) => setBio(e.target.value)} />
        </div>
        <p className="text-sm text-muted-foreground">Both appear with your posts on the site.</p>
        <Button type="submit" pending={pending} data-testid="save-profile">
          Save
        </Button>
      </form>
    </>
  );
}
