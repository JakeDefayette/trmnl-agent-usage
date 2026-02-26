import type { ProviderData, FlatProviderVars } from "./types.js";

function formatResetTime(date?: Date): string {
  if (!date) return "";
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();

  if (diffMs <= 0) return "Resetting now";

  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 60) return `Resets in ${diffMin}m`;

  const diffHours = Math.floor(diffMin / 60);
  const remainMin = diffMin % 60;
  if (diffHours < 24) {
    return remainMin > 0 ? `Resets in ${diffHours}h ${remainMin}m` : `Resets in ${diffHours}h`;
  }

  // Format as date
  return `Resets ${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}, ${date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
}

function formatSpend(amount?: number, limit?: number): string {
  if (amount == null) return "";
  const spent = `$${amount.toFixed(2)}`;
  if (limit != null) return `${spent} / $${limit.toFixed(2)}`;
  return spent;
}

export function flatten(data: ProviderData): FlatProviderVars {
  const isAvailable = data.status === "ok";

  return {
    available: isAvailable,
    status: data.status,
    error: data.error ?? "",
    primary_pct: data.primaryPercent ?? 0,
    primary_fill_pct: `${data.primaryPercent ?? 0}%`,
    primary_label: data.primaryLabel ?? "",
    primary_resets: formatResetTime(data.primaryResetsAt),
    secondary_pct: data.secondaryPercent ?? 0,
    secondary_fill_pct: `${data.secondaryPercent ?? 0}%`,
    secondary_label: data.secondaryLabel ?? "",
    secondary_resets: formatResetTime(data.secondaryResetsAt),
    extra_spend: formatSpend(data.extraSpend, data.extraLimit),
  };
}
