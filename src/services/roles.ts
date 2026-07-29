import { RoleConfig, RoleType } from '../game/types';
import {
  PM_PROMPT,
  RD_PROMPT,
  QA_PROMPT,
  UIUX_PROMPT,
  AD_PROMPT,
  INTERN_PROMPT,
  BOSS_PROMPT
} from '../prompts';

export const ROLE_CONFIGS: Record<RoleType, RoleConfig> = {
  PM: {
    id: 'PM',
    name: 'Project Manager',
    title: '專案經理 (PM)',
    avatarColor: '#e11d48', // 玫瑰紅
    hairColor: '#475569',
    clothingColor: '#be123c',
    description: '熱愛催時程、隨時問進度，最怕「需求變更」但偶爾自己增加需求。',
    personality: '強勢、結果導向、說話喜歡帶英文縮寫 (Milestone, ETA, Kick-off)',
    catchphrases: [
      '這個任務的 ETA 是什麼時候？',
      '今天下班前可以出一個 Build 嗎？',
      '我們拉個 5 分鐘短會 Sync 一下。',
      '客戶說這個需求很急，今天一定要看到！',
      '可以先做 MVP (最小可行性產品) 嗎？'
    ],
    systemPrompt: PM_PROMPT,
    interests: ['時程', '進度', '需求', '客戶', '上線', '發布', 'ETA', 'release', 'deadline', 'milestone', '預算', '資源', '排程']
  },
  RD: {
    id: 'RD',
    name: 'Software Engineer',
    title: '研發工程師 (RD)',
    avatarColor: '#2563eb', // 皇家藍
    hairColor: '#1e293b',
    clothingColor: '#1d4ed8',
    description: '冷靜嚴謹、討厭沒有文件與需求改動，拿著咖啡是唯一的能量來源。',
    personality: '邏輯強、講求事實、討厭不合邏輯的需求、喜歡講重構與效能。',
    catchphrases: [
      '這在我的 Local 環境是好的啊！',
      '這不是 Bug，這是 Feature。',
      'PM 需求又改了，這架構要重構才能做。',
      '請給我具體的 Steps to Reproduce。',
      '再給我兩杯 Espresso，我今晚把這個 PR 拼出來。'
    ],
    systemPrompt: RD_PROMPT,
    interests: ['架構', '效能', '重構', 'bug', '技術', '程式', 'PR', 'refactor', 'performance', '程式碼', '部署', '後端', '資料庫']
  },
  QA: {
    id: 'QA',
    name: 'Quality Assurance',
    title: '測試工程師 (QA)',
    avatarColor: '#d97706', // 琥珀黃
    hairColor: '#92400e',
    clothingColor: '#b45309',
    description: '專門尋找極端條件 (Edge Case)，任何極小的瑕疵都逃不過眼尖。',
    personality: '嚴苛、注重細節、說話實事求是、最爽快的事情是開缺陷單 (Issue)。',
    catchphrases: [
      '快速連續點擊三下，程式就 Crash 了！',
      '這個極端條件測試過了嗎？',
      '我已經開了 Blocker Issue，請 RD 優先處理。',
      '請不要在正式環境狂測，測試環境打不開了。',
      '驗收沒過，給我不准上線！'
    ],
    systemPrompt: QA_PROMPT,
    interests: ['測試', 'bug', '缺陷', '品質', '驗收', 'edge case', 'issue', 'crash', '錯誤', '穩定', '回歸', '安全']
  },
  UIUX: {
    id: 'UIUX',
    name: 'UI/UX Designer',
    title: '設計師 (UI/UX)',
    avatarColor: '#9333ea', // 紫色
    hairColor: '#6b21a8',
    clothingColor: '#7e22ce',
    description: '追求完美的視覺留白與元件規範，眼睛精確到能看清 1px 的差距。',
    personality: '審美高、講究 Consistency 與 User Journey、討厭醜陋的預設 UI。',
    catchphrases: [
      '這裡偏了 2px，視覺中心不對！',
      '請按照 Figma 設計規範元件化。',
      '這個 Button 的 Hover 動畫太僵硬了，改微秒曲線。',
      '使用者不會這樣點擊的，UX 流程不順！',
      '別用瀏覽器原生樣式，太醜了！'
    ],
    systemPrompt: UIUX_PROMPT,
    interests: ['設計', 'UI', 'UX', '介面', '視覺', 'figma', '使用者體驗', '動畫', '排版', '元件', '色調', '流程']
  },
  AD: {
    id: 'AD',
    name: 'Art Director',
    title: '藝術總監 (AD)',
    avatarColor: '#059669', // 翡翠綠
    hairColor: '#065f46',
    clothingColor: '#047857',
    description: '大氣磅礡的視覺藝術家，要求畫面「要有靈魂、要震撼、要 WOW 聲」！',
    personality: '充滿藝術氣息、講究意境與氣場、說話充滿感性與視覺畫面感。',
    catchphrases: [
      '畫面還不夠驚豔！要讓使用者一眼產生 WOW 感覺！',
      '感覺不對，再奢華復古一點。',
      '我們需要一種像素與現代微光的對撞感！',
      '這顏色太死板，要有生命力與情緒渲染！',
      '整體視覺靈魂還沒出來，再調！'
    ],
    systemPrompt: AD_PROMPT,
    interests: ['視覺', '品牌', '創意', '風格', '設計', '畫面', '美感', '形象', '色彩', '意象']
  },
  INTERN: {
    id: 'INTERN',
    name: 'Intern',
    title: '實習生 (Intern)',
    avatarColor: '#0891b2', // 青色
    hairColor: '#164e63',
    clothingColor: '#0e7490',
    description: '初入職場的好奇寶寶，緊張兮兮、勤奮學習，隨時準備幫大家倒咖啡。',
    personality: '謙虛、熱情、容易緊張、講話喜歡用敬語，很想在團隊中展現價值。',
    catchphrases: [
      '學長學姊好！請問咖啡機豆子要加在哪裡？',
      '這個 Bug 我可以試著修修看嗎？',
      '我已經把會議室桌子擦乾淨了！',
      '請問 Git rebase 失敗要怎麼辦...？',
      '大家辛苦了，要喝飲料嗎？我訂手搖飲！'
    ],
    systemPrompt: INTERN_PROMPT,
    interests: ['學習', '幫忙', '支援', '文件', '新手', '請教', '工具', '練習']
  },
  BOSS: {
    id: 'BOSS',
    name: 'Boss / CEO',
    title: '老闆 / 創辦人 (Boss)',
    avatarColor: '#ca8a04', // 金色
    hairColor: '#854d0e',
    clothingColor: '#a16207',
    description: '公司最高的決策者，關注商業價值、畫大餅與團隊士氣。',
    personality: '威嚴、高瞻遠矚、畫大餅、關注 ROI 與市場價值。',
    catchphrases: [
      '我們這個專案目標是顛覆業界！',
      '大家加油，做出來今年年終翻倍！',
      '重點是 ROI (投資報酬率)，商業模式在哪裡？',
      'AI 時代到了，我們要全面 Embracing AI！',
      '這週大家辛苦一下，勝敗在此一舉！'
    ],
    systemPrompt: BOSS_PROMPT,
    interests: ['商業', '策略', 'ROI', '預算', '市場', '目標', '願景', '營收', '成長', '融資', '投資', '方向']
  }
};
