// What each role may do. Every server function and route asks here.

export const ROLES = ["administrator", "editor", "author", "contributor", "subscriber"] as const;
export type Role = (typeof ROLES)[number];
/** Roles an administrator can give; administrator comes from the Gateway. */
export const ASSIGNABLE_ROLES = ["editor", "author", "contributor", "subscriber"] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export const STATUSES = ["draft", "pending", "scheduled", "published", "private", "trash"] as const;
export type Status = (typeof STATUSES)[number];
export type ContentType = "post" | "page";

export interface Actor {
  id: string;
  role: Role;
}

export interface OwnedContent {
  type: ContentType;
  status: Status;
  authorId: string;
}

const rank: Record<Role, number> = {
  subscriber: 0,
  contributor: 1,
  author: 2,
  editor: 3,
  administrator: 4,
};
const atLeast = (actor: Actor, role: Role) => rank[actor.role] >= rank[role];

export const isAdministrator = (actor: Actor) => actor.role === "administrator";
export const canWrite = (actor: Actor) => atLeast(actor, "contributor");
export const canEditOthers = (actor: Actor) => atLeast(actor, "editor");
export const canPublish = (actor: Actor) => atLeast(actor, "author");
export const canUpload = (actor: Actor) => atLeast(actor, "author");
export const canManageTerms = (actor: Actor) => atLeast(actor, "editor");
export const canModerateAll = (actor: Actor) => atLeast(actor, "editor");

/** Whether the person may create content of this type at all. */
export function canCreate(actor: Actor, type: ContentType): boolean {
  return type === "page" ? canEditOthers(actor) : canWrite(actor);
}

/** Whether the person may open the item in the dashboard. */
export function canRead(actor: Actor, item: OwnedContent): boolean {
  if (canEditOthers(actor) || item.authorId === actor.id) return true;
  return item.status === "published";
}

/** Whether the person may change the item as it is now. */
export function canEdit(actor: Actor, item: OwnedContent): boolean {
  if (canEditOthers(actor)) return true;
  if (item.authorId !== actor.id || !canCreate(actor, item.type)) return false;
  if (canPublish(actor)) return true;
  // Contributors: only until it's published or scheduled.
  return item.status === "draft" || item.status === "pending" || item.status === "trash";
}

/** Whether the person may move an item into this status. */
export function canSetStatus(actor: Actor, status: Status): boolean {
  if (status === "draft" || status === "pending" || status === "trash") return canWrite(actor);
  return canPublish(actor);
}

export function canDeleteMedia(actor: Actor, uploaderId: string): boolean {
  return canEditOthers(actor) || (canUpload(actor) && uploaderId === actor.id);
}

/** Whether the person may moderate comments on an item by this author. */
export function canModerate(actor: Actor, postAuthorId: string): boolean {
  return canModerateAll(actor) || (canPublish(actor) && postAuthorId === actor.id);
}

export const ROLE_LABELS: Record<Role, string> = {
  administrator: "Administrator",
  editor: "Editor",
  author: "Author",
  contributor: "Contributor",
  subscriber: "Subscriber",
};

export const STATUS_LABELS: Record<Status, string> = {
  draft: "Draft",
  pending: "Pending review",
  scheduled: "Scheduled",
  published: "Published",
  private: "Private",
  trash: "Trash",
};

export const COMMENT_STATUSES = ["pending", "approved", "spam", "trash"] as const;
export type CommentStatus = (typeof COMMENT_STATUSES)[number];
