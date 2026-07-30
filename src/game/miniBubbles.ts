import { RoleType } from './types';

type BubbleContext =
  | 'greeting'
  | 'coffee_run'
  | 'stressed_out'
  | 'happy_moment'
  | 'working_hard'
  | 'bored_at_desk'
  | 'boss_sighting'
  | 'meeting_dread'
  | 'snack_time'
  | 'leaving_desk'
  | 'returning_desk'
  | 'chatting'
  | 'tired'
  | 'random';

const POOL: Record<RoleType, Record<BubbleContext, string[]>> = {
  PM: {
    greeting:       ['早安！', '進度如何？', '等等 sync 一下', '大家早啊～'],
    coffee_run:     ['我需要咖啡才能活下去', '順便幫我也倒一杯', '咖啡時間！'],
    stressed_out:   ['客戶又改需求了…', '這個 ETA 根本不可能', '我頭好痛'],
    happy_moment:   ['進度超前！', '今天效率不錯', '團隊加油！'],
    working_hard:   ['這份報表今晚要交', '整理一下時程…', '回信回不完'],
    bored_at_desk:  ['來看一下 Jira…', '下個會議幾點啊？', '好想出去走走'],
    boss_sighting:  ['（假裝忙碌）', '老闆來了！', '快回座位'],
    meeting_dread:  ['又要開會…', '這會議不能發 email 嗎', '幾分鐘的短會？'],
    snack_time:     ['誰要吃零食？', '好餓…', '下午茶時間'],
    leaving_desk:   ['我去巡一下', '去跟 RD 確認進度', '離開一下'],
    returning_desk: ['回來了', '繼續處理', '剛才說到哪'],
    chatting:       ['你說得對', '太扯了吧', '原來如此！'],
    tired:          ['好想睡…', '我需要補眠', '昨晚加班到很晚'],
    random:         ['這專案有潛力！', '該衝刺了', '打起精神'],
  },
  RD: {
    greeting:       ['早', '來了啊', '嗯', '嗨'],
    coffee_run:     ['咖啡沒了，末日降臨', '今天的第三杯', '去補咖啡'],
    stressed_out:   ['這 bug 是什麼鬼', '生產環境又掛了', '誰改了這段程式碼'],
    happy_moment:   ['PR merged！', '單元測試全過', '效能優化成功'],
    working_hard:   ['專注模式 ON', '不要打擾我', '這演算法很精妙'],
    bored_at_desk:  ['Hacker News 有什麼新東西', '來看一下 GitHub trending', '想學 Rust...'],
    boss_sighting:  ['（切回 IDE）', '（關掉 YouTube）', '老闆經過'],
    meeting_dread:  ['開會不如寫 code', '這會議跟我有關嗎', '線上會議我可以關鏡頭嗎'],
    snack_time:     ['有零食？', '能量棒時間', '補給一下'],
    leaving_desk:   ['去透透氣', '站起來動一下', '去白板想一下架構'],
    returning_desk: ['繼續 coding', '嗯', '回到位置'],
    chatting:       ['stack overflow 上有解', '這要用設計模式', 'clean code 原則'],
    tired:          ['眼睛好痠', '該休息了', '能量耗盡'],
    random:         ['if it works, dont touch it', '要不要 refactor 呢', '今天 commit 幾次了'],
  },
  QA: {
    greeting:       ['早！今天要測什麼', '大家早，有新 build 嗎', '哈囉'],
    coffee_run:     ['來一杯再繼續測', '補充咖啡因', '去泡咖啡'],
    stressed_out:   ['又 crash 了', '這個復現步驟好難', 'Blocker 又增加了'],
    happy_moment:   ['找到 bug 了！', '回歸測試通過', '這個 fix 很漂亮'],
    working_hard:   ['跑測試中…', '寫測試案例', '邊界條件確認'],
    bored_at_desk:  ['等 build 中…', '測試跑到一半', '自動化測試好慢'],
    boss_sighting:  ['（專心看螢幕）', '（打開測試報告）', '老闆！'],
    meeting_dread:  ['又要開會…', '測試進度來不及了', '可以遠端參加嗎'],
    snack_time:     ['休息一下', '有人要一起訂飲料嗎', '肚子餓了'],
    leaving_desk:   ['去找 RD 確認 bug', '去拿測試機', '走動一下'],
    returning_desk: ['繼續測試', '回座', '剛那 bug 確認了'],
    chatting:       ['那個 corner case 你測了嗎', '這個必現', '我開 issue 了'],
    tired:          ['眼睛好乾', '精神不濟容易漏 bug', '想休息'],
    random:         ['今天測了幾輪了？', '品質就是生命', '魔鬼在細節裡'],
  },
  UIUX: {
    greeting:       ['早安～', '今天的光線很適合設計', '大家早！'],
    coffee_run:     ['喝杯咖啡找靈感', '咖啡是設計的燃料', '來一杯'],
    stressed_out:   ['這對齊偏了 1px', '設計 deadline 太趕', 'Figma 當掉了'],
    happy_moment:   ['這個介面好美！', '動畫曲線完美', '配色太棒了'],
    working_hard:   ['調整元件中', '這微互動要再細膩', '設計系統整理'],
    bored_at_desk:  ['來逛 Dribbble', 'Pinterest 找靈感', '看看 Behance'],
    boss_sighting:  ['（開 Figma）', '（認真工作貌）', '老闆來了'],
    meeting_dread:  ['設計 review 又要被改', '會議好多', '設計不需要這麼多會'],
    snack_time:     ['高級零食時間', '來杯手沖', '吃點甜的'],
    leaving_desk:   ['去外面找靈感', '去看外面的天空', '需要新鮮空氣'],
    returning_desk: ['靈感來了', '繼續設計', '回到工作'],
    chatting:       ['你覺得這個配色如何', '使用者會這樣想', 'UX 流程要順'],
    tired:          ['靈感枯竭', '眼睛疲勞', '需要重啟大腦'],
    random:         ['less is more', '這個留白很重要', '字體大小要統一'],
  },
  AD: {
    greeting:       ['早安，今天陽光真好', '嗨，今天充滿靈感', '大家好'],
    coffee_run:     ['一杯咖啡，一種意境', '咖啡是藝術', '靈感從咖啡開始'],
    stressed_out:   ['畫面沒有靈魂', '這視覺不夠震撼', '感覺不對'],
    happy_moment:   ['這個視覺有 WOW 感！', '完美！這就是我要的', '感動人心的設計'],
    working_hard:   ['在找視覺參考', '調色中', '這質感要再提升'],
    bored_at_desk:  ['窗外景色不錯', '需要新的視覺刺激', '看看藝術雜誌'],
    boss_sighting:  ['（拿出設計稿）', '（展示 mood board）', '老闆來了，正好'],
    meeting_dread:  ['又要解釋設計理念', '會議殺死創意', '我需要時間創作'],
    snack_time:     ['來杯花草茶', '點心時間', '享受一下'],
    leaving_desk:   ['去感受一下外面的光影', '需要走一走', '找尋靈感'],
    returning_desk: ['有想法了', '回到畫布', '繼續創作'],
    chatting:       ['你懂這種感覺嗎', '畫面要有故事', '色彩說的是情緒'],
    tired:          ['創意枯竭', '審美疲勞', '腦袋需要充電'],
    random:         ['要有靈魂！', '像素與微光的碰撞', '每一筆都有意義'],
  },
  INTERN: {
    greeting:       ['學長學姊早！', '大家早安！', '早安！今天要努力學習'],
    coffee_run:     ['需要幫大家倒咖啡嗎？', '咖啡機我來操作', '誰要喝咖啡？'],
    stressed_out:   ['我搞砸了嗎', '怎麼辦…', '學長救命'],
    happy_moment:   ['我成功了！', '學到新東西！', '今天有貢獻！'],
    working_hard:   ['認真學習中', '做筆記', '研究程式碼'],
    bored_at_desk:  ['等任務分配…', '來看技術文章', '有什麼可以幫忙的'],
    boss_sighting:  ['（坐直）', '（超緊張）', '老闆好！'],
    meeting_dread:  ['我要報告什麼…', '會議好多專有名詞', '認真做會議記錄'],
    snack_time:     ['我來幫忙訂飲料', '大家要吃什麼？', '零食補給'],
    leaving_desk:   ['去倒垃圾', '去幫學長拿東西', '跑腿中'],
    returning_desk: ['回來了！有什麼需要幫忙的嗎', '迅速回座', '報到'],
    chatting:       ['可以請教一下嗎', '謝謝學長！', '學到了！'],
    tired:          ['今天好充實', '有點累但開心', '精神不濟但繼續努力'],
    random:         ['我要加油！', '今天要學到三件事', '幫忙是學習最快的方式'],
  },
  BOSS: {
    greeting:       ['大家早！今天也要全力以赴', '早安，讓我們創造奇蹟', '早！'],
    coffee_run:     ['有人要喝咖啡嗎？我請客', '來杯咖啡，談談你的想法', '這台咖啡機該升級了'],
    stressed_out:   ['營收數字不好看', '投資人又在催了', '壓力就是成長'],
    happy_moment:   ['太棒了！這就是我要的', '團隊做得好！', '我們的方向是對的'],
    working_hard:   ['看營運報表', '思考下一個策略', '商業模式再調整'],
    bored_at_desk:  ['來巡視一下', '看看大家的士氣', '走出辦公室'],
    boss_sighting:  ['（這是我的地盤）', '（巡視中）', '（觀察團隊）'],
    meeting_dread:  ['會議太多了', '但我是老闆沒辦法', '精簡會議'],
    snack_time:     ['叫點高級點心來', '大家下午茶我請', '吃點東西'],
    leaving_desk:   ['來關心一下進度', '巡視各部門', '走一圈'],
    returning_desk: ['回來繼續思考策略', '回辦公室', '繼續工作'],
    chatting:       ['這個點子不錯，繼續發展', '你的潛力我看見了', 'ROI 要算清楚'],
    tired:          ['創業真的很累', '但值得', '休息是為了走更遠'],
    random:         ['顛覆業界！', 'AI 是未來', '年終翻倍不是夢'],
  },
};

export function getMiniBubble(role: RoleType, context: BubbleContext): string {
  const rolePool = POOL[role];
  if (!rolePool) return '...';

  const candidates = rolePool[context] || rolePool.random;
  if (candidates.length === 0) return '...';

  return candidates[Math.floor(Math.random() * candidates.length)];
}

export function getRandomMiniBubble(role: RoleType): string {
  return getMiniBubble(role, 'random');
}

export function getContextBubble(role: RoleType): string {
  const contexts: BubbleContext[] = [
    'greeting', 'coffee_run', 'stressed_out', 'happy_moment',
    'working_hard', 'bored_at_desk', 'random'
  ];
  const ctx = contexts[Math.floor(Math.random() * contexts.length)];
  return getMiniBubble(role, ctx);
}
