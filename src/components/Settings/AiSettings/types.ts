export interface AiConfigState {
  provider: 'llamacpp' | 'ollama' | 'openrouter' | 'openai_compatible';
  model: string;
  embeddingModel: string;
  monthlyBudgetUsd: number;
  hasApiKey: boolean;
  thinkingEnabled: boolean;
  zeroDataRetention: boolean;
  /** OpenAI-compatible server: its base URL (e.g. `http://localhost:1234/v1`). */
  baseUrl: string;
  /** OpenAI-compatible server: whether a key is saved (it is optional). */
  hasBaseUrlApiKey: boolean;
}

/** Providers that talk the OpenAI Chat Completions API over HTTP (one panel). */
export function isRemoteOpenAiProvider(provider: AiConfigState['provider']): boolean {
  return provider === 'openrouter' || provider === 'openai_compatible';
}

export type RoutingMode = 'always_rag' | 'auto' | 'always_tools';
export const DEFAULT_ROUTING_MODE: RoutingMode = 'always_rag';
export const ROUTING_MODES: RoutingMode[] = ['always_rag', 'auto', 'always_tools'];

export function isRoutingMode(v: string | null): v is RoutingMode {
  return v != null && (ROUTING_MODES as string[]).includes(v);
}
