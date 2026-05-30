import type { AttackRangeId } from "./types";

export interface RangeCell {
  x: number;
  y: number;
}

export const attackRanges: Record<AttackRangeId, RangeCell[]> = {
  amiyaDefault: [
    { x: 1, y: -1 },
    { x: 2, y: -1 },
    { x: 3, y: -1 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
    { x: 3, y: 0 },
    { x: 4, y: 0 },
    { x: 1, y: 1 },
    { x: 2, y: 1 },
    { x: 3, y: 1 },
  ],
  amiyaChimera: [
    { x: 1, y: -2 },
    { x: 2, y: -2 },
    { x: 3, y: -2 },
    { x: 1, y: -1 },
    { x: 2, y: -1 },
    { x: 3, y: -1 },
    { x: 4, y: -1 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
    { x: 3, y: 0 },
    { x: 4, y: 0 },
    { x: 1, y: 1 },
    { x: 2, y: 1 },
    { x: 3, y: 1 },
    { x: 4, y: 1 },
    { x: 1, y: 2 },
    { x: 2, y: 2 },
    { x: 3, y: 2 },
  ],
  forwardShort: [
    { x: 1, y: -1 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
  ],
  forwardWide: [
    { x: 1, y: -1 },
    { x: 2, y: -1 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
    { x: 1, y: 1 },
    { x: 2, y: 1 },
  ],
};

export function isPointInAttackRange(
  attacker: {
    x: number;
    y: number;
    facingAngle: number;
    attackRangeId: AttackRangeId;
    rangeTileSize: number;
  },
  target: { x: number; y: number; radius: number },
) {
  const cells = attackRanges[attacker.attackRangeId];
  const cos = Math.cos(attacker.facingAngle);
  const sin = Math.sin(attacker.facingAngle);
  const tileSize = attacker.rangeTileSize;

  for (const cell of cells) {
    const localX = (cell.x + 0.5) * tileSize;
    const localY = (cell.y + 0.5) * tileSize;
    const centerX = attacker.x + localX * cos - localY * sin;
    const centerY = attacker.y + localX * sin + localY * cos;
    const half = tileSize / 2;
    const distanceX = Math.abs(target.x - centerX);
    const distanceY = Math.abs(target.y - centerY);

    if (distanceX <= half + target.radius && distanceY <= half + target.radius) {
      return true;
    }
  }

  return false;
}
