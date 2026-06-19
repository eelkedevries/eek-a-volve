import type { NarratorStats } from './summary.ts';
import { summarise } from './summary.ts';
import { templatedLine } from './templates.ts';

const KEY_STORAGE = 'eek-a-volve.openrouter.key';
const MODEL_STORAGE = 'eek-a-volve.openrouter.model';

/** Default low-cost model; user-configurable (specification: Locked decisions). */
export const DEFAULT_MODEL = 'anthropic/claude-3.5-haiku';

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
/** Minimum gap between model calls — narration is rate-limited and non-blocking. */
const MIN_INTERVAL_MS = 15000;

const SYSTEM_PROMPT =
  'You are a wildlife-documentary narrator with slightly too much energy: short, ' +
  'observational, occasionally awed, and willing to use the creatures’ silly ' +
  'names. Reply with one or two sentences in British English. Never invent ' +
  'statistics that are not in the summary.';

/**
 * Optional narrator backed by OpenRouter (specification: Locked decisions). The
 * key and model live in the browser only; no key is embedded or committed.
 * `narrate` returns the templated fallback immediately and, when a key is set
 * and the rate limit allows, fetches a model line in the background and delivers
 * it via the callback. Any failure degrades silently to the fallback.
 */
export class Narrator {
  private lastCall = 0;
  private inFlight = false;

  getKey(): string {
    return localStorage.getItem(KEY_STORAGE) ?? '';
  }

  setKey(key: string): void {
    localStorage.setItem(KEY_STORAGE, key);
  }

  getModel(): string {
    return localStorage.getItem(MODEL_STORAGE) || DEFAULT_MODEL;
  }

  setModel(model: string): void {
    localStorage.setItem(MODEL_STORAGE, model);
  }

  narrate(stats: NarratorStats, onUpdate: (line: string) => void): string {
    const fallback = templatedLine(stats);
    const key = this.getKey();
    const now = Date.now();
    if (key !== '' && !this.inFlight && now - this.lastCall >= MIN_INTERVAL_MS) {
      this.lastCall = now;
      this.inFlight = true;
      void this.fetchLine(stats, key)
        .then((line) => {
          if (line !== null) onUpdate(line);
        })
        .catch(() => {
          /* degrade silently to the templated fallback */
        })
        .finally(() => {
          this.inFlight = false;
        });
    }
    return fallback;
  }

  private async fetchLine(stats: NarratorStats, key: string): Promise<string | null> {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: this.getModel(),
        max_tokens: 90,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: summarise(stats) },
        ],
      }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    const line = data?.choices?.[0]?.message?.content;
    return typeof line === 'string' ? line.trim() : null;
  }
}
