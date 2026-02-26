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
  extraSpend?: number;
  extraLimit?: number;
}

export interface FlatProviderVars {
  available: boolean;
  status: string;
  error: string;
  primary_pct: number;
  primary_fill_pct: string;
  primary_label: string;
  primary_resets: string;
  secondary_pct: number;
  secondary_fill_pct: string;
  secondary_label: string;
  secondary_resets: string;
  extra_spend: string;
}

export interface TrmnlPayload {
  claude: FlatProviderVars;
  codex: FlatProviderVars;
  gemini: FlatProviderVars;
  updated_at: string;
}
