export type ProviderStatus = "ok" | "error" | "unavailable";

export interface ProviderData {
  name: string;
  status: ProviderStatus;
  error?: string;
  primaryPercent?: number;
  primaryLabel?: string;
  primaryResetsAt?: Date;
  secondaryPercent?: number;
  secondaryLabel?: string;
  secondaryResetsAt?: Date;
  tertiaryPercent?: number;
  tertiaryLabel?: string;
  tertiaryResetsAt?: Date;
  extraUsageEnabled?: boolean;
  planLabel?: string;
  resetCreditsAvailable?: number;
  resetCreditsApplicable?: number;
  resetCreditsExpiresAt?: Date;
}

export interface FlatProviderVars {
  available: boolean;
  error: string;
  primary_pct: number;
  primary_fill_pct: string;
  primary_label: string;
  primary_resets: string;
  secondary_pct: number;
  secondary_fill_pct: string;
  secondary_label: string;
  secondary_resets: string;
  tertiary_pct: number;
  tertiary_fill_pct: string;
  tertiary_label: string;
  tertiary_resets: string;
  extra_usage_status: string;
  plan_label: string;
  reset_credits_available: number;
  reset_credits_applicable: number;
  reset_credits_expires: string;
}

export interface TrmnlPayload {
  claude: FlatProviderVars;
  codex: FlatProviderVars;
  updated_at: string;
}
