import { Position, TileInfo } from './types';
import { isTileWalkable, MAP_WIDTH, MAP_HEIGHT } from './officeMap';

interface PathNode {
  x: number;
  y: number;
  g: number;
  h: number;
  f: number;
  parent: PathNode | null;
}

/**
 * A* 尋路算法
 */
export function findPath(
  map: TileInfo[][],
  start: Position,
  target: Position
): Position[] {
  // 如果起點與終點相同，回傳空路徑
  if (start.x === target.x && start.y === target.y) return [];

  // 如果終點本身不可行走（例如點到了桌子），尋找終點周圍可行的鄰居
  let destination = target;
  if (!isTileWalkable(map, target)) {
    const neighbors = getNeighbors(target);
    const validNeighbor = neighbors.find(n => isTileWalkable(map, n));
    if (validNeighbor) {
      destination = validNeighbor;
    } else {
      return [];
    }
  }

  const openList: PathNode[] = [];
  const closedSet: Set<string> = new Set();

  const startNode: PathNode = {
    x: start.x,
    y: start.y,
    g: 0,
    h: manhattanDistance(start, destination),
    f: manhattanDistance(start, destination),
    parent: null
  };

  openList.push(startNode);

  while (openList.length > 0) {
    // 取得 f 值最小的節點
    openList.sort((a, b) => a.f - b.f);
    const current = openList.shift()!;

    const key = `${current.x},${current.y}`;
    if (closedSet.has(key)) continue;
    closedSet.add(key);

    // 達到目的地
    if (current.x === destination.x && current.y === destination.y) {
      const path: Position[] = [];
      let curr: PathNode | null = current;
      while (curr) {
        path.unshift({ x: curr.x, y: curr.y });
        curr = curr.parent;
      }
      return path.slice(1); // 排除起始點本身
    }

    const neighbors = getNeighbors({ x: current.x, y: current.y });
    for (const neighbor of neighbors) {
      if (!isTileWalkable(map, neighbor)) continue;
      const nKey = `${neighbor.x},${neighbor.y}`;
      if (closedSet.has(nKey)) continue;

      const gScore = current.g + 1;
      let existingNode = openList.find(n => n.x === neighbor.x && n.y === neighbor.y);

      if (!existingNode) {
        const hScore = manhattanDistance(neighbor, destination);
        existingNode = {
          x: neighbor.x,
          y: neighbor.y,
          g: gScore,
          h: hScore,
          f: gScore + hScore,
          parent: current
        };
        openList.push(existingNode);
      } else if (gScore < existingNode.g) {
        existingNode.g = gScore;
        existingNode.f = gScore + existingNode.h;
        existingNode.parent = current;
      }
    }
  }

  return []; // 無法到達
}

function manhattanDistance(a: Position, b: Position): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function getNeighbors(pos: Position): Position[] {
  return [
    { x: pos.x, y: pos.y - 1 }, // 上
    { x: pos.x, y: pos.y + 1 }, // 下
    { x: pos.x - 1, y: pos.y }, // 左
    { x: pos.x + 1, y: pos.y }  // 右
  ];
}
