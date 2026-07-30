import { AgentCharacter, MoodState } from './types';

const MOOD_EMOJI: Record<MoodState, string> = {
  neutral:  '😐',
  happy:    '😄',
  stressed: '😫',
  bored:    '🥱',
  excited:  '🤩',
  nervous:  '😰',
  focused:  '🧐',
  lazy:     '😴',
  panicked: '😱',
  proud:    '😎',
};

const MOOD_DECAY_RATE = 0.25;

export function getMoodEmoji(mood: MoodState): string {
  return MOOD_EMOJI[mood];
}

export function tickMood(agent: AgentCharacter, deltaSeconds: number): void {
  agent.moodTimer -= deltaSeconds;
  if (agent.moodTimer <= 0) {
    agent.moodTimer = 0;
  }

  if (agent.moodTimer <= 0) {
    const noise = Math.random();
    if (noise < MOOD_DECAY_RATE * deltaSeconds) {
      agent.mood = 'neutral';
    }
  }
}

function setMood(agent: AgentCharacter, mood: MoodState, durationSec: number): void {
  agent.mood = mood;
  agent.moodTimer = Math.max(agent.moodTimer, durationSec);
}

export function evaluateMoodFromStatus(agent: AgentCharacter): void {
  const { energy, caffeine, social } = agent.needs;
  const stress = agent.stats.stress;

  if (stress > 75 && agent.moodTimer <= 0) {
    setMood(agent, energy < 25 ? 'panicked' : 'stressed', 8);
    return;
  }

  if (energy < 18 && agent.moodTimer <= 0) {
    setMood(agent, 'lazy', 6);
    return;
  }

  if (caffeine > 85 && energy > 60) {
    setMood(agent, 'excited', 5);
    return;
  }

  if (social > 80 && agent.moodTimer <= 0) {
    setMood(agent, 'happy', 6);
    return;
  }

  if (stress < 20 && energy > 70 && agent.moodTimer <= 0) {
    setMood(agent, 'proud', 5);
    return;
  }

  const allNeedsHigh = energy > 55 && caffeine > 55 && social > 55;
  if (allNeedsHigh && stress < 35 && agent.moodTimer <= 0) {
    setMood(agent, 'neutral', 4);
  }
}

export function triggerMood(agent: AgentCharacter, mood: MoodState, durationSec: number): void {
  setMood(agent, mood, durationSec);
}
