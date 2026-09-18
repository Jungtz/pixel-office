import type { LLMConfig } from './aiAgent';
import { ROLE_CONFIGS } from './roles';
import type {
  AgentCharacter,
  ChatMessage,
  VoteMode,
  VoteOption,
  VoteRecord,
  VoteSession,
  VoteStatus,
} from '../game/types';

/** 二元表決預設選項（含獨立棄權項） */
export const BINARY_OPTIONS: VoteOption[] = [
  { id: 'yes', label: '贊成' },
  { id: 'no', label: '反對' },
  { id: 'abstain', label: '棄權' },
];

const VOTE_TIMEOUT_MS = 120000;
/** 逐票收集受控並行數（防地端 Ollama 塞車／外部 Rate Limit） */
export const VOTE_CONCURRENCY = 2;

interface VoteApiEnvelope {
  status?: string;
  text?: unknown;
}

/** 對 /api/chat 發結構化投票請求（vote / conclude / options 共用） */
async function postStructuredVote(body: Record<string, unknown>): Promise<string | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), VOTE_TIMEOUT_MS);
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) return null;
    const data = (await res.json()) as VoteApiEnvelope;
    if (data.status === 'success' && typeof data.text === 'string' && data.text.trim()) {
      return data.text;
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/** 後端回的是 JSON 字串（含前後雜訊）：擷取第一個 {...} 或 [...] 區塊 */
function extractJsonBlock(text: string): unknown | null {
  const match = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as unknown;
  } catch {
    return null;
  }
}

/** 角色與議案關鍵字重合度：命中 interests 即傾向贊成／選邊 */
function roleMatchesTopic(role: string, topic: string): boolean {
  const interests = ROLE_CONFIGS[role]?.interests || [];
  const lower = topic.toLowerCase();
  return interests.some(kw => kw && lower.includes(kw.toLowerCase()));
}

function pickCatchphrase(role: string): string {
  const list = ROLE_CONFIGS[role]?.catchphrases || [];
  if (list.length === 0) return '收到，依多數決辦理。';
  return list[Math.floor(Math.random() * list.length)];
}

/**
 * Mock 單票（離線降級）：命中 interests 落贊成／選邊，無命中多半棄權
 * @param agent 投票人
 * @param topic 議案（已 trim）
 * @param mode 投票模式
 * @param options 候選選項（含棄權項）
 */
export function generateMockVoteRecord(
  agent: AgentCharacter,
  topic: string,
  mode: VoteMode,
  options: VoteOption[]
): VoteRecord {
  const base = {
    agentId: agent.id,
    agentName: agent.name,
    role: agent.role,
  };
  if (mode === 'open') {
    return { ...base, choiceId: null, reason: `關於「${topic}」，${pickCatchphrase(agent.role)}` };
  }
  const matched = roleMatchesTopic(agent.role, topic);
  const reason = `關於「${topic}」，${pickCatchphrase(agent.role)}`;
  if (mode === 'binary') {
    if (matched) {
      const choiceId = Math.random() < 0.15 ? 'no' : 'yes';
      return { ...base, choiceId, reason };
    }
    return { ...base, choiceId: Math.random() < 0.15 ? 'no' : 'abstain', reason };
  }
  // multi：在非棄權選項中選邊
  const votable = options.filter(o => o.id !== 'abstain');
  const pool = votable.length > 0 ? votable : options;
  if (matched && pool.length > 0) {
    const pick = pool[Math.floor(Math.random() * pool.length)];
    return { ...base, choiceId: pick.id, reason };
  }
  if (Math.random() < 0.7) {
    return { ...base, choiceId: 'abstain', reason };
  }
  const pick = pool[Math.floor(Math.random() * pool.length)];
  return { ...base, choiceId: pick ? pick.id : 'abstain', reason };
}

/**
 * Mock 定案結論（離線降級）：依計票結果組三段式摘要
 */
export function generateMockConclusion(
  topic: string,
  mode: VoteMode,
  records: VoteRecord[],
  options: VoteOption[]
): { process: string; conclusion: string; followups: string[] } {
  const labelOf = (id: string | null): string => {
    if (id === null) return '表態';
    if (id === 'abstain') return '棄權';
    return options.find(o => o.id === id)?.label || id;
  };
  const counts = new Map<string, number>();
  for (const r of records) {
    const key = r.choiceId ?? '__open';
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const summary = [...counts.entries()]
    .map(([id, n]) => `${labelOf(id === '__open' ? null : id)} ${n} 票`)
    .join('、');
  const process = `議案「${topic}」共 ${records.length} 人表態（${summary}）。已聽取各角色專業意見並收斂分歧。`;
  const { ruling, winnerOptionId } = resolveRuling(mode, records);
  let conclusion: string;
  if (mode === 'open') {
    conclusion = `主席裁示：${topic}方向確立，各單位依共識執行。`;
  } else if (ruling === 'passed') {
    conclusion = `表決通過：${topic}照案執行。`;
  } else if (ruling === 'rejected') {
    conclusion = `表決否決：${topic}暫緩執行，退回重議。`;
  } else if (winnerOptionId) {
    conclusion = `定案採用：${labelOf(winnerOptionId)}。`;
  } else {
    conclusion = `平票待主席裁決：${topic}由主席最後拍板。`;
  }
  return { process, conclusion, followups: [`${topic}的執行細節與時程追蹤`] };
}

/**
 * 單票收集：真 LLM 走後端 VOTE action，失敗重試一次，再失敗記棄權
 * @param config LLM 設定（mock 直接走本地降級不發 HTTP）
 */
export async function fetchVoteRecord(
  config: LLMConfig,
  voter: AgentCharacter,
  voteTopic: string,
  mode: VoteMode,
  options: VoteOption[],
  contextMessages: ChatMessage[]
): Promise<VoteRecord> {
  const fallback = (reason: string): VoteRecord => ({
    agentId: voter.id,
    agentName: voter.name,
    role: voter.role,
    choiceId: mode === 'open' ? null : 'abstain',
    reason,
  });
  if (config.provider === 'mock') {
    return generateMockVoteRecord(voter, voteTopic, mode, options);
  }
  const validIds = new Set(options.map(o => o.id));
  validIds.add('abstain');
  const voteMode = mode === 'multi' ? 'multi' : mode === 'open' ? 'open' : 'binary';

  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await postStructuredVote({
      action: 'vote',
      providerId: config.provider,
      model: config.model,
      apiKey: config.apiKey,
      voteTopic,
      voterName: voter.name,
      voterRole: voter.role,
      voteMode,
      voteOptions: options.map(o => ({ id: o.id, label: o.label })),
      contextMessages: contextMessages.slice(-8).map(m => ({
        speakerName: m.speakerName,
        text: m.text,
      })),
    });
    if (raw) {
      const parsed = extractJsonBlock(raw) as { choice?: unknown; reason?: unknown } | null;
      if (parsed && typeof parsed === 'object') {
        if (mode === 'open') {
          const reason = typeof parsed.reason === 'string' && parsed.reason.trim()
            ? parsed.reason.trim().slice(0, 200)
            : '已表態。';
          return { agentId: voter.id, agentName: voter.name, role: voter.role, choiceId: null, reason };
        }
        const choice = typeof parsed.choice === 'string' ? parsed.choice.trim() : '';
        const reason = typeof parsed.reason === 'string' && parsed.reason.trim()
          ? parsed.reason.trim().slice(0, 200)
          : '已投票。';
        if (choice && validIds.has(choice)) {
          return { agentId: voter.id, agentName: voter.name, role: voter.role, choiceId: choice, reason };
        }
      }
    }
  }
  return fallback('未表態');
}

/**
 * AI 建議多選候選方案（OPTIONS action），失敗回 null 由呼叫端保留手填
 */
export async function fetchOptionsSuggestion(
  config: LLMConfig,
  voteTopic: string
): Promise<string[] | null> {
  if (config.provider === 'mock' || !voteTopic.trim()) return null;
  const raw = await postStructuredVote({
    action: 'options',
    providerId: config.provider,
    model: config.model,
    apiKey: config.apiKey,
    voteTopic: voteTopic.trim(),
  });
  if (!raw) return null;
  const parsed = extractJsonBlock(raw) as { options?: unknown } | null;
  if (!parsed || !Array.isArray(parsed.options)) return null;
  const list = parsed.options
    .filter((o): o is string => typeof o === 'string' && o.trim() !== '')
    .slice(0, 4)
    .map(o => o.trim().slice(0, 30));
  return list.length >= 2 ? list : null;
}

/**
 * 定案結論矛盾檢查：結論宣稱全出，但票據／討論明明提到保留部位，
 * 或 followups 與 conclusion 互斥時視為漂移，丟棄 LLM 結論走本地降級。
 */
export function isContradictoryConclusion(
  conclusion: string,
  followups: string[],
  tallyText: string,
  contextText: string
): boolean {
  if (!conclusion) return true;
  const claimsClear = /(出清|全出|清倉)/.test(conclusion);
  const qualifiesPartial = /(部分|保留|先出\s*\d*張?|減碼\s*\d*張?|留\s*\d+張)/.test(conclusion);
  if (!claimsClear || qualifiesPartial) return false;
  const mentionsRetain = /(保留|剩餘|留下|剩.*張|部分減碼|先出.*張|守.*MA|止損線)/.test(`${tallyText}\n${contextText}`);
  const followupRetains = followups.some(f => /(保留|剩餘|留下|止損線)/.test(f));
  return mentionsRetain || followupRetains;
}

/**
 * 主持人定案結論（CONCLUDE action），失敗或矛盾走本地降級
 */
export async function fetchConclusion(
  config: LLMConfig,
  hostName: string,
  voteTopic: string,
  tallyText: string,
  contextText: string,
  records: VoteRecord[],
  mode: VoteMode,
  options: VoteOption[]
): Promise<{ process: string; conclusion: string; followups: string[] }> {
  if (config.provider !== 'mock') {
    const raw = await postStructuredVote({
      action: 'conclude',
      providerId: config.provider,
      model: config.model,
      apiKey: config.apiKey,
      voteTopic,
      hostName,
      tallyText: tallyText.slice(0, 1500),
      contextText: contextText.slice(0, 2000),
    });
    if (raw) {
      const parsed = extractJsonBlock(raw) as {
        process?: unknown;
        conclusion?: unknown;
        followups?: unknown;
      } | null;
      if (parsed && typeof parsed === 'object') {
        const process = typeof parsed.process === 'string' && parsed.process.trim()
          ? parsed.process.trim().slice(0, 800)
          : '';
        const conclusion = typeof parsed.conclusion === 'string' && parsed.conclusion.trim()
          ? parsed.conclusion.trim().slice(0, 500)
          : '';
        const followups = Array.isArray(parsed.followups)
          ? parsed.followups
            .filter((f): f is string => typeof f === 'string' && f.trim() !== '')
            .slice(0, 3)
            .map(f => f.trim().slice(0, 100))
          : [];
        if (process && conclusion) {
          if (!isContradictoryConclusion(conclusion, followups, tallyText, contextText)) {
            return { process, conclusion, followups };
          }
          console.warn('[Vote] 定案結論與討論矛盾（全出 vs 保留），已降級為本地結論。');
        }
      }
    }
  }
  return generateMockConclusion(voteTopic, mode, records, options);
}

/** 選項 id → 顯示標籤（含棄權／開放兜底） */
export function voteChoiceLabel(options: VoteOption[], choiceId: string | null): string {
  if (choiceId === null) return '表態';
  if (choiceId === 'abstain') return '棄權';
  return options.find(o => o.id === choiceId)?.label || choiceId;
}

/** 逐票文字彙整（供主持人定案回顧，1500 字內） */
export function buildTallyText(records: VoteRecord[], options: VoteOption[]): string {
  return records
    .map(r => `${r.agentName}(${r.role}) 投 ${voteChoiceLabel(options, r.choiceId)}：${(r.reason || '').slice(0, 120)}`)
    .join('\n')
    .slice(0, 1500);
}

/** 各選項票數（含棄權；開放模式 choiceId 皆為 null，不計票） */
export function countVotes(records: VoteRecord[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const r of records) {
    if (r.choiceId === null) continue;
    counts.set(r.choiceId, (counts.get(r.choiceId) || 0) + 1);
  }
  return counts;
}

/**
 * 計票裁決（二元：贊成＞反對通過；多選：最高票定案；開放：主持人總結即結論）
 * @returns winnerOptionId 多選獲勝項（平票或非多選為 null）
 */
export function resolveRuling(
  mode: VoteMode,
  records: VoteRecord[]
): { winnerOptionId: string | null; ruling: 'passed' | 'rejected' | 'tied' | 'concluded'; status: VoteStatus } {
  if (mode === 'open') {
    return { winnerOptionId: null, ruling: 'concluded', status: 'done' };
  }
  const counts = countVotes(records);
  if (mode === 'binary') {
    const yes = counts.get('yes') || 0;
    const no = counts.get('no') || 0;
    if (yes > no) return { winnerOptionId: null, ruling: 'passed', status: 'done' };
    if (no > yes) return { winnerOptionId: null, ruling: 'rejected', status: 'done' };
    return { winnerOptionId: null, ruling: 'tied', status: 'pending_ruling' };
  }
  // multi：排除棄權後取最高票
  let topId: string | null = null;
  let topCount = 0;
  let tied = false;
  for (const [id, n] of counts) {
    if (id === 'abstain') continue;
    if (n > topCount) {
      topCount = n;
      topId = id;
      tied = false;
    } else if (n === topCount && n > 0) {
      tied = true;
    }
  }
  if (!topId || topCount === 0 || tied) {
    return { winnerOptionId: null, ruling: 'tied', status: 'pending_ruling' };
  }
  return { winnerOptionId: topId, ruling: 'concluded', status: 'done' };
}

export interface CollectVotesArgs {
  config: LLMConfig;
  voters: AgentCharacter[];
  voteTopic: string;
  mode: VoteMode;
  options: VoteOption[];
  contextMessages: ChatMessage[];
  /** 進度回報（當前投票人、已完成數、總數） */
  onProgress?: (current: AgentCharacter, done: number, total: number) => void;
  /** 回傳 true 即中止（已發出的請求會等完，當前收集丟棄） */
  shouldAbort?: () => boolean;
}

/**
 * 受控並行逐票收集（Concurrency = 2），保持回傳順序與 voters 一致
 */
export async function collectVotes(args: CollectVotesArgs): Promise<VoteRecord[]> {
  const { config, voters, voteTopic, mode, options, contextMessages, onProgress, shouldAbort } = args;
  const results: VoteRecord[] = new Array(voters.length);
  let next = 0;
  let done = 0;
  const worker = async (): Promise<void> => {
    while (true) {
      if (shouldAbort?.()) throw new Error('vote-aborted');
      const i = next++;
      if (i >= voters.length) return;
      const voter = voters[i];
      onProgress?.(voter, done, voters.length);
      results[i] = await fetchVoteRecord(config, voter, voteTopic, mode, options, contextMessages);
      done++;
      onProgress?.(voter, done, voters.length);
    }
  };
  const pool: Promise<void>[] = [];
  const n = Math.min(VOTE_CONCURRENCY, voters.length);
  for (let k = 0; k < n; k++) pool.push(worker());
  await Promise.all(pool);
  if (shouldAbort?.()) throw new Error('vote-aborted');
  return results;
}

/** 多選手填選項解析（一行一選項，亦容忍頓號／逗號分隔，上限 4 項） */
export function parseCustomOptions(text: string): string[] {
  return text
    .split(/[\r\n、，,；;]+/)
    .map(s => s.trim().slice(0, 30))
    .filter(s => s !== '' && s !== '棄權')
    .slice(0, 4);
}
