import type { ProviderData } from "../types.js";

export interface ProviderFetcher {
  name: string;
  fetch(): Promise<ProviderData>;
}
