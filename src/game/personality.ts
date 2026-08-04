import { PersonalityTraits, RoleType } from './types';

function hashInt(seed: number): number {
  let h = seed;
  h = ((h << 5) - h) + 0x6b8b4567;
  h |= 0;
  return Math.abs(h);
}

function pseudoRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = hashInt(s + 1);
    return (s % 1000) / 1000;
  };
}

const ROLE_TRAIT_BIASES: Record<string, Partial<PersonalityTraits>> = {
  BOSS:  { sociability: 0.78, diligence: 0.60, curiosity: 0.30, caffeineAddiction: 0.50, stressTolerance: 0.55, expressiveness: 0.80, humorLevel: 0.40 },
  PM:    { sociability: 0.82, diligence: 0.75, curiosity: 0.35, caffeineAddiction: 0.65, stressTolerance: 0.35, expressiveness: 0.78, humorLevel: 0.38 },
  RD:    { sociability: 0.40, diligence: 0.82, curiosity: 0.55, caffeineAddiction: 0.85, stressTolerance: 0.58, expressiveness: 0.35, humorLevel: 0.50 },
  QA:    { sociability: 0.48, diligence: 0.78, curiosity: 0.72, caffeineAddiction: 0.55, stressTolerance: 0.42, expressiveness: 0.45, humorLevel: 0.35 },
  UIUX:  { sociability: 0.55, diligence: 0.70, curiosity: 0.80, caffeineAddiction: 0.60, stressTolerance: 0.40, expressiveness: 0.70, humorLevel: 0.48 },
  AD:    { sociability: 0.60, diligence: 0.55, curiosity: 0.85, caffeineAddiction: 0.45, stressTolerance: 0.50, expressiveness: 0.88, humorLevel: 0.62 },
  INTERN:{ sociability: 0.65, diligence: 0.88, curiosity: 0.75, caffeineAddiction: 0.30, stressTolerance: 0.20, expressiveness: 0.55, humorLevel: 0.55 },
  DAVIS: { sociability: 0.42, diligence: 0.80, curiosity: 0.68, caffeineAddiction: 0.58, stressTolerance: 0.60, expressiveness: 0.40, humorLevel: 0.30 },
};

// 動態角色無專屬特質時的通用基準
const DEFAULT_TRAITS: PersonalityTraits = {
  sociability: 0.50,
  diligence: 0.65,
  curiosity: 0.60,
  caffeineAddiction: 0.50,
  stressTolerance: 0.50,
  expressiveness: 0.55,
  humorLevel: 0.50,
};

function clamp(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export function generatePersonality(role: RoleType, agentIndex: number): PersonalityTraits {
  const rng = pseudoRandom(agentIndex * 7919 + role.charCodeAt(0) * 331);

  const bias = ROLE_TRAIT_BIASES[role] || DEFAULT_TRAITS;

  return {
    sociability:       clamp(bias.sociability!       + (rng() - 0.5) * 0.55),
    diligence:         clamp(bias.diligence!         + (rng() - 0.5) * 0.50),
    curiosity:         clamp(bias.curiosity!         + (rng() - 0.5) * 0.55),
    caffeineAddiction: clamp(bias.caffeineAddiction! + (rng() - 0.5) * 0.50),
    stressTolerance:   clamp(bias.stressTolerance!   + (rng() - 0.5) * 0.55),
    expressiveness:    clamp(bias.expressiveness!    + (rng() - 0.5) * 0.50),
    humorLevel:        clamp(bias.humorLevel!        + (rng() - 0.5) * 0.55),
  };
}

interface PersonalityLabelDef {
  min?: Partial<PersonalityTraits>;
  max?: Partial<PersonalityTraits>;
  label: string;
  emoji: string;
}

const PERSONALITY_LABELS: Record<string, PersonalityLabelDef> = {
  socialButterfly:    { min: { sociability: 0.75 }, label: '社交花', emoji: '🦋' },
  loneWolf:           { min: { sociability: 0 }, max: { sociability: 0.25 }, label: '獨行俠', emoji: '🐺' },
  workaholic:         { min: { diligence: 0.80 }, label: '工作狂', emoji: '⚡' },
  slacker:            { min: { diligence: 0 }, max: { diligence: 0.25 }, label: '摸魚王', emoji: '🎮' },
  curiousCat:         { min: { curiosity: 0.80 }, label: '好奇寶寶', emoji: '🐱' },
  coffeeAddict:       { min: { caffeineAddiction: 0.80 }, label: '咖啡成癮', emoji: '☕' },
  zenMaster:          { min: { stressTolerance: 0.80 }, label: '淡定大師', emoji: '🧘' },
  dramaQueen:         { min: { stressTolerance: 0 }, max: { stressTolerance: 0.22 }, label: '戲劇女王', emoji: '🎭' },
  chatterbox:         { min: { expressiveness: 0.78 }, label: '話匣子', emoji: '📣' },
  silentType:         { min: { expressiveness: 0 }, max: { expressiveness: 0.22 }, label: '省話一哥', emoji: '🤐' },
  classClown:         { min: { humorLevel: 0.78 }, label: '搞笑擔當', emoji: '🤡' },
};

export function getPersonalityLabels(traits: PersonalityTraits): { label: string; emoji: string }[] {
  const result: { label: string; emoji: string }[] = [];
  const traitRecord = traits as unknown as Record<string, number>;

  for (const [, def] of Object.entries(PERSONALITY_LABELS)) {
    let matches = true;
    if (def.min) {
      for (const [key, val] of Object.entries(def.min)) {
        if (traitRecord[key] < val) { matches = false; break; }
      }
    }
    if (matches && def.max) {
      for (const [key, val] of Object.entries(def.max)) {
        if (traitRecord[key] > val) { matches = false; break; }
      }
    }
    if (matches) result.push({ label: def.label, emoji: def.emoji });
  }

  return result.slice(0, 3);
}
