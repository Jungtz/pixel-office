import type { LLMConfig } from './aiAgent';

export interface ChatLogMessage {
  timestamp: string;
  speakerName: string;
  speakerRole: string;
  text: string;
}

export interface ChatLogMeta {
  filename: string;
  topic: string;
  startedAt: string;
  lastUpdated: string;
  count: number;
  mtime: number;
}

export interface ChatLogDetail {
  filename: string;
  topic: string;
  startedAt: string;
  messages: ChatLogMessage[];
}

export interface ResumedSession {
  filename: string;
  topic: string;
  startedAt: string;
  messages: ChatLogMessage[];
  summary: string;
}

/**
 * 從歷史訊息還原發言者陣容（保首次出現順序，同名取最常用的 role）
 */
export function distinctSpeakers(messages: ChatLogMessage[]): { name: string; role: string }[] {
  const order: string[] = [];
  const roleVotes = new Map<string, Map<string, number>>();
  for (const m of messages) {
    const name = (m.speakerName || '').trim();
    const role = (m.speakerRole || '').trim().toUpperCase();
    if (!name || !role) continue;
    if (!roleVotes.has(name)) {
      roleVotes.set(name, new Map());
      order.push(name);
    }
    const votes = roleVotes.get(name)!;
    votes.set(role, (votes.get(role) || 0) + 1);
  }
  return order.map(name => {
    const votes = roleVotes.get(name)!;
    let bestRole = '';
    let bestCount = -1;
    for (const [role, count] of votes) {
      if (count > bestCount) {
        bestCount = count;
        bestRole = role;
      }
    }
    return { name, role: bestRole };
  });
}

/**
 * 從檔名解析 session stamp（複寫同一檔時沿用，不開新檔）
 */
export function parseStamp(filename: string): string | null {
  const m = filename.match(/^(\d{8}-\d{6})-/);
  return m ? m[1] : null;
}

async function readJson(res: Response): Promise<any> {
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error(`伺服器回應異常（${res.status}）`);
  }
  return res.json();
}

/**
 * 列出可接續的歷史紀錄（依最後更新倒序）
 */
export async function fetchChatLogList(): Promise<ChatLogMeta[]> {
  const res = await fetch('/api/chat-logs');
  const data = await readJson(res);
  if (data.status === 'ok' && Array.isArray(data.logs)) {
    return data.logs as ChatLogMeta[];
  }
  throw new Error(data.error || '讀取歷史列表失敗');
}

/**
 * 讀取單一歷史檔全文
 */
export async function fetchChatLogDetail(file: string): Promise<ChatLogDetail> {
  if (!file) throw new Error('檔名不合法');
  const res = await fetch(`/api/chat-log?file=${encodeURIComponent(file)}`);
  const data = await readJson(res);
  if (data.status === 'ok' && Array.isArray(data.messages)) {
    return {
      filename: data.filename,
      topic: data.topic || '',
      startedAt: data.startedAt || '',
      messages: data.messages as ChatLogMessage[]
    };
  }
  throw new Error(data.error || '讀取歷史檔案失敗');
}

/**
 * 接續前備份舊檔（後端複製到 chat-logs/backup/），回傳備份檔名
 */
export async function backupChatLog(file: string): Promise<string | null> {
  const res = await fetch('/api/chat-logs/backup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file })
  });
  const data = await readJson(res);
  if (data.status === 'backed-up') return data.backupFile as string;
  if (data.status === 'skipped') return null;
  throw new Error(data.error || '備份舊檔失敗');
}

/**
 * 產生前情提要（mock 模式由後端做摘錄式摘要，不拋錯）
 */
export async function summarizeChatLog(
  llm: LLMConfig,
  topic: string,
  messages: ChatLogMessage[]
): Promise<{ summary: string; mocked: boolean }> {
  const res = await fetch('/api/chat-logs/summary', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      providerId: llm.provider,
      model: llm.model,
      apiKey: llm.apiKey,
      topic,
      messages: messages.map(m => ({ speakerName: m.speakerName, text: m.text }))
    })
  });
  const data = await readJson(res);
  if (typeof data.summary === 'string' && data.summary) {
    return { summary: data.summary, mocked: data.status !== 'success' };
  }
  throw new Error(data.error || '產生摘要失敗');
}
