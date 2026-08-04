import { RoleConfig } from '../game/types';
import { loadRoleConfigs, buildRoleAliases } from './roleLoader';

/**
 * 動態角色註冊表：
 * 自動掃描 src/prompts/*.md（scene.md 除外），
 * 新增 md 檔即可在畫面上多出一個角色，無需修改任何程式碼。
 */
export const ROLE_CONFIGS: Record<string, RoleConfig> = loadRoleConfigs();

/** @ID 點名解析用的角色別名（id 大小寫與底線變體皆可命中） */
export const ROLE_ALIASES: Record<string, string> = buildRoleAliases(ROLE_CONFIGS);
