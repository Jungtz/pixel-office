/**
 * 團隊定義：資訊 / 財金 / 法務
 * 角色透過 md frontmatter 的 `teams:` 標籤歸屬團隊，共用角可屬多團。
 */

export interface TeamDef {
  id: string;
  label: string;
  description: string;
  /** 該團開場／收尾主持人（BOSS 缺席時的代理人） */
  leaderRole: string;
}

export const TEAMS: TeamDef[] = [
  { id: 'it', label: '資訊', description: '軟體開發團隊：PM、RD、QA、UI/UX', leaderRole: 'PM' },
  { id: 'finance', label: '財金', description: '財務金融團隊：CFO、會計、稽核、股務', leaderRole: 'CFO' },
  { id: 'legal', label: '法務', description: '法務法遵團隊：律師、法遵、合約、智財', leaderRole: 'COU' },
];

export const DEFAULT_TEAM = 'it';

/** @param teamId 團隊 id @returns 主持人角色 id */
export function getTeamLeaderRole(teamId: string): string {
  return TEAMS.find(t => t.id === teamId)?.leaderRole ?? '';
}

/**
 * 將 frontmatter 的 teams / team 欄位正規化為團隊 id 陣列。
 * 支援 list（teams:\n  - finance）與字串（teams: finance、teams: [finance]）。
 * 無標籤舊檔預設歸資訊團，保證舊紀錄可接續。
 */
export function normalizeTeams(meta: Record<string, unknown>): string[] {
  const raw = meta['teams'] ?? meta['team'];
  const ids: string[] = [];
  const pushToken = (token: string): void => {
    const id = token.trim().replace(/^\[|\]$/g, '').trim().toLowerCase();
    if (id) ids.push(id);
  };
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (typeof item === 'string') {
        for (const part of item.split(',')) pushToken(part);
      }
    }
  } else if (typeof raw === 'string') {
    const cleaned = raw.replace(/^\[(.*)\]$/, '$1');
    for (const part of cleaned.split(',')) pushToken(part);
  }
  if (ids.length === 0) return [DEFAULT_TEAM];
  return [...new Set(ids)];
}

/**
 * 依歷史發言者角色推斷團隊（接續歷史時用）：財金角優先判財金，法務角判法務。
 */
export function inferTeamFromRoles(roles: string[]): string {
  const set = new Set(roles.map(r => r.toUpperCase()));
  if (['CFO', 'ACC', 'AUD', 'ANA', 'STK'].some(r => set.has(r))) return 'finance';
  if (['COU', 'CMP', 'CTR', 'IPR', 'LIT'].some(r => set.has(r))) return 'legal';
  return DEFAULT_TEAM;
}
