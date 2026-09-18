/**
 * Skills 動態載入器：比照常規 AI agents 規範（SKILL.md＋資料夾制）。
 *
 * 新增 skill：在 skills/ 下新增一個資料夾，內含：
 *   skills/<name>/
 *     SKILL.md   # 必備：frontmatter 含 name（=資料夾名，僅小寫/數字/連字號）與 description
 *     index.ts   # 必備：default export 符合 ChatSkill 的物件
 *
 *   import type { ChatSkill } from '../../skillsLoader';
 *   const mySkill: ChatSkill = {
 *     id: 'my-skill',            // 必須與資料夾名一致
 *     label: '顯示名稱',
 *     detect: (ctx) => string | null,            // 從主題/body 找觸發鍵，無則回 null
 *     buildBlock: async (key) => string,         // 組 prompt 區塊，無內容回 ''
 *     instruction: '...'                         // 有區塊時追加進【重要】的引用指令（可選）
 *   };
 *   export default mySkill;
 *
 * 規則：存在即啟用；資料夾 `_開頭` 即停用（改名免刪檔）；單一壞 skill 只 warn 跳過。
 */
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

export interface SkillContext {
  topic?: string;
  body: Record<string, unknown>;
}

export interface ChatSkill {
  id: string;
  label: string;
  detect: (ctx: SkillContext) => string | null;
  buildBlock: (key: string, section: Record<string, unknown>) => Promise<string>;
  instruction?: string;
}

export interface SkillMeta {
  name: string;
  description: string;
}

export interface LoadedSkill {
  skill: ChatSkill;
  meta: SkillMeta;
  dir: string;
}

export interface SkillOutput {
  id: string;
  block: string;
  instruction?: string;
}

const SKILL_NAME_RE = /^[a-z0-9-]+$/;

/** 解析 SKILL.md frontmatter（name／description；支援 | 與 > 多行） */
export function parseSkillMd(text: string): { name?: string; description?: string } {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return {};
  const out: Record<string, string> = {};
  let key: string | null = null;
  let mode: '|' | '>' | null = null;
  const buf: string[] = [];
  const flush = () => {
    if (key) out[key] = mode === '>' ? buf.join(' ').trim() : buf.join('\n').trim();
    key = null;
    mode = null;
    buf.length = 0;
  };
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/);
    if (kv && !/^\s/.test(line)) {
      flush();
      const v = kv[2].trim();
      if (v === '|' || v === '>') {
        key = kv[1];
        mode = v;
      } else {
        out[kv[1]] = v.replace(/^['"]|['"]$/g, '');
      }
    } else if (key && /^\s/.test(line)) {
      buf.push(line.trim());
    }
  }
  flush();
  return { name: out['name'], description: out['description'] };
}

function isSkill(v: unknown): v is ChatSkill {
  if (!v || typeof v !== 'object') return false;
  const s = v as Record<string, unknown>;
  return typeof s['id'] === 'string'
    && typeof s['label'] === 'string'
    && typeof s['detect'] === 'function'
    && typeof s['buildBlock'] === 'function';
}

/**
 * 掃描並載入啟用的 skills（資料夾排序，`_`/`.`開頭跳過）。
 * @param opts.dir 技能根目錄（預設 <cwd>/skills，測試可注入）
 */
export async function loadSkills(opts?: { dir?: string }): Promise<LoadedSkill[]> {
  const dir = opts?.dir || path.join(process.cwd(), 'skills');
  let entries: string[] = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
      .filter(e => e.isDirectory() && !e.name.startsWith('_') && !e.name.startsWith('.'))
      .map(e => e.name)
      .sort();
  } catch (err) {
    console.warn('[Skills] 技能目錄掃描失敗，略過全部:', (err as Error).message);
    return [];
  }
  const loaded: LoadedSkill[] = [];
  for (const name of entries) {
    const skillDir = path.join(dir, name);
    // 1. SKILL.md 規範驗證
    let meta: SkillMeta | null = null;
    try {
      const md = fs.readFileSync(path.join(skillDir, 'SKILL.md'), 'utf-8');
      const { name: mdName, description } = parseSkillMd(md);
      if (!mdName || !SKILL_NAME_RE.test(mdName)) throw new Error('frontmatter 缺少合法 name');
      if (mdName !== name) throw new Error(`name "${mdName}" 與資料夾名 "${name}" 不一致`);
      if (!description) throw new Error('frontmatter 缺少 description');
      meta = { name: mdName, description };
    } catch (err) {
      console.warn(`[Skills] ${name}/SKILL.md 不合規範，已跳過:`, (err as Error).message);
      continue;
    }
    // 2. 實作載入
    try {
      const mod = await import(pathToFileURL(path.join(skillDir, 'index.ts')).href) as { default?: unknown };
      if (!isSkill(mod.default)) {
        console.warn(`[Skills] ${name}/index.ts 無有效 default export，已跳過`);
        continue;
      }
      if (mod.default.id !== name) {
        console.warn(`[Skills] ${name}/index.ts 的 id "${mod.default.id}" 與資料夾名不一致，已跳過`);
        continue;
      }
      loaded.push({ skill: mod.default, meta: meta as SkillMeta, dir: name });
      console.log(`[Skills] 已載入: ${name}（${mod.default.label}）`);
    } catch (err) {
      console.warn(`[Skills] ${name}/index.ts 載入失敗，已跳過:`, (err as Error).message);
    }
  }
  return loaded;
}

/** 執行 skills：detect 找觸發鍵 → 並行 buildBlock，全程 fail-soft */
export async function runSkills(ctx: SkillContext, loaded: LoadedSkill[]): Promise<{ outputs: SkillOutput[] }> {
  const triggered: Array<{ loaded: LoadedSkill; key: string }> = [];
  for (const l of loaded) {
    try {
      const key = l.skill.detect(ctx);
      if (key) triggered.push({ loaded: l, key });
    } catch (err) {
      console.warn(`[Skills:${l.skill.id}] detect 失敗，已略過:`, (err as Error).message);
    }
  }
  const results = await Promise.all(triggered.map(async ({ loaded: l, key }) => {
    try {
      const block = await l.skill.buildBlock(key, {});
      if (!block) return null;
      return { id: l.skill.id, block, instruction: l.skill.instruction } as SkillOutput;
    } catch (err) {
      console.warn(`[Skills:${l.skill.id}] buildBlock 失敗，已略過:`, (err as Error).message);
      return null;
    }
  }));
  return { outputs: results.filter((r): r is SkillOutput => r !== null) };
}

let cached: Promise<LoadedSkill[]> | null = null;

/** 伺服器用單例：首次呼叫載入並快取（避開 top-level await 排序問題） */
export function getSkills(): Promise<LoadedSkill[]> {
  if (!cached) cached = loadSkills();
  return cached;
}
