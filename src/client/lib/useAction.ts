import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

export function errorMessage(cause: unknown): string {
  if (cause instanceof Error && cause.message) {
    // Validation errors arrive as a JSON list of issues.
    try {
      const issues = JSON.parse(cause.message) as { message?: string }[];
      if (Array.isArray(issues) && issues[0]?.message) return issues[0].message;
    } catch {
      // A plain sentence.
    }
    return cause.message;
  }
  return "That didn't work. Try again.";
}

/** Runs a change, shows the outcome as a toast and reloads the page's data. */
export function useAction() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  async function run<T>(work: () => Promise<T>, success?: string): Promise<T | undefined> {
    setPending(true);
    try {
      const result = await work();
      if (success) toast.success(success);
      await router.invalidate();
      return result;
    } catch (cause) {
      toast.error(errorMessage(cause));
      return undefined;
    } finally {
      setPending(false);
    }
  }
  return { run, pending };
}

export function formatDate(ms: number | null | undefined): string {
  if (!ms) return "";
  return new Date(ms).toLocaleString("en", { dateStyle: "medium", timeStyle: "short" });
}

export function formatDay(ms: number | null | undefined): string {
  if (!ms) return "";
  return new Date(ms).toLocaleDateString("en", { dateStyle: "long" });
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
