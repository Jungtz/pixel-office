/**
 * PixelOffice - 像素辦公室 AI 職場模擬 - 遊戲核心型別與資料結構
 */

/**
 * 角色型別為動態字串：只要在 src/prompts 新增 {id}.md 即自動成為新角色，
 * 故不以 union type 窮舉。
 */
export type RoleType = string;

export interface RoleConfig {
  id: RoleType;
  name: string;
  title: string;
  avatarColor: string;
  hairColor: string;
  clothingColor: string;
  description: string;
  personality: string;
  catchphrases: string[];
  systemPrompt: string;
  interests: string[];
  defaultCount: number;
}

export interface Position {
  x: number; // Grid X
  y: number; // Grid Y
}

export interface PixelPosition {
  x: number;
  y: number;
}

export type Direction = 'up' | 'down' | 'left' | 'right';

export type AgentStatus = 'idle' | 'walking' | 'working' | 'talking' | 'coffee' | 'meeting' | 'resting' | 'phone' | 'stretch' | 'daydream' | 'thinking' | 'patrolling';

export interface AgentNeeds {
  energy: number;   // 0 ~ 100
  caffeine: number; // 0 ~ 100
  social: number;   // 0 ~ 100
}

export interface PersonalityTraits {
  sociability: number;       // 0~1：社牛↔邊緣人
  diligence: number;         // 0~1：工作狂↔偷懶王
  curiosity: number;         // 0~1：好奇寶寶↔專注當下
  caffeineAddiction: number; // 0~1：咖啡成癮↔不喝咖啡
  stressTolerance: number;   // 0~1：淡定↔玻璃心
  expressiveness: number;    // 0~1：話多↔沉默
  humorLevel: number;        // 0~1：搞笑↔正經
}

export type MoodState =
  | 'neutral'
  | 'happy'
  | 'stressed'
  | 'bored'
  | 'excited'
  | 'nervous'
  | 'focused'
  | 'lazy'
  | 'panicked'
  | 'proud';

export interface AgentCharacter {
  id: string;
  name: string;
  role: RoleType;
  gridPos: Position;
  targetPos: Position | null;
  pixelPos: PixelPosition;
  direction: Direction;
  animFrame: number;
  status: AgentStatus;
  path: Position[];
  speechBubble: string | null;
  speechTimer: number;
  deskPos: Position;
  isUser?: boolean;
  stats: {
    stress: number; // 0 ~ 100
    coffeeLevel: number; // 0 ~ 100
    workProgress: number; // 0 ~ 100
  };
  needs: AgentNeeds;
  personality: PersonalityTraits;
  mood: MoodState;
  moodTimer: number;
  miniBubble: string | null;
  miniBubbleTimer: number;
  lastMiniBubbleTime: number;
  activityStartTime: number;
  activityDuration: number;
  emojiBubble: string | null;
  emojiTimer: number;
  actionTargetId: string | null;
  lastRoleActionTime: number;
  lastIdleActionTime: number;
  eventMoveTarget: Position | 'desk' | 'sofa' | 'center' | null;
  eventMoveStatus: AgentStatus | null;
  eventChainId: string | null;
  eventChainStep: number;
}

export interface ChatMessage {
  id: string;
  speakerId: string;
  speakerName: string;
  speakerRole: RoleType;
  text: string;
  timestamp: string;
  isMeeting?: boolean;
  targetId?: string; // 如果是特定對象講話
}

export type TileType = 
  | 'floor'
  | 'wall'
  | 'desk'
  | 'chair'
  | 'computer'
  | 'coffee_machine'
  | 'water_cooler'
  | 'meeting_table'
  | 'whiteboard'
  | 'sofa'
  | 'plant'
  | 'boss_desk'
  | 'clock';

export interface TileInfo {
  type: TileType;
  walkable: boolean;
  label?: string;
  interactable?: 'coffee' | 'meeting' | 'work' | 'rest';
}

export interface MeetingState {
  isActive: boolean;
  topic: string;
  participants: string[]; // Agent IDs
  log: ChatMessage[];
  startTime: number;
}

export interface GameEvent {
  id: string;
  name: string;
  description: string;
  emoji: string;
}
