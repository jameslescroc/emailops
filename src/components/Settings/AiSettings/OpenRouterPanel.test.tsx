// The OpenRouter panel exposes zero data retention as the user's choice.
// "No training on your mail" is not a choice — the backend always sends
// `data_collection: "deny"` — so the panel only states it; the toggle covers
// the stricter, model-costing zero-retention routing.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CatalogModel } from '@/types';
import { OpenRouterPanel } from './OpenRouterPanel';
import type { AiConfigState } from './types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('./openRouterEmbeddingModels', () => ({
  RECOMMENDED_OPENROUTER_EMBEDDING_MODELS: [
    { id: 'vendor/pick-multi', languages: 'multilingual' },
    { id: 'vendor/embed-large', languages: 'english' },
  ],
}));

vi.mock('./UsageSummary', () => ({
  UsageSummary: () => null,
}));

// 'macos' makes the shared Select render a native <select>.
vi.mock('@/lib/api', () => ({
  currentPlatform: () => 'macos',
}));

const baseConfig: AiConfigState = {
  provider: 'openrouter',
  model: 'vendor/model',
  embeddingModel: '',
  monthlyBudgetUsd: 0,
  hasApiKey: true,
  thinkingEnabled: false,
  zeroDataRetention: false,
  baseUrl: '',
  hasBaseUrlApiKey: false,
};

describe('OpenRouterPanel', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const embeddingModels = [
    { id: 'vendor/embed', name: 'Vendor Embed', pricing: { prompt: 0, completion: 0, request: 0 } },
    { id: 'vendor/embed-large', name: 'Vendor Embed Large', pricing: { prompt: 0, completion: 0, request: 0 } },
  ];
  let embeddingNeedsCheck = false;
  let localEmbeddingAvailable = true;
  const localEmbeddingModels = [
    {
      id: 'nomic-embed-text-v1.5-q4_k_m',
      displayName: 'Nomic Embed v1.5',
      kind: 'embedding',
      sizeBytes: 1,
      isLocal: true,
    } as unknown as CatalogModel,
  ];

  function embeddingSelect(): HTMLSelectElement {
    const select = container.querySelector<HTMLSelectElement>('select[aria-label="settings:ai.embeddingModel"]');
    if (!select) throw new Error('embedding model selector not rendered');
    return select;
  }

  function render(config: AiConfigState, setConfig = vi.fn(), onContextBudgetChange = vi.fn()) {
    act(() => {
      root.render(
        <OpenRouterPanel
          config={config}
          setConfig={setConfig}
          apiKey=""
          setApiKey={vi.fn()}
          contextBudget={32768}
          onContextBudgetChange={onContextBudgetChange}
          embeddingModels={embeddingModels}
          embeddingNeedsCheck={embeddingNeedsCheck}
          localEmbeddingModels={localEmbeddingModels}
          localEmbeddingAvailable={localEmbeddingAvailable}
        />,
      );
    });
    return setConfig;
  }

  function budgetInput(): HTMLInputElement {
    const input = container.querySelector<HTMLInputElement>('input[aria-label="settings:openRouter.contextBudget"]');
    if (!input) throw new Error('context budget field not rendered');
    return input;
  }

  function zdrToggle(): HTMLButtonElement {
    const button = container.querySelector<HTMLButtonElement>(
      'button[aria-label="settings:openRouter.zeroDataRetention"]',
    );
    if (!button) throw new Error('zero data retention toggle not rendered');
    return button;
  }

  it('turns zero data retention on', () => {
    const setConfig = render(baseConfig);
    expect(zdrToggle().getAttribute('aria-pressed')).toBe('false');
    act(() => zdrToggle().click());
    expect(setConfig).toHaveBeenCalledWith({ ...baseConfig, zeroDataRetention: true });
  });

  it('shows it on when saved on, and turns it off', () => {
    const setConfig = render({ ...baseConfig, zeroDataRetention: true });
    expect(zdrToggle().getAttribute('aria-pressed')).toBe('true');
    act(() => zdrToggle().click());
    expect(setConfig).toHaveBeenCalledWith({ ...baseConfig, zeroDataRetention: false });
  });

  it('shows the context budget and reports a new value', () => {
    const onContextBudgetChange = vi.fn();
    render(baseConfig, vi.fn(), onContextBudgetChange);
    expect(budgetInput().value).toBe('32768');
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    act(() => {
      setValue?.call(budgetInput(), '65536');
      budgetInput().dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(onContextBudgetChange).toHaveBeenCalledWith(65536);
  });

  it('offers no embedding model, the listed ones, and reports the choice', () => {
    const setConfig = render(baseConfig);
    const values = Array.from(embeddingSelect().options).map((o) => o.value);
    expect(values).toEqual(['', 'vendor/pick-multi', 'vendor/embed-large', 'vendor/embed']);
    expect(embeddingSelect().value).toBe('');

    act(() => {
      embeddingSelect().value = 'vendor/embed';
      embeddingSelect().dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(setConfig).toHaveBeenCalledWith({ ...baseConfig, embeddingModel: 'vendor/embed' });
  });

  it('puts the recommended models first, labelled, and lists each model once', () => {
    render(baseConfig);
    const options = Array.from(embeddingSelect().options);
    expect(options[1].textContent).toBe('vendor/pick-multi — settings:openRouter.embeddingRecommendedMultilingual');
    expect(options[2].textContent).toBe('vendor/embed-large — settings:openRouter.embeddingRecommendedEnglish');
    expect(options[3].textContent).toBe('vendor/embed');
    expect(options.filter((o) => o.value === 'vendor/embed-large')).toHaveLength(1);
  });

  it('keeps a saved model selectable when the list does not have it', () => {
    render({ ...baseConfig, embeddingModel: 'vendor/retired' });
    expect(embeddingSelect().value).toBe('vendor/retired');
  });

  it('says what selecting an embedding model sends to OpenRouter', () => {
    render(baseConfig);
    expect(container.textContent).toContain('settings:openRouter.embeddingNotice');
    expect(container.textContent).not.toContain('settings:openRouter.embeddingNeedsCheck');
  });

  it('says a model that was not checked yet is checked on save', () => {
    embeddingNeedsCheck = true;
    render({ ...baseConfig, embeddingModel: 'vendor/embed' });
    expect(container.textContent).toContain('settings:openRouter.embeddingNeedsCheck');
    embeddingNeedsCheck = false;
  });

  it('asks for a saved key before the list can load', () => {
    render({ ...baseConfig, hasApiKey: false });
    expect(container.textContent).toContain('settings:openRouter.embeddingNeedsKey');
  });

  it('states that providers may never train on mail', () => {
    render(baseConfig);
    expect(container.textContent).toContain('settings:openRouter.noTrainingNotice');
  });

  describe('OpenAI-compatible server mode', () => {
    const serverConfig: AiConfigState = {
      ...baseConfig,
      provider: 'openai_compatible',
      model: 'claude-haiku',
      hasApiKey: true,
      baseUrl: 'http://127.0.0.1:8317/v1',
    };

    function baseUrlInput(): HTMLInputElement | null {
      return container.querySelector<HTMLInputElement>('#ai-base-url');
    }

    it('asks for the server URL and edits it', () => {
      const setConfig = render(serverConfig);
      const input = baseUrlInput();
      expect(input?.value).toBe('http://127.0.0.1:8317/v1');
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      act(() => {
        setValue?.call(input, 'http://localhost:1234/v1');
        input?.dispatchEvent(new Event('input', { bubbles: true }));
      });
      expect(setConfig).toHaveBeenCalledWith({ ...serverConfig, baseUrl: 'http://localhost:1234/v1' });
    });

    it("marks the key optional and shows the server key state, not OpenRouter's", () => {
      render(serverConfig);
      expect(container.textContent).toContain('settings:openAiCompatible.apiKeyOptional');
      // OpenRouter's key is saved, the server's is not: no "saved" badge here.
      expect(container.textContent).not.toContain('settings:ai.apiKeySaved');
      render({ ...serverConfig, hasBaseUrlApiKey: true });
      expect(container.textContent).toContain('settings:ai.apiKeySaved');
    });

    it('hides what only OpenRouter has, keeps the context budget, and states where mail goes', () => {
      render(serverConfig);
      expect(container.querySelector('button[aria-label="settings:openRouter.zeroDataRetention"]')).toBeNull();
      expect(container.textContent).not.toContain('settings:ai.monthlyBudget');
      expect(container.textContent).not.toContain('settings:openRouter.noTrainingNotice');
      expect(budgetInput()).not.toBeNull();
      expect(container.textContent).toContain('settings:openAiCompatible.privacyNotice');
    });

    it('offers none, the in-app model and OpenRouter models for the email index', () => {
      render(serverConfig);
      const values = Array.from(embeddingSelect().options).map((o) => o.value);
      expect(values[0]).toBe('');
      expect(values).toContain('nomic-embed-text-v1.5-q4_k_m');
      expect(values).toContain('vendor/embed-large');
      // The in-app model is listed before OpenRouter's.
      expect(values.indexOf('nomic-embed-text-v1.5-q4_k_m')).toBeLessThan(values.indexOf('vendor/embed-large'));
      expect(container.textContent).toContain('settings:openAiCompatible.embeddingHelp');
    });

    it('picks the in-app model', () => {
      const setConfig = render(serverConfig);
      act(() => {
        embeddingSelect().value = 'nomic-embed-text-v1.5-q4_k_m';
        embeddingSelect().dispatchEvent(new Event('change', { bubbles: true }));
      });
      expect(setConfig).toHaveBeenCalledWith({ ...serverConfig, embeddingModel: 'nomic-embed-text-v1.5-q4_k_m' });
    });

    it('warns that OpenRouter embeddings send mail there and need the OpenRouter key', () => {
      render({ ...serverConfig, embeddingModel: 'vendor/embed-large', hasApiKey: false });
      expect(container.textContent).toContain('settings:openRouter.embeddingNotice');
      expect(container.textContent).toContain('settings:openAiCompatible.embeddingNeedsOpenRouterKey');
      // The in-app model sends nothing, so no such notice.
      render({ ...serverConfig, embeddingModel: 'nomic-embed-text-v1.5-q4_k_m', hasApiKey: false });
      expect(container.textContent).not.toContain('settings:openRouter.embeddingNotice');
      expect(container.textContent).not.toContain('settings:openAiCompatible.embeddingNeedsOpenRouterKey');
    });

    it('says when this build cannot run the in-app model', () => {
      localEmbeddingAvailable = false;
      render({ ...serverConfig, embeddingModel: 'nomic-embed-text-v1.5-q4_k_m' });
      expect(container.textContent).toContain('settings:openAiCompatible.embeddingLocalUnavailable');
      localEmbeddingAvailable = true;
    });

    it('has no URL field in OpenRouter mode', () => {
      render(baseConfig);
      expect(baseUrlInput()).toBeNull();
      expect(container.textContent).not.toContain('settings:openAiCompatible.apiKeyOptional');
    });
  });
});
