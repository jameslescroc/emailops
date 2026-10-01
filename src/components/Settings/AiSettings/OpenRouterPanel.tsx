import { useTranslation } from 'react-i18next';
import { Select } from '@/components/shared/Select';
import type { AiModelInfo, CatalogModel } from '@/types';
import { MIN_CONTEXT_BUDGET } from './helpers';
import { recommendedEmbeddingOptions } from './openRouterEmbeddingOptions';
import { ThinkingToggle } from './ThinkingToggle';
import type { AiConfigState } from './types';
import { UsageSummary } from './UsageSummary';

interface OpenRouterPanelProps {
  config: AiConfigState;
  setConfig: (next: AiConfigState) => void;
  apiKey: string;
  setApiKey: (key: string) => void;
  /** Prompt budget (tokens) for remote models, `chat.remote_n_ctx_budget`. */
  contextBudget: number;
  onContextBudgetChange: (tokens: number) => void;
  /** OpenRouter's embedding models; empty until a saved key lets them load. */
  embeddingModels: AiModelInfo[];
  /** The selected embedding model will be checked by the backend on Save. */
  embeddingNeedsCheck: boolean;
  /** In-app embedding models (server mode can index with them locally). */
  localEmbeddingModels?: CatalogModel[];
  /** False when this build or machine cannot run the in-app runtime. */
  localEmbeddingAvailable?: boolean;
}

/** Inputs shared by both modes. */
const INPUT_CLASS =
  'w-full bg-[#333] text-gray-200 border border-gray-600 rounded px-3 py-2 text-sm focus:border-primary-500 outline-none font-mono';

/**
 * Panel for the two providers that speak the OpenAI Chat Completions API:
 * OpenRouter, and a user-configured OpenAI-compatible server (LM Studio,
 * vLLM, llama-server, LiteLLM, a local proxy…). The server mode adds a base
 * URL, makes the key optional, and drops what only OpenRouter has: budget /
 * usage (costs are not reported), data policy and zero data retention. The
 * server is used for chat; the email index comes from the in-app model
 * (default, nothing leaves the machine), from OpenRouter (uses the OpenRouter
 * key, checked like on its own tab), or from nothing (keyword search).
 *
 * OpenRouter mode: API key, free-form chat model id, an optional embedding
 * model and a monthly USD budget cap.
 *
 * With OpenRouter selected, embeddings run on OpenRouter too: the text of
 * every indexed email and every search or chat query is sent there, which is
 * why the selector starts at "none" (keyword-only search) and carries a
 * notice. A chosen model is checked on Save against the email index's vector
 * size before it is stored — see `validate_openrouter_embedding_model`.
 *
 * Requests always forbid providers that train on or store prompts (fixed in
 * the backend, see `ai/openrouter.rs`); zero data retention is the user's call
 * because it rules out many models.
 */
export function OpenRouterPanel({
  config,
  setConfig,
  apiKey,
  setApiKey,
  contextBudget,
  onContextBudgetChange,
  embeddingModels,
  embeddingNeedsCheck,
  localEmbeddingModels = [],
  localEmbeddingAvailable = true,
}: OpenRouterPanelProps) {
  const { t } = useTranslation(['common', 'settings']);
  const custom = config.provider === 'openai_compatible';
  // Recommended models lead the list (they are offered before the catalogue
  // has loaded too); the rest of the catalogue follows, each model once.
  const { none, recommended } = recommendedEmbeddingOptions(t);
  const listed = embeddingModels
    .filter((m) => !recommended.some((r) => r.value === m.id))
    .map((m) => ({ value: m.id, label: m.id }));
  const known = [...recommended, ...listed];
  const local = custom
    ? localEmbeddingModels.map((m) => ({
        value: m.id,
        label: t('settings:openAiCompatible.embeddingLocalOption', { name: m.displayName }),
      }))
    : [];
  const openRouterOptions = custom
    ? known.map((o) => ({ ...o, label: t('settings:openAiCompatible.embeddingOpenRouterOption', { name: o.label }) }))
    : known;
  const offered = [...local, ...openRouterOptions];
  const embeddingOptions = [
    none,
    // A saved model the list no longer has (or could not load) stays selectable.
    ...(config.embeddingModel !== '' && !offered.some((o) => o.value === config.embeddingModel)
      ? [{ value: config.embeddingModel, label: config.embeddingModel }]
      : []),
    ...offered,
  ];
  // Where the server-mode index is built, for the notice under the selector.
  const embedsWithOpenRouter = custom && config.embeddingModel.includes('/');
  const embedsLocally = custom && config.embeddingModel !== '' && !embedsWithOpenRouter;
  return (
    <div className="space-y-4">
      {custom && (
        <div>
          <label htmlFor="ai-base-url" className="block text-sm font-medium text-gray-300 mb-1">
            {t('settings:openAiCompatible.baseUrl')}
          </label>
          <input
            id="ai-base-url"
            value={config.baseUrl}
            onChange={(e) => setConfig({ ...config, baseUrl: e.target.value })}
            placeholder={'http://localhost:1234/v1'} // i18n-ignore: example server URL, not user-facing copy
            spellCheck={false}
            className={INPUT_CLASS}
          />
          <p className="text-xs text-gray-500 mt-1">{t('settings:openAiCompatible.baseUrlHelp')}</p>
        </div>
      )}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">
          {t('settings:ai.apiKey')}
          {custom && (
            <span className="text-gray-500 font-normal"> {t('settings:openAiCompatible.apiKeyOptional')}</span>
          )}
          {(custom ? config.hasBaseUrlApiKey : config.hasApiKey) && (
            <span className="text-gray-500 font-normal"> {t('settings:ai.apiKeySaved')}</span>
          )}
        </label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={config.hasApiKey ? '••••••••••••••••' : t('settings:openRouter.apiKeyPlaceholder')}
          className="w-full bg-[#333] text-gray-200 border border-gray-600 rounded px-3 py-2 text-sm focus:border-primary-500 outline-none font-mono"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">{t('settings:ai.chatModel')}</label>
        <input
          type="text"
          value={config.model}
          onChange={(e) => setConfig({ ...config, model: e.target.value })}
          placeholder={
            custom ? t('settings:openAiCompatible.chatModelPlaceholder') : t('settings:openRouter.chatModelPlaceholder')
          }
          className="w-full bg-[#333] text-gray-200 border border-gray-600 rounded px-3 py-2 text-sm focus:border-primary-500 outline-none font-mono"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">{t('settings:ai.embeddingModel')}</label>
        <Select
          value={config.embeddingModel}
          options={embeddingOptions}
          onChange={(value) => setConfig({ ...config, embeddingModel: value })}
          ariaLabel={t('settings:ai.embeddingModel')}
          fullWidth
        />
        {!custom && <p className="text-xs text-gray-500 mt-1">{t('settings:openRouter.embeddingNotice')}</p>}
        {custom && <p className="text-xs text-gray-500 mt-1">{t('settings:openAiCompatible.embeddingHelp')}</p>}
        {embedsLocally && !localEmbeddingAvailable && (
          <p className="text-xs text-amber-400 mt-1">{t('settings:openAiCompatible.embeddingLocalUnavailable')}</p>
        )}
        {embedsWithOpenRouter && (
          <p className="text-xs text-gray-500 mt-1">{t('settings:openRouter.embeddingNotice')}</p>
        )}
        {(!custom || embedsWithOpenRouter) && !config.hasApiKey && (
          <p className="text-xs text-gray-500 mt-1">
            {custom
              ? t('settings:openAiCompatible.embeddingNeedsOpenRouterKey')
              : t('settings:openRouter.embeddingNeedsKey')}
          </p>
        )}
        {embeddingNeedsCheck && (
          <p className="text-xs text-amber-400 mt-1">{t('settings:openRouter.embeddingNeedsCheck')}</p>
        )}
      </div>
      {!custom && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">{t('settings:ai.monthlyBudget')}</label>
            <input
              type="number"
              min={0}
              step={0.5}
              value={config.monthlyBudgetUsd}
              onChange={(e) => setConfig({ ...config, monthlyBudgetUsd: parseFloat(e.target.value) || 0 })}
              className="w-full bg-[#333] text-gray-200 border border-gray-600 rounded px-3 py-2 text-sm focus:border-primary-500 outline-none"
            />
            <p className="text-xs text-gray-500 mt-1">{t('settings:ai.monthlyBudgetHelp')}</p>
          </div>
          {/* Directly under the cap it reports against, so hitting the budget and
          finding out what you spent are the same screen. */}
          <UsageSummary />
        </>
      )}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">{t('settings:openRouter.contextBudget')}</label>
        <p className="text-xs text-gray-500 mb-2">{t('settings:openRouter.contextBudgetHelp')}</p>
        <input
          type="number"
          aria-label={t('settings:openRouter.contextBudget')}
          min={MIN_CONTEXT_BUDGET}
          step={4096}
          value={contextBudget}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            if (Number.isFinite(v)) onContextBudgetChange(v);
          }}
          className="w-32 bg-[#333] text-gray-200 border border-gray-600 rounded px-3 py-2 text-sm focus:border-primary-500 outline-none"
        />
      </div>
      {!custom && (
        <>
          <p className="text-xs text-gray-500">{t('settings:openRouter.noTrainingNotice')}</p>
          <div className="flex items-center justify-between">
            <div>
              <label className="block text-sm font-medium text-gray-300">
                {t('settings:openRouter.zeroDataRetention')}
              </label>
              <p className="text-xs text-gray-500 mt-0.5">{t('settings:openRouter.zeroDataRetentionHelp')}</p>
            </div>
            <button
              type="button"
              aria-label={t('settings:openRouter.zeroDataRetention')}
              aria-pressed={config.zeroDataRetention}
              onClick={() => setConfig({ ...config, zeroDataRetention: !config.zeroDataRetention })}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                config.zeroDataRetention ? 'bg-primary-600' : 'bg-gray-600'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  config.zeroDataRetention ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </>
      )}
      {custom && <p className="text-xs text-gray-500">{t('settings:openAiCompatible.privacyNotice')}</p>}
      <ThinkingToggle
        enabled={config.thinkingEnabled}
        onToggle={() => setConfig({ ...config, thinkingEnabled: !config.thinkingEnabled })}
      />
    </div>
  );
}
