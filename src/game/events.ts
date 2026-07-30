import { AgentCharacter, GameEvent } from './types';
import { triggerMood } from './mood';

function clampNeed(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

interface EventEffect {
  eventId: string;
  emoji: string;
  isChainable?: boolean;
  chainEventId?: string;
  apply: (agents: AgentCharacter[]) => void;
}

const EVENT_POOL: EventEffect[] = [
  {
    eventId: 'coffee_breakdown',
    emoji: '⚠️',
    isChainable: true,
    chainEventId: 'coffee_repair_attempt',
    apply(agents) {
      for (const agent of agents) {
        agent.needs.caffeine = clampNeed(agent.needs.caffeine - 25);
        agent.emojiBubble = '😰';
        agent.emojiTimer = 4;
        if (agent.personality.caffeineAddiction > 0.7) {
          triggerMood(agent, 'panicked', 6);
        }
      }
    }
  },
  {
    eventId: 'coffee_repair_attempt',
    emoji: '🔧',
    apply(agents) {
      const intern = agents.find(a => a.role === 'INTERN');
      if (intern) {
        intern.emojiBubble = '🔧';
        intern.emojiTimer = 5;
        intern.stats.stress = clampNeed(intern.stats.stress + 15);
        triggerMood(intern, 'nervous', 6);
        if (intern.path.length === 0) {
          intern.eventMoveTarget = { x: 2, y: 2 };
          intern.eventMoveStatus = 'working';
        }
      }
      for (const agent of agents) {
        if (agent.role !== 'INTERN') {
          agent.emojiBubble = '🤔';
          agent.emojiTimer = 3;
        }
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
          triggerMood(agent, 'stressed', 8);
        }
        return;
      }
      for (const agent of affected) {
        agent.needs.energy = clampNeed(agent.needs.energy - 20);
        agent.stats.stress = clampNeed(agent.stats.stress + 25);
        agent.emojiBubble = '🐛';
        agent.emojiTimer = 4;
        triggerMood(agent, 'stressed', 8);
        agent.eventMoveTarget = 'desk';
        agent.eventMoveStatus = 'working';
      }
      const pm = agents.find(a => a.role === 'PM');
      if (pm && pm.path.length === 0) {
        const rd = affected.find(a => a.role === 'RD');
        if (rd) {
          pm.eventMoveTarget = rd.gridPos;
          pm.eventMoveStatus = 'walking';
          triggerMood(pm, 'stressed', 6);
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
        triggerMood(agent, 'lazy', 6);
      }
    }
  },
  {
    eventId: 'boss_treats',
    emoji: '🍕',
    isChainable: true,
    chainEventId: 'team_bonding',
    apply(agents) {
      for (const agent of agents) {
        agent.needs.social = clampNeed(agent.needs.social + 35);
        agent.needs.energy = clampNeed(agent.needs.energy + 20);
        agent.stats.stress = clampNeed(agent.stats.stress - 20);
        agent.emojiBubble = '🎉';
        agent.emojiTimer = 3;
        triggerMood(agent, 'happy', 8);
        agent.eventMoveTarget = 'sofa';
        agent.eventMoveStatus = 'resting';
      }
    }
  },
  {
    eventId: 'team_bonding',
    emoji: '🤝',
    apply(agents) {
      for (const agent of agents) {
        agent.needs.social = clampNeed(agent.needs.social + 20);
        agent.stats.stress = clampNeed(agent.stats.stress - 10);
        agent.stats.workProgress = clampNeed(agent.stats.workProgress + 5);
        triggerMood(agent, 'happy', 6);
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
        triggerMood(pm, 'stressed', 6);
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
        triggerMood(rd, 'stressed', 6);
      }
      if (pm && rds.length === 0 && agents.length > 1) {
        const others = agents.filter(a => a.id !== pm.id);
        for (const other of others.slice(0, 2)) {
          other.needs.energy = clampNeed(other.needs.energy - 15);
          other.stats.stress = clampNeed(other.stats.stress + 20);
          other.emojiBubble = '😰';
          other.emojiTimer = 4;
          triggerMood(other, 'stressed', 5);
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
        triggerMood(agent, agent.personality.humorLevel > 0.6 ? 'excited' : 'proud', 7);
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
        triggerMood(intern, 'panicked', 6);
        if (intern.path.length === 0) {
          intern.eventMoveTarget = { x: 2, y: 2 };
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
        triggerMood(agent, 'panicked', 5);
        agent.eventMoveTarget = 'center';
        agent.eventMoveStatus = 'walking';
      }
    }
  },
  {
    eventId: 'printer_jam',
    emoji: '🖨️',
    apply(agents) {
      const ad = agents.find(a => a.role === 'AD');
      if (ad) {
        ad.emojiBubble = '🤬';
        ad.emojiTimer = 5;
        ad.stats.stress = clampNeed(ad.stats.stress + 20);
        triggerMood(ad, 'stressed', 6);
      }
      const intern = agents.find(a => a.role === 'INTERN');
      if (intern && intern.path.length === 0) {
        intern.emojiBubble = '🔧';
        intern.emojiTimer = 4;
        triggerMood(intern, 'nervous', 5);
        const printerPos = { x: 5, y: 2 };
        intern.eventMoveTarget = printerPos;
        intern.eventMoveStatus = 'working';
      }
      for (const agent of agents) {
        if (agent.role !== 'AD' && agent.role !== 'INTERN' && Math.random() < 0.4) {
          agent.emojiBubble = '😅';
          agent.emojiTimer = 2;
        }
      }
    }
  },
  {
    eventId: 'birthday_party',
    emoji: '🎂',
    isChainable: true,
    chainEventId: 'team_bonding',
    apply(agents) {
      const celebrant = agents[Math.floor(Math.random() * agents.length)];
      celebrant.emojiBubble = '🥳';
      celebrant.emojiTimer = 8;
      triggerMood(celebrant, 'excited', 10);
      for (const agent of agents) {
        if (agent.id !== celebrant.id) {
          agent.needs.social = clampNeed(agent.needs.social + 25);
          agent.needs.energy = clampNeed(agent.needs.energy + 10);
          agent.stats.stress = clampNeed(agent.stats.stress - 15);
          triggerMood(agent, 'happy', 6);
          agent.emojiBubble = '🎉';
          agent.emojiTimer = 3;
        }
      }
    }
  },
  {
    eventId: 'client_visit',
    emoji: '👔',
    apply(agents) {
      for (const agent of agents) {
        agent.stats.stress = clampNeed(agent.stats.stress + 15);
        agent.emojiBubble = '😬';
        agent.emojiTimer = 4;
        agent.eventMoveTarget = 'desk';
        agent.eventMoveStatus = 'working';
        triggerMood(agent, 'nervous', 5);
      }
      const boss = agents.find(a => a.role === 'BOSS');
      if (boss) {
        triggerMood(boss, 'excited', 6);
        boss.emojiBubble = '💼';
        boss.emojiTimer = 5;
      }
    }
  },
  {
    eventId: 'team_lunch',
    emoji: '🍱',
    apply(agents) {
      for (const agent of agents) {
        agent.needs.energy = clampNeed(agent.needs.energy + 30);
        agent.needs.social = clampNeed(agent.needs.social + 30);
        agent.stats.stress = clampNeed(agent.stats.stress - 15);
        triggerMood(agent, 'happy', 7);
        agent.emojiBubble = '🍱';
        agent.emojiTimer = 4;
        if (agent.path.length === 0) {
          agent.eventMoveTarget = 'sofa';
          agent.eventMoveStatus = 'resting';
        }
      }
    }
  },
  {
    eventId: 'ac_broken',
    emoji: '🥵',
    apply(agents) {
      for (const agent of agents) {
        agent.needs.energy = clampNeed(agent.needs.energy - 15);
        agent.stats.stress = clampNeed(agent.stats.stress + 15);
        agent.emojiBubble = '🥵';
        agent.emojiTimer = 5;
        triggerMood(agent, agent.personality.stressTolerance < 0.4 ? 'panicked' : 'stressed', 6);
      }
    }
  },
  {
    eventId: 'deadline_extended',
    emoji: '🙏',
    apply(agents) {
      for (const agent of agents) {
        agent.stats.stress = clampNeed(agent.stats.stress - 30);
        agent.needs.social = clampNeed(agent.needs.social + 10);
        triggerMood(agent, 'happy', 5);
        agent.emojiBubble = '😌';
        agent.emojiTimer = 4;
      }
    }
  },
  {
    eventId: 'friday_vibes',
    emoji: '🎵',
    apply(agents) {
      for (const agent of agents) {
        agent.stats.stress = clampNeed(agent.stats.stress - 20);
        agent.needs.social = clampNeed(agent.needs.social + 15);
        agent.emojiBubble = agent.personality.humorLevel > 0.6 ? '🕺' : '😊';
        agent.emojiTimer = 4;
        triggerMood(agent, agent.personality.diligence < 0.5 ? 'lazy' : 'happy', 6);
      }
    }
  },
  {
    eventId: 'office_gossip',
    emoji: '🗣️',
    apply(agents) {
      const spreaders = agents
        .filter(a => a.personality.sociability > 0.5 || a.personality.expressiveness > 0.6)
        .slice(0, Math.min(3, agents.length));

      for (const agent of agents) {
        agent.needs.social = clampNeed(agent.needs.social + 10);
        agent.emojiBubble = spreaders.includes(agent) ? '🗣️' : '👀';
        agent.emojiTimer = 3;
      }
    }
  },
  {
    eventId: 'power_outage',
    emoji: '🔌',
    apply(agents) {
      for (const agent of agents) {
        agent.stats.stress = clampNeed(agent.stats.stress + 20);
        agent.emojiBubble = '😱';
        agent.emojiTimer = 4;
        triggerMood(agent, 'panicked', 5);
        if (agent.path.length === 0) {
          agent.eventMoveTarget = 'center';
          agent.eventMoveStatus = 'walking';
        }
      }
      const rds = agents.filter(a => a.role === 'RD');
      for (const rd of rds) {
        rd.stats.stress = clampNeed(rd.stats.stress + 10);
        rd.emojiBubble = '💀';
      }
    }
  },
];

let pendingChainEventId: string | null = null;

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

  if (pendingChainEventId) {
    const chainEvent = EVENT_POOL.find(e => e.eventId === pendingChainEventId);
    pendingChainEventId = null;
    if (chainEvent) {
      chainEvent.apply(agents);
      return chainEvent;
    }
  }

  const weights: number[] = EVENT_POOL.map((e) => {
    if (e.eventId.startsWith('coffee_repair') || e.eventId === 'team_bonding') return 0;
    if (e.eventId === 'boss_treats' || e.eventId === 'fire_drill' || e.eventId === 'birthday_party') return 1;
    if (e.eventId === 'team_lunch' || e.eventId === 'power_outage' || e.eventId === 'deadline_extended') return 1.5;
    return 3;
  });

  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  let roll = Math.random() * totalWeight;

  for (let i = 0; i < EVENT_POOL.length; i++) {
    roll -= weights[i];
    if (roll <= 0) {
      const event = EVENT_POOL[i];
      event.apply(agents);
      if (event.isChainable && event.chainEventId && Math.random() < 0.5) {
        pendingChainEventId = event.chainEventId;
      }
      return event;
    }
  }

  return EVENT_POOL[0];
}

export function clearPendingChain(): void {
  pendingChainEventId = null;
}

export { EVENT_POOL };
export type { EventEffect };
