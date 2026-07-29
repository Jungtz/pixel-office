/**
 * AI 辦公室大亂鬥 - 遊戲核心型別與資料結構
 */

export type RoleType = 'PM' | 'RD' | 'QA' | 'UIUX' | 'AD' | 'INTERN' | 'BOSS';

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

export type AgentStatus = 'idle' | 'walking' | 'working' | 'talking' | 'coffee' | 'meeting';

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
  stats: {
    stress: number; // 0 ~ 100
    coffeeLevel: number; // 0 ~ 100
    workProgress: number; // 0 ~ 100
  };
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
