import type { ProviderData, FlatProviderVars } from "./types.js";

function formatReset(date?: Date): string {
  if (!date) return "";
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const time = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  if (isToday) return time;

  const weekday = date.toLocaleDateString("en-US", { weekday: "short" });
  return `${weekday} ${time}`;
}

function formatExpiry(date?: Date): string {
  if (!date) return "";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatPercent(percent?: number): number {
  return Math.max(0, Math.min(100, Math.round(percent ?? 0)));
}

export function flatten(data: ProviderData): FlatProviderVars {
  const isAvailable = data.status === "ok";
  const primaryPercent = formatPercent(data.primaryPercent);
  const secondaryPercent = formatPercent(data.secondaryPercent);
  const tertiaryPercent = formatPercent(data.tertiaryPercent);

  return {
    available: isAvailable,
    error: data.error ?? "",
    primary_pct: primaryPercent,
    primary_fill_pct: `${primaryPercent}%`,
    primary_label: data.primaryLabel ?? "",
    primary_resets: formatReset(data.primaryResetsAt),
    secondary_pct: secondaryPercent,
    secondary_fill_pct: `${secondaryPercent}%`,
    secondary_label: data.secondaryLabel ?? "",
    secondary_resets: formatReset(data.secondaryResetsAt),
    tertiary_pct: tertiaryPercent,
    tertiary_fill_pct: `${tertiaryPercent}%`,
    tertiary_label: data.tertiaryLabel ?? "",
    tertiary_resets: formatReset(data.tertiaryResetsAt),
    extra_usage_status: data.extraUsageEnabled == null ? "" : data.extraUsageEnabled ? "On" : "Off",
    plan_label: data.planLabel ?? "",
    reset_credits_available: data.resetCreditsAvailable ?? 0,
    reset_credits_applicable: data.resetCreditsApplicable ?? 0,
    reset_credits_expires: formatExpiry(data.resetCreditsExpiresAt),
  };
}
