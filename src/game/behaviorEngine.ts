import { AgentCharacter, AgentNeeds, AgentStatus, Position } from './types';
import { OFFICE_LOCATIONS } from './officeMap';

const BASE_ENERGY_DECAY = 1.5;
const BASE_CAFFEINE_DECAY = 1.0;
const BASE_SOCIAL_DECAY = 0.8;

const NEED_THRESHOLD_BASE = 38;

const ENERGY_RECOVERY = 55;
const CAFFEINE_RECOVERY = 65;
const SOCIAL_RECOVERY_CHAT = 45;
const SOCIAL_RECOVERY_WATER = 25;
const STRESS_REDUCTION_REST = 30;

const COFFEE_DURATION_MS = 3500;
const REST_DURATION_MS = 5000;
const CHAT_DURATION_MS = 4000;
const WATER_COOLER_DURATION_MS = 2500;

function hashAgentId(id: string, seed: number): number {
  let hash = seed;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash) + id.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function agentDecayFactor(id: string): number {
  return 0.82 + (hashAgentId(id, 7) % 37) / 100;
}

function agentThreshold(id: string): number {
  return NEED_THRESHOLD_BASE - 7 + (hashAgentId(id, 13) % 15);
}

function agentHesitation(id: string): number {
  return (hashAgentId(id, 3) % 100) / 100;
}

export interface BehaviorDecision {
  action: 'move' | 'stay';
  targetPos?: Position;
  status: AgentStatus;
  activityDuration?: number;
  emojiBubble?: string;
  actionTargetId?: string;
}

function clampNeed(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function decayNeeds(agent: AgentCharacter, deltaSeconds: number): void {
  const factor = agentDecayFactor(agent.id);
  agent.needs.energy = clampNeed(agent.needs.energy - BASE_ENERGY_DECAY * factor * deltaSeconds);
  agent.needs.caffeine = clampNeed(agent.needs.caffeine - BASE_CAFFEINE_DECAY * factor * deltaSeconds);
  agent.needs.social = clampNeed(agent.needs.social - BASE_SOCIAL_DECAY * factor * deltaSeconds);

  agent.stats.stress = clampNeed(100 - (agent.needs.energy + agent.needs.social) / 2);
  agent.stats.coffeeLevel = agent.needs.caffeine;
}

function applyActivityCompletion(agent: AgentCharacter, allAgents: AgentCharacter[]): void {
  const tileInteractable = getTileInteractable(agent.gridPos);

  if (agent.status === 'coffee' || tileInteractable === 'coffee') {
    agent.needs.caffeine = clampNeed(agent.needs.caffeine + CAFFEINE_RECOVERY);
    agent.stats.coffeeLevel = agent.needs.caffeine;
    agent.emojiBubble = '☕';
    agent.emojiTimer = 2;
  } else if (agent.status === 'resting' || tileInteractable === 'rest') {
    agent.needs.energy = clampNeed(agent.needs.energy + ENERGY_RECOVERY);
    agent.stats.stress = clampNeed(agent.stats.stress - STRESS_REDUCTION_REST);
    agent.emojiBubble = '😊';
    agent.emojiTimer = 2;
  } else if (agent.status === 'talking') {
    agent.needs.social = clampNeed(agent.needs.social + SOCIAL_RECOVERY_CHAT);
    if (agent.actionTargetId) {
      const partner = allAgents.find(a => a.id === agent.actionTargetId);
      if (partner && partner.path.length === 0) {
        partner.needs.social = clampNeed(partner.needs.social + SOCIAL_RECOVERY_CHAT * 0.8);
        partner.stats.stress = clampNeed(partner.stats.stress - 10);
        partner.emojiBubble = '😊';
        partner.emojiTimer = 2;
      }
    }
  } else if (isNearWaterCooler(agent.gridPos)) {
    agent.needs.social = clampNeed(agent.needs.social + SOCIAL_RECOVERY_WATER);
    agent.needs.caffeine = clampNeed(0); // water, not coffee
  }

  agent.activityStartTime = 0;
  agent.activityDuration = 0;
  agent.actionTargetId = null;
}

function getTileInteractable(pos: Position): string | undefined {
  if (pos.x === OFFICE_LOCATIONS.coffeeMachine.x && pos.y === OFFICE_LOCATIONS.coffeeMachine.y) {
    return 'coffee';
  }
  for (const s of OFFICE_LOCATIONS.sofaArea) {
    if (pos.x === s.x && pos.y === s.y) return 'rest';
  }
  return undefined;
}

function isNearWaterCooler(pos: Position): boolean {
  const wc = OFFICE_LOCATIONS.waterCooler;
  return Math.abs(pos.x - wc.x) + Math.abs(pos.y - wc.y) <= 1;
}

function isAtDesk(agent: AgentCharacter): boolean {
  return agent.gridPos.x === agent.deskPos.x && agent.gridPos.y === agent.deskPos.y;
}

function findNearbyColleague(agent: AgentCharacter, allAgents: AgentCharacter[]): AgentCharacter | null {
  const others = allAgents.filter(a => a.id !== agent.id && a.path.length === 0);

  if (others.length === 0) return null;

  let closest: AgentCharacter | null = null;
  let closestDist = Infinity;

  for (const other of others) {
    const dist = Math.abs(agent.gridPos.x - other.gridPos.x) + Math.abs(agent.gridPos.y - other.gridPos.y);
    if (dist < closestDist) {
      closestDist = dist;
      closest = other;
    }
  }

  return closest;
}

function isHeadingToPos(pos: Position, agents: AgentCharacter[], excludeId: string): boolean {
  return agents.some(a => {
    if (a.id === excludeId) return false;
    if (a.path.length > 0) {
      const dest = a.path[a.path.length - 1];
      return dest.x === pos.x && dest.y === pos.y;
    }
    return a.gridPos.x === pos.x && a.gridPos.y === pos.y;
  });
}

function getAdjacentPosition(a: Position, b: Position): Position {
  const dx = b.x - a.x;
  const dy = b.y - a.y;

  const candidates: Position[] = [];

  if (Math.abs(dx) >= Math.abs(dy)) {
    candidates.push({ x: b.x + (dx > 0 ? -1 : 1), y: b.y });
  } else {
    candidates.push({ x: b.x, y: b.y + (dy > 0 ? -1 : 1) });
  }

  candidates.push(
    { x: b.x + 1, y: b.y },
    { x: b.x - 1, y: b.y },
    { x: b.x, y: b.y + 1 },
    { x: b.x, y: b.y - 1 }
  );

  const unique = candidates.filter((c, i, arr) =>
    arr.findIndex(t => t.x === c.x && t.y === c.y) === i
  );

  return unique[0] || { x: b.x + 1, y: b.y };
}

function decideNextAction(agent: AgentCharacter, allAgents: AgentCharacter[]): BehaviorDecision {
  const { energy, caffeine, social } = agent.needs;
  const threshold = agentThreshold(agent.id);

  const needsList: { need: string; value: number }[] = [
    { need: 'energy', value: energy },
    { need: 'caffeine', value: caffeine },
    { need: 'social', value: social }
  ];

  const urgentNeeds = needsList
    .filter(n => n.value < threshold)
    .sort((a, b) => a.value - b.value);

  // 隨機猶豫：有時即使需求低也多待一個 tick，避免所有人同時動作
  if (urgentNeeds.length > 0 && Math.random() < agentHesitation(agent.id)) {
    return { action: 'stay', status: agent.status === 'idle' ? 'working' : agent.status };
  }

  if (urgentNeeds.length > 0) {
    const mostUrgent = urgentNeeds[0].need;

    switch (mostUrgent) {
      case 'energy': {
        const availableSpots = OFFICE_LOCATIONS.sofaArea.filter(
          s => !isHeadingToPos(s, allAgents, agent.id)
        );
        if (availableSpots.length === 0) {
          return { action: 'stay', status: 'working' };
        }
        const spot = availableSpots[Math.floor(Math.random() * availableSpots.length)];
        return {
          action: 'move',
          targetPos: spot,
          status: 'resting',
          activityDuration: REST_DURATION_MS,
          emojiBubble: '💤'
        };
      }
      case 'caffeine': {
        if (isHeadingToPos(OFFICE_LOCATIONS.coffeeMachine, allAgents, agent.id)) {
          // 咖啡機被佔用，退而求其次：喝水或忍耐
          if (!isHeadingToPos(OFFICE_LOCATIONS.waterCooler, allAgents, agent.id)) {
            return {
              action: 'move',
              targetPos: OFFICE_LOCATIONS.waterCooler,
              status: 'walking',
              activityDuration: 2000,
              emojiBubble: '💧'
            };
          }
          return { action: 'stay', status: 'working' };
        }
        return {
          action: 'move',
          targetPos: OFFICE_LOCATIONS.coffeeMachine,
          status: 'coffee',
          activityDuration: COFFEE_DURATION_MS,
          emojiBubble: '☕'
        };
      }
      case 'social': {
        const colleague = findNearbyColleague(agent, allAgents);
        if (colleague) {
          const adjacentPos = getAdjacentPosition(agent.gridPos, colleague.gridPos);
          return {
            action: 'move',
            targetPos: adjacentPos,
            status: 'talking',
            activityDuration: CHAT_DURATION_MS,
            emojiBubble: '💬',
            actionTargetId: colleague.id
          };
        }
        if (!isHeadingToPos(OFFICE_LOCATIONS.waterCooler, allAgents, agent.id)) {
          return {
            action: 'move',
            targetPos: OFFICE_LOCATIONS.waterCooler,
            status: 'walking',
            activityDuration: WATER_COOLER_DURATION_MS,
            emojiBubble: '💧'
          };
        }
        return { action: 'stay', status: 'working' };
      }
    }
  }

  if (isAtDesk(agent)) {
    const workProgressDelta = Math.floor(Math.random() * 5) + 2;
    agent.stats.workProgress = clampNeed(agent.stats.workProgress + workProgressDelta);
    return {
      action: 'stay',
      status: 'working'
    };
  }

  if (Math.random() < 0.06) {
    return {
      action: 'move',
      targetPos: OFFICE_LOCATIONS.waterCooler,
      status: 'walking',
      activityDuration: 1500,
      emojiBubble: '💧'
    };
  }

  return { action: 'move', targetPos: agent.deskPos, status: 'working' };
}

export function tickBehavior(
  agent: AgentCharacter,
  allAgents: AgentCharacter[],
  deltaSeconds: number
): BehaviorDecision | null {
  if (agent.path.length > 0) return null;

  decayNeeds(agent, deltaSeconds);

  if (agent.activityDuration > 0 && agent.activityStartTime > 0) {
    const elapsed = Date.now() - agent.activityStartTime;
    if (elapsed < agent.activityDuration) return null;

    applyActivityCompletion(agent, allAgents);
  }

  return decideNextAction(agent, allAgents);
}

export function getCriticalNeedsEmoji(needs: AgentNeeds): string | null {
  if (needs.energy < 20) return '💤';
  if (needs.caffeine < 20) return '☕';
  if (needs.social < 20) return '🗣️';
  return null;
}
