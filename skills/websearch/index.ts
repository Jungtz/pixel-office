/**
 * WebSearch Skill：自建 local-websearch 的通用抓取能力。
 *
 * 本檔同時是「helpers 庫」與「可載入 skill」：
 * - helpers（fetchPageContent / detectFirstUrl）供其他 skill（如 stock）直接 import；
 * - default export 的 skill 行為（主題帶連結 → 抓第一頁摘要），存在即啟用。
 *
 * 設定：無（存在即啟用，`_開頭`停用）。端點預設 http://localhost:8008，
 * 可用 WEBSEARCH_URL 環境變數覆寫（與 stock-gateway 共用同一變數名）。
 *
 * 全部 fail-soft：服務掛掉回 null，呼叫端照常降級，絕不拋錯拖垮對話。
 */
import type { ChatSkill } from '../../skillsLoader';

export interface WebSearchConfig {
  enabled: boolean;
  baseUrl: string;
  timeoutMs: number;
}

export interface PageContent {
  url: string;
  content: string;
  provider: string;
}

const DEFAULTS: WebSearchConfig = {
  enabled: true,
  baseUrl: 'http://localhost:8008',
  timeoutMs: 15000
};

/** 內容過短視為無效（與 gateway news-content.js 同門檻） */
export const MIN_CONTENT_LENGTH = 50;

/** 設定：預設值＋環境變數（無 config 檔依賴） */
export function loadWebSearchConfig(): WebSearchConfig {
  const cfg: WebSearchConfig = { ...DEFAULTS };
  if (process.env.WEBSEARCH_URL) cfg.baseUrl = process.env.WEBSEARCH_URL.replace(/\/$/, '');
  return cfg;
}

/** 把回應正規化為純文字（服務可能回 text 或包 JSON） */
function normalizeContent(raw: string): string {
  const text = (raw || '').trim();
  if (!text) return '';
  if (text.startsWith('{') || text.startsWith('[')) {
    try {
      const parsed: unknown = JSON.parse(text);
      const pick = (o: unknown): string | null => {
        if (typeof o === 'string') return o;
        if (o && typeof o === 'object') {
          const rec = o as Record<string, unknown>;
          for (const k of ['content', 'markdown', 'text', 'data']) {
            const v = rec[k];
            if (typeof v === 'string' && v.trim()) return v;
          }
        }
        return null;
      };
      if (Array.isArray(parsed)) return parsed.map(pick).filter(Boolean).join('\n');
      return pick(parsed) || text;
    } catch { /* 非 JSON，當純文字處理 */ }
  }
  return text;
}

/**
 * 抓取單頁全文：GET {baseUrl}/?url={encoded}
 * @returns 成功回 { url, content, provider }，失敗回 null
 */
export function fetchPageContent(url: string): Promise<PageContent | null>;
export function fetchPageContent(url: string, cfgOverride: WebSearchConfig): Promise<PageContent | null>;
export async function fetchPageContent(url: string, cfgOverride?: WebSearchConfig): Promise<PageContent | null> {
  const target = (url || '').trim();
  if (!/^https?:\/\//i.test(target)) return null;
  const cfg = cfgOverride || loadWebSearchConfig();
  if (!cfg.enabled) return null;
  try {
    const apiUrl = `${cfg.baseUrl}/?url=${encodeURIComponent(target)}`;
    const res = await fetch(apiUrl, { signal: AbortSignal.timeout(cfg.timeoutMs) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const content = normalizeContent(await res.text());
    if (content.length <= MIN_CONTENT_LENGTH) throw new Error('回傳內容過短或無效');
    return { url: target, content, provider: 'local-websearch' };
  } catch (err) {
    console.warn(`[WebSearch] 抓取失敗，已略過 ${target}:`, (err as Error).message);
    return null;
  }
}

/** 從文字中抓第一個 http(s) 連結（各團隊主題皆可帶連結） */
export function detectFirstUrl(text: string): string | null {
  if (!text) return null;
  const m = text.match(/https?:\/\/[^\s<>"'）】」]+/i);
  return m ? m[0].replace(/[。、，,.!?！？;；:：]+$/, '') : null;
}

function parseMaxChars(section: Record<string, unknown>): number {
  const v = section['maxChars'];
  return typeof v === 'number' && v > 0 ? v : 800;
}

/** Skill 掛載：主題帶連結 → 抓第一頁摘要（不限團隊） */
const websearchSkill: ChatSkill = {
  id: 'websearch',
  label: '網頁摘要',
  detect: (ctx) => detectFirstUrl(ctx.topic || ''),
  buildBlock: async (url, section) => {
    const page = await fetchPageContent(url);
    if (!page) return '';
    const excerpt = page.content.replace(/\s+/g, ' ').trim().slice(0, parseMaxChars(section));
    return `【外部網頁內容（${page.url}，經 websearch 抓取，僅供討論參考）】\n${excerpt}`;
  },
  instruction: '若系統提示含【外部網頁內容】，必須基於該內容回應，不可憑空編造該來源的說法。'
};

export default websearchSkill;
