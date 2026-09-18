/**
 * chat-logs Markdown 投票區段的序列化／解析（server.ts 與測試共用）。
 *
 * 寫入格式（人類可讀＋機器可讀並存）：
 *   ## 投票結果
 *   ### 議案：xxx（二元表決・通過）
 *   - RD_1 投給 贊成：理由…
 *   定案結論：…
 *   討論過程：…
 *   建議深入：a；b
 *   <!-- VOTES_DATA: [{...}] -->
 *
 * 行首刻意避開 `- [時間]`、`**名** (role)：` 與 `- 主題：`，以免被既有
 * 訊息／主題正則誤解析。
 */
import type { VoteSession } from './src/game/types';

const MODE_LABEL: Record<string, string> = { binary: '二元表決', multi: '多選方案', open: '開放討論' };
const RULING_LABEL: Record<string, string> = { passed: '通過', rejected: '否決', tied: '平票待裁決', concluded: '已有結論' };

function oneLine(s: unknown, max: number): string {
  return String(s ?? '').replace(/\r?\n/g, ' ').trim().slice(0, max);
}

/** 驗證＋正規化外部傳入的 votes（POST 用），非法回 [] */
export function sanitizeVotes(input: unknown): VoteSession[] {
  if (!Array.isArray(input)) return [];
  const out: VoteSession[] = [];
  for (const v of input.slice(0, 20)) {
    if (!v || typeof v !== 'object') continue;
    const r = v as Record<string, unknown>;
    if (typeof r['id'] !== 'string' || typeof r['topic'] !== 'string') continue;
    const mode = r['mode'] === 'multi' || r['mode'] === 'open' ? r['mode'] : 'binary';
    const options = Array.isArray(r['options'])
      ? (r['options'] as unknown[])
        .filter((o): o is { id: string; label: string } =>
          !!o && typeof o === 'object' &&
          typeof (o as Record<string, unknown>)['id'] === 'string' &&
          typeof (o as Record<string, unknown>)['label'] === 'string')
        .slice(0, 8)
        .map(o => ({ id: o.id.slice(0, 40), label: o.label.slice(0, 60) }))
      : [];
    const records = Array.isArray(r['records'])
      ? (r['records'] as unknown[])
        .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
        .slice(0, 30)
        .map(x => ({
          agentId: oneLine(x['agentId'], 60),
          agentName: oneLine(x['agentName'], 40),
          role: oneLine(x['role'], 20),
          choiceId: typeof x['choiceId'] === 'string' ? x['choiceId'].slice(0, 40) : null,
          reason: oneLine(x['reason'], 500)
        }))
      : [];
    const ruling = r['ruling'] === 'passed' || r['ruling'] === 'rejected' || r['ruling'] === 'tied' || r['ruling'] === 'concluded'
      ? r['ruling'] : undefined;
    const status = r['status'] === 'done' || r['status'] === 'pending_ruling' ? r['status'] : 'done';
    const followups = Array.isArray(r['followups'])
      ? (r['followups'] as unknown[]).filter((f): f is string => typeof f === 'string').slice(0, 5).map(f => f.slice(0, 100))
      : undefined;
    out.push({
      id: (r['id'] as string).slice(0, 60),
      topic: (r['topic'] as string).slice(0, 200),
      mode,
      options,
      records,
      process: typeof r['process'] === 'string' ? oneLine(r['process'], 800) : undefined,
      conclusion: typeof r['conclusion'] === 'string' ? oneLine(r['conclusion'], 500) : undefined,
      followups,
      winnerOptionId: typeof r['winnerOptionId'] === 'string'
        ? (r['winnerOptionId'] as string).slice(0, 40)
        : r['winnerOptionId'] === null ? null : undefined,
      ruling,
      status,
      createdAt: typeof r['createdAt'] === 'string' ? (r['createdAt'] as string).slice(0, 40) : ''
    });
  }
  return out;
}

function choiceLabel(session: VoteSession, choiceId: string | null): string {
  if (choiceId === null) return '（未投票）';
  if (choiceId === 'abstain') return '棄權';
  const opt = session.options.find(o => o.id === choiceId);
  return opt ? opt.label : choiceId;
}

/** 組人類可讀區段＋機器註解（無 votes 回 []） */
export function formatVotesSection(votes: VoteSession[]): string[] {
  if (votes.length === 0) return [];
  const lines: string[] = ['## 投票結果', ''];
  for (const v of votes) {
    lines.push(`### 議案：${v.topic}（${MODE_LABEL[v.mode] || v.mode}${v.ruling ? `・${RULING_LABEL[v.ruling] || v.ruling}` : ''}）`);
    for (const rec of v.records) {
      // 開放模式無選項：印名字＋理由就好，不硬套「投給（未投票）」
      if (v.mode === 'open') {
        lines.push(`- ${rec.agentName}${rec.reason ? `：${rec.reason}` : ''}`);
      } else {
        lines.push(`- ${rec.agentName} 投給 ${choiceLabel(v, rec.choiceId)}${rec.reason ? `：${rec.reason}` : ''}`);
      }
    }
    if (v.process) lines.push(`討論過程：${v.process}`);
    if (v.conclusion) lines.push(`定案結論：${v.conclusion}`);
    if (v.followups && v.followups.length > 0) lines.push(`建議深入：${v.followups.join('；')}`);
    lines.push('');
  }
  lines.push(`<!-- VOTES_DATA: ${JSON.stringify(votes)} -->`, '');
  return lines;
}

/** 從 md 全文解析結構化 votes（無則回 []） */
export function parseVotesData(content: string): VoteSession[] {
  const m = content.match(/<!--\s*VOTES_DATA:\s*(\[[\s\S]*?\])\s*-->/);
  if (!m) return [];
  try {
    return sanitizeVotes(JSON.parse(m[1]));
  } catch {
    return [];
  }
}

/** 從 md 全文解析 ## 前情提要（無則回 ''） */
export function parseSummarySection(content: string): string {
  const m = content.match(/^## 前情提要\s*\n([\s\S]*)/m);
  if (!m) return '';
  let body = m[1];
  // 結束邊界只認系統章節（對話／投票結果），LLM 自帶的 ## 子標題不截斷
  const cut = body.search(/^##\s+(?:對話|投票結果)|\n<!--/m);
  if (cut >= 0) body = body.slice(0, cut);
  return body.trim().slice(0, 2000);
}
