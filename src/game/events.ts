import { AgentCharacter, GameEvent } from './types';
import { findPath } from './pathfinding';
import { OFFICE_LOCATIONS } from './officeMap';

function clampNeed(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

interface EventEffect {
  eventId: string;
  emoji: string;
  apply: (agents: AgentCharacter[]) => void;
}

const EVENT_POOL: EventEffect[] = [
  {
    eventId: 'coffee_breakdown',
    emoji: '⚠️',
    apply(agents) {
      for (const agent of agents) {
        agent.needs.caffeine = clampNeed(agent.needs.caffeine - 25);
        agent.emojiBubble = '😰';
        agent.emojiTimer = 4;
      }
    }
  },
  {
    eventId: 'bug_outbreak',
    emoji: '🐛',
    apply(agents) {
      const affected = agents.filter(a => a.role === 'RD' || a.role === 'QA');
      if (affected.length === 0) {
        const fallback = agents.slice(0, Math.min(2, agents.length));
        for (const agent of fallback) {
          agent.needs.energy = clampNeed(agent.needs.energy - 20);
          agent.stats.stress = clampNeed(agent.stats.stress + 25);
          agent.emojiBubble = '🐛';
          agent.emojiTimer = 4;
        }
        return;
      }
      for (const agent of affected) {
        agent.needs.energy = clampNeed(agent.needs.energy - 20);
        agent.stats.stress = clampNeed(agent.stats.stress + 25);
        agent.emojiBubble = '🐛';
        agent.emojiTimer = 4;
        agent.eventMoveTarget = 'desk';
        agent.eventMoveStatus = 'working';
      }
      const pm = agents.find(a => a.role === 'PM');
      if (pm && pm.path.length === 0) {
        const rd = affected.find(a => a.role === 'RD');
        if (rd) {
          pm.eventMoveTarget = rd.gridPos;
          pm.eventMoveStatus = 'walking';
        }
      }
    }
  },
  {
    eventId: 'afternoon_slump',
    emoji: '💤',
    apply(agents) {
      for (const agent of agents) {
        agent.needs.energy = clampNeed(agent.needs.energy - 20);
        agent.needs.caffeine = clampNeed(agent.needs.caffeine - 10);
        agent.emojiBubble = '💤';
        agent.emojiTimer = 3;
      }
    }
  },
  {
    eventId: 'boss_treats',
    emoji: '🍕',
    apply(agents) {
      for (const agent of agents) {
        agent.needs.social = clampNeed(agent.needs.social + 35);
        agent.needs.energy = clampNeed(agent.needs.energy + 20);
        agent.stats.stress = clampNeed(agent.stats.stress - 20);
        agent.emojiBubble = '🎉';
        agent.emojiTimer = 3;
        agent.eventMoveTarget = 'sofa';
        agent.eventMoveStatus = 'resting';
      }
    }
  },
  {
    eventId: 'pm_pressure',
    emoji: '😤',
    apply(agents) {
      const pm = agents.find(a => a.role === 'PM');
      const rds = agents.filter(a => a.role === 'RD');
      if (pm) {
        pm.emojiBubble = '😤';
        pm.emojiTimer = 5;
        if (rds.length > 0 && pm.path.length === 0) {
          const target = rds[Math.floor(Math.random() * rds.length)];
          pm.eventMoveTarget = target.gridPos;
          pm.eventMoveStatus = 'walking';
        }
      }
      for (const rd of rds) {
        rd.needs.energy = clampNeed(rd.needs.energy - 15);
        rd.stats.stress = clampNeed(rd.stats.stress + 20);
        rd.emojiBubble = '😰';
        rd.emojiTimer = 4;
      }
      if (pm && rds.length === 0 && agents.length > 1) {
        const others = agents.filter(a => a.id !== pm.id);
        for (const other of others.slice(0, 2)) {
          other.needs.energy = clampNeed(other.needs.energy - 15);
          other.stats.stress = clampNeed(other.stats.stress + 20);
          other.emojiBubble = '😰';
          other.emojiTimer = 4;
        }
      }
    }
  },
  {
    eventId: 'release_success',
    emoji: '🎉',
    apply(agents) {
      for (const agent of agents) {
        agent.needs.social = clampNeed(agent.needs.social + 30);
        agent.stats.stress = clampNeed(agent.stats.stress - 25);
        agent.stats.workProgress = clampNeed(agent.stats.workProgress + 15);
        agent.emojiBubble = '🎉';
        agent.emojiTimer = 4;
      }
    }
  },
  {
    eventId: 'intern_spills_coffee',
    emoji: '💦',
    apply(agents) {
      const intern = agents.find(a => a.role === 'INTERN');
      if (intern) {
        intern.emojiBubble = '😱';
        intern.emojiTimer = 5;
        intern.stats.stress = clampNeed(intern.stats.stress + 15);
        if (intern.path.length === 0) {
          intern.eventMoveTarget = OFFICE_LOCATIONS.coffeeMachine;
          intern.eventMoveStatus = 'coffee';
        }
      }
      const nearby = agents.slice(0, Math.min(3, agents.length));
      for (const agent of nearby) {
        if (agent.role !== 'INTERN') {
          agent.emojiBubble = '😅';
          agent.emojiTimer = 3;
        }
      }
    }
  },
  {
    eventId: 'fire_drill',
    emoji: '🚨',
    apply(agents) {
      for (const agent of agents) {
        agent.needs.energy = clampNeed(agent.needs.energy + 10);
        agent.needs.social = clampNeed(agent.needs.social + 15);
        agent.stats.stress = clampNeed(agent.stats.stress + 15);
        agent.emojiBubble = '🚨';
        agent.emojiTimer = 5;
        agent.eventMoveTarget = 'center';
        agent.eventMoveStatus = 'walking';
      }
    }
  }
];

export function getAllEvents(): GameEvent[] {
  return EVENT_POOL.map(e => ({
    id: e.eventId,
    name: e.eventId,
    description: e.eventId,
    emoji: e.emoji
  }));
}

export function triggerRandomEvent(agents: AgentCharacter[]): EventEffect | null {
  if (agents.length === 0) return null;

  const weights: number[] = EVENT_POOL.map((_, i) => {
    if (EVENT_POOL[i].eventId === 'boss_treats' || EVENT_POOL[i].eventId === 'fire_drill') return 1;
    return 3;
  });

  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  let roll = Math.random() * totalWeight;

  for (let i = 0; i < EVENT_POOL.length; i++) {
    roll -= weights[i];
    if (roll <= 0) {
      const event = EVENT_POOL[i];
      event.apply(agents);
      return event;
    }
  }

  return EVENT_POOL[0];
}

export { EVENT_POOL };
export type { EventEffect };
