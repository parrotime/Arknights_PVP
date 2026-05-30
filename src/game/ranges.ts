import type { AttackRangeId, FacingDirection } from "./types";

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
    facingDirection: FacingDirection;
    attackRangeId: AttackRangeId;
    rangeTileSize: number;
  },
  target: { x: number; y: number; radius: number },
) {
  const cells = attackRanges[attacker.attackRangeId];
  const tileSize = attacker.rangeTileSize;

  for (const cell of cells) {
    const oriented = orientCell(cell, attacker.facingDirection);
    const centerX = attacker.x + (oriented.x + 0.5) * tileSize;
    const centerY = attacker.y + (oriented.y + 0.5) * tileSize;
    const half = tileSize / 2;
    const distanceX = Math.abs(target.x - centerX);
    const distanceY = Math.abs(target.y - centerY);

    if (distanceX <= half + target.radius && distanceY <= half + target.radius) {
      return true;
    }
  }

  return false;
}

export function orientCell(cell: RangeCell, direction: FacingDirection) {
  if (direction === "right") {
    return cell;
  }

  if (direction === "down") {
    return { x: -cell.y - 1, y: cell.x };
  }

  if (direction === "left") {
    return { x: -cell.x - 1, y: -cell.y - 1 };
  }

  return { x: cell.y, y: -cell.x - 1 };
}
