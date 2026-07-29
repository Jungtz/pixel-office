import pmPrompt from './pm.md?raw';
import rdPrompt from './rd.md?raw';
import qaPrompt from './qa.md?raw';
import uiuxPrompt from './uiux.md?raw';
import adPrompt from './ad.md?raw';
import internPrompt from './intern.md?raw';
import bossPrompt from './boss.md?raw';
import { RoleType } from '../game/types';

export const PM_PROMPT = pmPrompt.trim();
export const RD_PROMPT = rdPrompt.trim();
export const QA_PROMPT = qaPrompt.trim();
export const UIUX_PROMPT = uiuxPrompt.trim();
export const AD_PROMPT = adPrompt.trim();
export const INTERN_PROMPT = internPrompt.trim();
export const BOSS_PROMPT = bossPrompt.trim();

export const SYSTEM_PROMPTS: Record<RoleType, string> = {
  PM: PM_PROMPT,
  RD: RD_PROMPT,
  QA: QA_PROMPT,
  UIUX: UIUX_PROMPT,
  AD: AD_PROMPT,
  INTERN: INTERN_PROMPT,
  BOSS: BOSS_PROMPT
};
