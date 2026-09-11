import { RoleConfig } from '../game/types';

/**
 * 動態角色載入器：
 * 掃描 src/prompts/*.md（scene.md 除外），每個檔案即是一個角色。
 * 檔名（去除 .md 並大寫化）為角色 id，例如 qa.md → QA，
 * 後端 loadRolePrompt 亦依此規則讀取同一份 md。
 *
 * 檔案格式：可選 YAML frontmatter（--- 包夾）定義角色 metadata，
 * frontmatter 之後的內容為 system prompt body。
 * 未提供 frontmatter 的角色會套用預設值，仍可正常出現在畫面上。
 */

const ROLE_PROMPT_FILES = import.meta.glob('/src/prompts/*.md', {
  eager: true,
  query: '?raw',
  import: 'default'
}) as Record<string, string>;

const SCENE_FILE_ID = 'SCENE';

const DEFAULT_COLOR_PALETTE: [string, string, string][] = [
  ['#f97316', '#7c2d12', '#ea580c'],
  ['#14b8a6', '#134e4a', '#0d9488'],
  ['#ec4899', '#831843', '#db2777'],
  ['#84cc16', '#3f6212', '#65a30d'],
  ['#6366f1', '#312e81', '#4f46e5'],
  ['#f43f5e', '#881337', '#e11d48'],
  ['#06b6d4', '#164e63', '#0891b2'],
  ['#a3e635', '#3f6212', '#84cc16']
];

const DEFAULT_ROLE_FALLBACK: Pick<RoleConfig, 'name' | 'title' | 'description' | 'personality' | 'catchphrases' | 'interests'> = {
  name: '未知角色',
  title: '神秘同事',
  description: '尚未撰寫人設的角色，等待你的描述。',
  personality: '個性未定義，一切行為皆有可能。',
  catchphrases: [
    '大家好，我來報到了！',
    '這個任務交給我沒問題！',
    '我還在熟悉環境中…'
  ],
  interests: ['探索', '學習', '協助', '討論']
};

interface RawRoleFile {
  id: string;
  meta: Record<string, unknown>;
  body: string;
}

function parseFrontmatter(content: string): { meta: Record<string, unknown>; body: string } {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { meta: {}, body: content };

  const meta: Record<string, unknown> = {};
  let currentKey: string | null = null;
  let currentList: string[] = [];

  for (const line of match[1].split(/\r?\n/)) {
    const listItem = line.match(/^\s*-\s+(.+)$/);
    if (listItem) {
      if (currentKey) currentList.push(listItem[1].trim());
      continue;
    }
    if (currentKey && currentList.length > 0) {
      meta[currentKey] = currentList;
      currentList = [];
      currentKey = null;
    }
    const kv = line.match(/^([\w-]+):\s*(.*)$/);
    if (kv) {
      const key = kv[1];
      const rawValue = kv[2].trim();
      if (rawValue === '') {
        currentKey = key;
      } else {
        const unquoted = rawValue.replace(/^['"](.*)['"]$/, '$1');
        if (key === 'defaultCount') {
          meta[key] = Number(unquoted);
        } else {
          meta[key] = unquoted;
        }
      }
    }
  }
  if (currentKey && currentList.length > 0) {
    meta[currentKey] = currentList;
  }

  return { meta, body: match[2].trim() };
}

function toRoleId(filename: string): string {
  const base = filename.split('/').pop() || '';
  return base.replace(/\.md$/, '').toUpperCase();
}

function pickColor(id: string): [string, string, string] {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return DEFAULT_COLOR_PALETTE[hash % DEFAULT_COLOR_PALETTE.length];
}

function buildRoleConfig(file: RawRoleFile): RoleConfig {
  const meta = file.meta;
  const fallback = DEFAULT_ROLE_FALLBACK;
  const colors = pickColor(file.id);
  const str = (key: string, fallbackValue: string): string => {
    const v = meta[key];
    return typeof v === 'string' && v.trim() !== '' ? v : fallbackValue;
  };
  const strList = (key: string, fallbackValue: string[]): string[] => {
    const v = meta[key];
    return Array.isArray(v) && v.length > 0 ? (v as string[]) : fallbackValue;
  };
  const num = (key: string, fallbackValue: number): number => {
    const v = meta[key];
    return typeof v === 'number' && !Number.isNaN(v) ? v : fallbackValue;
  };

  return {
    id: file.id,
    name: str('name', fallback.name),
    title: str('title', fallback.title),
    avatarColor: str('avatarColor', colors[0]),
    hairColor: str('hairColor', colors[1]),
    clothingColor: str('clothingColor', colors[2]),
    description: str('description', fallback.description),
    personality: str('personality', fallback.personality),
    catchphrases: strList('catchphrases', fallback.catchphrases),
    systemPrompt: file.body || `你是一名 ${file.id}。說話請保持該職位的性格特點。`,
    interests: strList('interests', fallback.interests),
    defaultCount: num('defaultCount', 0)
  };
}

export function loadRoleConfigs(): Record<string, RoleConfig> {
  const configs: Record<string, RoleConfig> = {};
  for (const [path, content] of Object.entries(ROLE_PROMPT_FILES)) {
    const id = toRoleId(path);
    if (id === SCENE_FILE_ID) continue;
    const { meta, body } = parseFrontmatter(content);
    configs[id] = buildRoleConfig({ id, meta, body });
  }
  return configs;
}

export function buildRoleAliases(roleConfigs: Record<string, RoleConfig>): Record<string, string> {
  const aliases: Record<string, string> = {};
  for (const id of Object.keys(roleConfigs)) {
    aliases[id] = id;
    aliases[id.toLowerCase()] = id;
    aliases[id.replace('_', '')] = id;
  }
  return aliases;
}
