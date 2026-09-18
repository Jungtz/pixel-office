/**
 * 主題類型判斷：決定收尾時要不要自動問「是否就地投票」。
 *
 * 原則：預設可投（開放模式兜底只總結），只有明顯不適合的才跳過。
 * 不適合 = 執行型（搶修／同步／分工）與社交型（慶功／迎新／聚餐）。
 * 手動投票不受影響，任何主題都可從 ControlPanel 發起。
 */

/** 不適合自動問投票的主題關鍵字（執行／搶修／同步／社交） */
export const VOTE_SKIP_PATTERNS: RegExp[] = [
  /Bug|崩潰|白屏|錯誤|漏洞|瓶頸|500|緊急|Hotfix|搶修|故障|當機|掛掉/i,
  /金檢|缺失|裁罰|侵權|違約|爆雷|警告函|糾紛/i,
  /進度同步|進度回報|週報|日報|週會|例會|同步會議/i,
  /分工|認領|派工|排班|值班/i,
  /慶功|慶祝|迎新|歡送|聚餐|尾牙|春酒|生日/i,
  /公告|通知|佈達/i,
];

/** 明確適合投票的訊號（命中則直接可投，不再比對跳過表） */
export const VOTE_WANT_PATTERNS: RegExp[] = [
  /投票|表決|票選/i,
  /是否|要不要|該不該|值不值得/i,
  /哪個|哪一|二選一|三選一|怎麼選/i,
  /\bvs\b|對決|比較|評比/i,
  /方案|選項|提案|議案/i,
  /決策|決定|定案|拍板/i,
  /政策|預算|投資|股利|配息|增資|發債|併購/i,
  /提告|訴訟|和解|調解|合約|簽約|解約/i,
  /架構|選型|重構|導入|升級|換約/i,
];

export type TopicVoteKind = 'votable' | 'skip';

/**
 * @param topic 當前討論主題
 * @returns 'votable' 可自動問投票；'skip' 跳過自動問（手動仍可投）
 */
export function classifyTopicForVote(topic: string): TopicVoteKind {
  const text = (topic || '').trim();
  if (!text) return 'skip';
  if (VOTE_WANT_PATTERNS.some((re) => re.test(text))) return 'votable';
  if (VOTE_SKIP_PATTERNS.some((re) => re.test(text))) return 'skip';
  return 'votable';
}
