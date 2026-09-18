/**
 * Stock Skill：台股情報外掛（plugin 形式載入）。
 *
 * 觸發：request body 的 stockId 優先，否則從主題自動偵測台股代號。
 * 資料：stock-gateway（即時數據完整包）＋ stock-viewer 公開分析報告，
 *       新聞全文經 websearch skill 的 helpers 抓取。
 *
 * 設定：無（存在即啟用，`_開頭`停用）。端點預設 localhost，可用環境變數覆寫：
 *   STOCK_GATEWAY_URL / STOCK_VIEWER_URL / STOCK_GATEWAY_TOKEN（token只走env）/
 *   STOCK_PLUGIN_ENABLED=0 停用（等同 _ 停用，免改檔名）
 *
 * 配額保護：同檔快取 TTL 內不重抓；任一來源失敗靜默略過該段，絕不讓情報失敗拖垮對話。
 */
import { fetchPageContent, loadWebSearchConfig } from '../websearch/index.ts';
import type { ChatSkill } from '../../skillsLoader';

export interface StockPluginConfig {
  enabled: boolean;
  gatewayUrl: string;
  viewerUrl: string;
  timeoutMs: number;
  cacheTtlMs: number;
  maxReportChars: number;
  /** 新聞全文抓取篇數（走 websearch 獨立服務，0 = 只列標題） */
  maxNewsContent: number;
  /** 單篇全文截斷字數 */
  newsContentChars: number;
}

const DEFAULTS: StockPluginConfig = {
  enabled: true,
  gatewayUrl: 'https://web.sytes.net/stock-gateway',
  viewerUrl: 'https://web.sytes.net/stock',
  timeoutMs: 8000,
  cacheTtlMs: 300000,
  maxReportChars: 1500,
  maxNewsContent: 2,
  newsContentChars: 500
};

/** 測試注入用：把 section 疊到預設值上 */
export function applySection(cfg: StockPluginConfig, section: Record<string, unknown>): void {
  if (typeof section['enabled'] === 'boolean') cfg.enabled = section['enabled'] as boolean;
  if (typeof section['gatewayUrl'] === 'string' && section['gatewayUrl']) cfg.gatewayUrl = (section['gatewayUrl'] as string).replace(/\/$/, '');
  if (typeof section['viewerUrl'] === 'string' && section['viewerUrl']) cfg.viewerUrl = (section['viewerUrl'] as string).replace(/\/$/, '');
  if (typeof section['timeoutMs'] === 'number' && (section['timeoutMs'] as number) > 0) cfg.timeoutMs = section['timeoutMs'] as number;
  if (typeof section['cacheTtlMs'] === 'number' && (section['cacheTtlMs'] as number) > 0) cfg.cacheTtlMs = section['cacheTtlMs'] as number;
  if (typeof section['maxReportChars'] === 'number' && (section['maxReportChars'] as number) > 0) cfg.maxReportChars = section['maxReportChars'] as number;
  if (typeof section['maxNewsContent'] === 'number' && (section['maxNewsContent'] as number) >= 0) cfg.maxNewsContent = section['maxNewsContent'] as number;
  if (typeof section['newsContentChars'] === 'number' && (section['newsContentChars'] as number) > 0) cfg.newsContentChars = section['newsContentChars'] as number;
}

/** 設定：預設值＋環境變數（無 config 檔依賴） */
export function loadStockConfig(section?: Record<string, unknown>): StockPluginConfig {
  const cfg: StockPluginConfig = { ...DEFAULTS };
  if (section) applySection(cfg, section);
  if (process.env.STOCK_GATEWAY_URL) cfg.gatewayUrl = process.env.STOCK_GATEWAY_URL.replace(/\/$/, '');
  if (process.env.STOCK_VIEWER_URL) cfg.viewerUrl = process.env.STOCK_VIEWER_URL.replace(/\/$/, '');
  if (process.env.STOCK_PLUGIN_ENABLED === '0' || process.env.STOCK_PLUGIN_ENABLED === 'false') cfg.enabled = false;
  if (process.env.STOCK_PLUGIN_ENABLED === '1' || process.env.STOCK_PLUGIN_ENABLED === 'true') cfg.enabled = true;
  return cfg;
}

/**
 * 從文字偵測台股代號（4 碼數字，可帶 1 碼英文尾綴如 2330）。
 * 排除 1900–2100（年份如 2026 誤判）。
 */
export function detectStockId(text: string): string | null {
  if (!text) return null;
  const matches = text.match(/\d{4}[A-Za-z]?/g) || [];
  for (const m of matches) {
    const num = parseInt(m.slice(0, 4), 10);
    if (num < 1000 || (num >= 1900 && num <= 2100)) continue;
    return m.toUpperCase();
  }
  return null;
}

// ── 快取（行程內記憶體，同檔 TTL 內不重打，保護 Shioaji 日配額）──
interface CacheEntry { at: number; block: string; }
const blockCache = new Map<string, CacheEntry>();

function toISODate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

async function fetchJson(url: string, timeoutMs: number, token?: string): Promise<unknown> {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('application/json')) throw new Error('non-json');
  return res.json();
}

async function fetchText(url: string, timeoutMs: number): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

/** 並行抓取任一段失敗只記 warn 該段，回 null，不中斷其他段 */
async function tryFetch<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    console.warn(`[StockPlugin] ${label} 抓取失敗，已略過:`, (err as Error).message);
    return null;
  }
}

function num(v: unknown): number | null {
  const n = typeof v === 'string' ? Number(v.replace(/,/g, '')) : Number(v);
  return Number.isFinite(n) ? n : null;
}

function fmtNum(n: number | null, digits = 2): string {
  if (n === null) return '—';
  return n.toLocaleString('zh-TW', { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

/** 從物件按候選鍵取值（各來源欄位命名不一，找不到回 null） */
function pick(obj: Record<string, unknown>, keys: string[]): unknown {
  const lower: Record<string, unknown> = {};
  for (const k of Object.keys(obj)) lower[k.toLowerCase()] = obj[k];
  for (const k of keys) {
    if (lower[k.toLowerCase()] !== undefined) return lower[k.toLowerCase()];
  }
  return null;
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function trunc(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + '…' : s;
}

interface PriceBar { date: string; close: number; open: number; high: number; low: number; volume: number; }

function normalizeBars(data: unknown): PriceBar[] {
  const out: PriceBar[] = [];
  for (const item of asArray(data)) {
    if (!isObj(item)) continue;
    const close = num(pick(item, ['close', '收盤']));
    if (close === null) continue;
    out.push({
      date: String(pick(item, ['date', '日期']) ?? ''),
      close,
      open: num(pick(item, ['open', '開盤'])) ?? close,
      high: num(pick(item, ['high', '最高'])) ?? close,
      low: num(pick(item, ['low', '最低'])) ?? close,
      volume: num(pick(item, ['volume', '成交量', '成交股數'])) ?? 0
    });
  }
  return out;
}

function avg(xs: number[]): number | null {
  if (xs.length === 0) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/** 民國日期轉 ISO（115/02/03 → 2026-02-03），格式不合直接回原文 */
export function rocToISO(roc: string): string {
  const m = (roc || '').trim().match(/(\d+)\/(\d+)\/(\d+)/);
  if (!m) return roc;
  return `${Number(m[1]) + 1911}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
}

/**
 * TWSE 官方直連備援（無需認證）：STOCK_DAY 取整月 OHLC。
 * 僅上市 4 碼有效，上櫃／錯誤直接拋錯由上層略過。
 * 當月筆數不足 20（月初）時自動向前併上個月，保證 MA20 可算。
 * 知識來源：w-data-ais-skill/fetch-tw-data-stock（API 端點與欄位佈局）。
 */
export async function fetchTwseDay(id: string, timeoutMs: number): Promise<PriceBar[]> {
  if (!/^\d{4}$/.test(id)) throw new Error('僅支援上市4碼');
  const fetchMonth = async (dateQ: string): Promise<PriceBar[]> => {
    const url = `https://www.twse.com.tw/exchangeReport/STOCK_DAY?response=json&date=${dateQ}&stockNo=${id}`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = (await res.json()) as { stat?: string; data?: string[][] };
    if (j.stat !== 'OK' || !Array.isArray(j.data) || j.data.length === 0) {
      throw new Error('無資料（可能非上市、假日或尚未收盤）');
    }
    const out: PriceBar[] = [];
    for (const row of j.data) {
      // 欄位：[日期(民國), 成交股數, 成交金額, 開盤, 最高, 最低, 收盤, 漲跌價差, 成交筆數]
      const close = num(row[6]);
      if (close === null) continue;
      out.push({
        date: rocToISO(String(row[0])),
        close,
        open: num(row[3]) ?? close,
        high: num(row[4]) ?? close,
        low: num(row[5]) ?? close,
        volume: num(row[1]) ?? 0
      });
    }
    return out;
  };
  const q = toISODate(new Date()).replace(/-/g, '');
  const out = await fetchMonth(q);
  if (out.length === 0) throw new Error('解析後無有效K線');
  // 月初筆數不足：向前併上個月（失敗則用當月既有筆數）
  if (out.length < 20) {
    const prevQ = toISODate(new Date(Date.now() - 35 * 86400000)).replace(/-/g, '');
    try {
      const prev = await fetchMonth(prevQ);
      const seen = new Set(out.map(b => b.date));
      const merged = [...prev.filter(b => !seen.has(b.date)), ...out];
      if (merged.length > out.length) return merged;
    } catch (err) {
      console.warn('[StockPlugin] twse直連上月併檔失敗，用當月筆數:', (err as Error).message);
    }
  }
  return out;
}

/** 從 viewer 報告 md 萃取「決策／結論」段落，找不到則取開頭 */
export function extractReportSummary(md: string, maxChars: number): string {
  const lines = md.split(/\r?\n/);
  let hitIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^#{1,3}\s*(決策|結論|總結|建議|總評|操作建議)/.test(lines[i].trim())) { hitIdx = i; break; }
  }
  if (hitIdx >= 0) {
    const section: string[] = [];
    for (let i = hitIdx; i < lines.length && section.join('\n').length < maxChars; i++) {
      if (i > hitIdx && /^#{1,2}\s/.test(lines[i].trim())) break;
      section.push(lines[i]);
    }
    const text = section.join('\n').trim();
    if (text) return trunc(text, maxChars);
  }
  return trunc(md.trim(), maxChars);
}

/**
 * 抓取指定代號的完整情報包並組裝成 prompt 區塊。
 * 失敗靜默回 ''（呼叫端直接當沒外掛用）。
 */
export function getStockBlock(stockId: string): Promise<string>;
export function getStockBlock(stockId: string, cfgOverride: StockPluginConfig): Promise<string>;
export async function getStockBlock(stockId: string, cfgOverride?: StockPluginConfig): Promise<string> {
  const id = (stockId || '').toUpperCase().trim();
  if (!id) return '';
  const cfg = cfgOverride || loadStockConfig();
  if (!cfg.enabled) return '';

  const cached = blockCache.get(id);
  if (cached && Date.now() - cached.at < cfg.cacheTtlMs) return cached.block;

  const token = process.env.STOCK_GATEWAY_TOKEN || '';
  const gw = cfg.gatewayUrl;
  const now = new Date();
  const endDate = toISODate(now);
  const startDate = toISODate(new Date(now.getTime() - 45 * 86400000));

  const [snapshot, priceRaw, instRaw, marginRaw, brokerRaw, fundRaw, finReportRaw, mopsRaw, newsRaw, reportMd] = await Promise.all([
    tryFetch('snapshot', () => fetchJson(`${gw}/api/stock/${id}/snapshot`, cfg.timeoutMs, token)),
    tryFetch('price', () => fetchJson(`${gw}/api/stock/${id}/price?startDate=${startDate}&endDate=${endDate}`, cfg.timeoutMs, token)),
    tryFetch('institutional', () => fetchJson(`${gw}/api/stock/${id}/institutional?startDate=${startDate}&endDate=${endDate}`, cfg.timeoutMs, token)),
    tryFetch('margin', () => fetchJson(`${gw}/api/stock/${id}/margin?startDate=${startDate}&endDate=${endDate}`, cfg.timeoutMs, token)),
    tryFetch('broker', () => fetchJson(`${gw}/api/stock/${id}/broker/latest`, cfg.timeoutMs, token)),
    tryFetch('fundamentals', () => fetchJson(`${gw}/api/stock/${id}/fundamentals`, cfg.timeoutMs, token)),
    tryFetch('financial-report', () => fetchJson(`${gw}/api/stock/${id}/financial-reports/latest`, cfg.timeoutMs, token)),
    tryFetch('mops-news', () => fetchJson(`${gw}/api/stock/${id}/mops-news?limit=5`, cfg.timeoutMs, token)),
    tryFetch('news', () => fetchJson(`${gw}/api/news?stockId=${id}`, cfg.timeoutMs, token)),
    tryFetch('viewer-report', () => fetchText(`${cfg.viewerUrl}/report/${id}/md`, cfg.timeoutMs))
  ]);

  const lines: string[] = [];
  lines.push(`【即時台股情報：${id}（快照時間 ${now.toLocaleString('zh-TW')}，盤中數字會變動，僅供討論基準）】`);

  // 近20日均線與趨勢（gateway 優先，缺失時 TWSE 直連備援）
  const bars = normalizeBars(isObj(priceRaw) ? (priceRaw as Record<string, unknown>)['data'] : priceRaw);
  let twseBars: PriceBar[] = [];
  if (!isObj(snapshot) && bars.length < 5) {
    twseBars = await tryFetch('twse直連', () => fetchTwseDay(id, cfg.timeoutMs)) || [];
  }
  const effBars = bars.length >= 5 ? bars : twseBars;

  // 現價快照（gateway 優先，缺失時取 TWSE 直連最後一根）
  if (isObj(snapshot)) {
    const price = num(pick(snapshot, ['price', 'close', 'last']));
    const change = num(pick(snapshot, ['change']));
    const changeRate = num(pick(snapshot, ['change_rate', 'changeRate']));
    const open = num(pick(snapshot, ['open']));
    const high = num(pick(snapshot, ['high']));
    const low = num(pick(snapshot, ['low']));
    lines.push(`- 現價 ${fmtNum(price)}（${change !== null && change >= 0 ? '+' : ''}${fmtNum(change)}，${changeRate !== null && changeRate >= 0 ? '+' : ''}${fmtNum(changeRate)}%），開${fmtNum(open)}／高${fmtNum(high)}／低${fmtNum(low)}`);
  } else if (twseBars.length > 0) {
    const lastBar = twseBars[twseBars.length - 1];
    lines.push(`- 現價 ${fmtNum(lastBar.close)}（${lastBar.date}收盤，TWSE直連備援無漲跌幅），開${fmtNum(lastBar.open)}／高${fmtNum(lastBar.high)}／低${fmtNum(lastBar.low)}`);
  }

  if (effBars.length >= 5) {
    const closes = effBars.map(b => b.close);
    const ma5 = avg(closes.slice(-5));
    const ma20 = closes.length >= 20 ? avg(closes.slice(-20)) : null;
    const first = closes[0];
    const last = closes[closes.length - 1];
    const trend = ma20 !== null && last !== undefined && ma5 !== null
      ? (last > ma20 && ma5 > ma20 ? '多頭排列' : last < ma20 && ma5 < ma20 ? '空頭排列' : '均線糾結')
      : '資料不足以判定';
    lines.push(`- 近${closes.length}個交易日：MA5 ${fmtNum(ma5)}／MA20 ${fmtNum(ma20)}（${trend}），區間漲跌 ${first ? fmtNum(((last ?? first) - first) / first * 100) : '—'}%`);
  }

  // 三大法人近5日
  const instRows = normalizeBars(isObj(instRaw) ? (instRaw as Record<string, unknown>)['data'] : instRaw);
  if (instRows.length > 0) {
    const last5 = (asArray(isObj(instRaw) ? (instRaw as Record<string, unknown>)['data'] : instRaw)).slice(-5);
    let foreign = 0, trust = 0, dealer = 0, total = 0, days = 0;
    for (const r of last5) {
      if (!isObj(r)) continue;
      days++;
      foreign += num(pick(r, ['foreign', '外資'])) ?? 0;
      trust += num(pick(r, ['trust', '投信'])) ?? 0;
      dealer += num(pick(r, ['dealer', '自營商'])) ?? 0;
      total += num(pick(r, ['total', '合計'])) ?? 0;
    }
    if (days > 0) lines.push(`- 三大法人近${days}日合計${total >= 0 ? '買超' : '賣超'} ${fmtNum(Math.abs(total), 0)} 張（外資${fmtNum(foreign, 0)}／投信${fmtNum(trust, 0)}／自營${fmtNum(dealer, 0)}）`);
  }

  // 融資券最新
  const marginRows = asArray(isObj(marginRaw) ? (marginRaw as Record<string, unknown>)['data'] : marginRaw);
  if (marginRows.length > 0) {
    const latest = marginRows[marginRows.length - 1];
    const prev = marginRows.length > 1 ? marginRows[marginRows.length - 2] : null;
    if (isObj(latest)) {
      const date = String(pick(latest, ['date']) ?? '');
      const mBuy = num(pick(latest, ['margin_balance', 'marginBalance', '融資餘額']));
      const sSell = num(pick(latest, ['short_balance', 'shortBalance', '融券餘額']));
      let delta = '';
      if (isObj(prev) && mBuy !== null) {
        const pBuy = num(pick(prev, ['margin_balance', 'marginBalance', '融資餘額']));
        if (pBuy !== null) delta = mBuy - pBuy >= 0 ? `（融資增 ${fmtNum(mBuy - pBuy, 0)} 張）` : `（融資減 ${fmtNum(pBuy - mBuy, 0)} 張）`;
      }
      lines.push(`- 資券（${date}）：融資餘額 ${fmtNum(mBuy, 0)} 張${delta}，融券餘額 ${fmtNum(sSell, 0)} 張`);
    }
  }

  // 分點最新摘要
  if (isObj(brokerRaw)) {
    const meta = isObj(brokerRaw['meta']) ? (brokerRaw['meta'] as Record<string, unknown>) : null;
    const items = asArray(brokerRaw['data']).filter(isObj) as Record<string, unknown>[];
    const date = meta ? String(meta['date'] ?? '') : '';
    const nameOf = (it: Record<string, unknown>) => String(pick(it, ['broker', 'branch', 'branchName', 'name']) ?? '?');
    const netOf = (it: Record<string, unknown>) => num(pick(it, ['net', 'netBuy', 'net_buy', '淨買超']));
    const ranked = items.map(it => ({ name: nameOf(it), net: netOf(it) ?? 0 })).sort((a, b) => b.net - a.net);
    const topBuy = ranked.filter(r => r.net > 0).slice(0, 3).map(r => `${r.name}${fmtNum(r.net, 0)}`).join('、');
    const topSell = ranked.filter(r => r.net < 0).slice(-3).reverse().map(r => `${r.name}${fmtNum(Math.abs(r.net), 0)}`).join('、');
    if (topBuy || topSell) {
      let seg = `- 分點（${date}）：`;
      if (topBuy) seg += `買超前三 ${topBuy}；`;
      if (topSell) seg += `賣超前三 ${topSell}`;
      lines.push(seg);
      if (meta && typeof meta['summary'] === 'string' && meta['summary']) lines.push(`  分點摘要：${trunc(meta['summary'], 120)}`);
    }
  }

  // 基本面＋最新財報（來源欄位不固定，抓常見鍵，缺則截斷原文）
  if (isObj(fundRaw)) {
    const inner = isObj(fundRaw['data']) ? (fundRaw['data'] as Record<string, unknown>) : fundRaw;
    const pe = num(pick(inner, ['pe', 'per', '本益比']));
    const pb = num(pick(inner, ['pb', 'pbr', '淨值比']));
    const divYield = num(pick(inner, ['dividend_yield', 'dividendYield', '殖利率']));
    if (pe !== null || pb !== null || divYield !== null) {
      lines.push(`- 基本面：本益比 ${fmtNum(pe)}／淨值比 ${fmtNum(pb)}／殖利率 ${fmtNum(divYield)}%`);
    } else {
      lines.push(`- 基本面：${trunc(JSON.stringify(inner), 300)}`);
    }
  }
  if (isObj(finReportRaw)) {
    const inner = isObj(finReportRaw['data']) ? (finReportRaw['data'] as Record<string, unknown>) : finReportRaw;
    const year = pick(inner, ['year', '年度']);
    const quarter = pick(inner, ['quarter', '季度', '季']);
    const revenue = num(pick(inner, ['revenue', '營收', 'operating_revenue']));
    const eps = num(pick(inner, ['eps', '每股盈餘']));
    const margin = num(pick(inner, ['gross_margin', 'grossMargin', '毛利率']));
    if (revenue !== null || eps !== null) {
      lines.push(`- 最新財報（${String(year ?? '?')}Q${String(quarter ?? '?')}）：營收 ${fmtNum(revenue, 0)}／EPS ${fmtNum(eps)}／毛利率 ${fmtNum(margin)}%`);
    } else {
      lines.push(`- 最新財報：${trunc(JSON.stringify(inner), 300)}`);
    }
  }

  // 重訊＋新聞（標題列點；新聞附 link 者再走 websearch 獨立服務抓全文）
  interface NewsItem { label: string; link: string | null; }
  const newsItems = (v: unknown, titleKeys: string[]): NewsItem[] => {
    const out: NewsItem[] = [];
    for (const item of asArray(isObj(v) ? (v as Record<string, unknown>)['data'] ?? v : v)) {
      if (!isObj(item)) continue;
      const t = pick(item, titleKeys);
      const d = pick(item, ['date', '日期', 'publishDate', 'time']);
      const link = pick(item, ['link', 'url', 'source_url']);
      if (typeof t === 'string' && t.trim()) {
        out.push({
          label: `${d ? `(${String(d).slice(0, 10)})` : ''}${t.trim()}`,
          link: typeof link === 'string' && /^https?:\/\//i.test(link) ? link : null
        });
      }
      if (out.length >= 3) break;
    }
    return out;
  };
  const mops = newsItems(mopsRaw, ['title', 'subject', '標題']);
  if (mops.length > 0) {
    lines.push('- 公開資訊觀測站重訊：');
    for (const t of mops) lines.push(`  • ${trunc(t.label, 80)}`);
  }
  const news = newsItems(newsRaw, ['title', '標題']);
  if (news.length > 0) {
    lines.push('- 相關新聞：');
    for (const t of news) lines.push(`  • ${trunc(t.label, 80)}`);
  }

  // 新聞全文：取前 N 則有連結者，經 websearch 抓取後截斷注入
  const withLinks = news.filter(n => n.link).slice(0, Math.max(0, cfg.maxNewsContent));
  if (withLinks.length > 0) {
    const wsCfg = { ...loadWebSearchConfig(), timeoutMs: cfg.timeoutMs };
    const bodies = await Promise.all(
      withLinks.map(n => tryFetch('websearch全文', () => fetchPageContent(n.link as string, wsCfg).then(r => {
        if (!r) throw new Error('無內容');
        return r;
      })))
    );
    bodies.forEach((page, i) => {
      if (page) {
        lines.push(`  ↳ 「${trunc(withLinks[i].label, 40)}」全文摘要：${trunc(page.content.replace(/\s+/g, ' ').trim(), cfg.newsContentChars)}`);
      }
    });
  }

  // viewer AI 分析報告摘要
  if (typeof reportMd === 'string' && reportMd.trim().length > 50) {
    lines.push(`- stock-viewer AI 報告摘要：${extractReportSummary(reportMd, cfg.maxReportChars)}`);
  }

  lines.push('⚠️ 以上為外部數據快照，僅供角色扮演討論使用，非投資建議；實際下單前請自行查證即時行情。');

  const block = lines.join('\n');
  // 完全沒抓到任何一段（只有頭尾兩行）就不注入，避免污染 prompt
  if (lines.length <= 2) return '';
  blockCache.set(id, { at: Date.now(), block });
  return block;
}

/** Skill 掛載：body.stockId 優先，否則從主題自動偵測台股代號 */
const stockSkill: ChatSkill = {
  id: 'stock',
  label: '股票情報',
  detect: (ctx) => {
    const raw = ctx.body['stockId'];
    if (typeof raw === 'string' && raw.trim()) return raw.trim().toUpperCase();
    return detectStockId(ctx.topic || '');
  },
  buildBlock: (key, section) => getStockBlock(key, loadStockConfig(section)),
  instruction: '若系統提示含【即時台股情報】，必須引用其中的具體數字（現價、均線、法人、財報任選其一以上）論證，不可無視數據空談。'
};

export default stockSkill;
