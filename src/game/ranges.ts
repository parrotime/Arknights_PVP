import type { AttackRangeId } from "./types";

export interface RangeCell {
  x: number;
  y: number;
}

export const operatorCellByRange: Record<AttackRangeId, RangeCell> = {
  amiyaDefault: { x: 0, y: 0 },
  amiyaChimera: { x: 0, y: 0 },
  chenDefault: { x: 0, y: 0 },
  chenSkill2: { x: 0, y: 0 },
  chenSkill3: { x: 0, y: 0 },
  exusiaiDefault: { x: 0, y: 0 },
  forwardShort: { x: 0, y: 0 },
  forwardWide: { x: 0, y: 0 },
};

export const attackCellsByRange: Record<AttackRangeId, RangeCell[]> = {
  amiyaDefault: [
    { x: 0, y: -1 },
    { x: 1, y: -1 },
    { x: 2, y: -1 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
    { x: 3, y: 0 },
    { x: 0, y: 1 },
    { x: 1, y: 1 },
    { x: 2, y: 1 },
  ],
  amiyaChimera: [
    { x: 0, y: -2 },
    { x: 1, y: -2 },
    { x: 2, y: -2 },
    { x: 0, y: -1 },
    { x: 1, y: -1 },
    { x: 2, y: -1 },
    { x: 3, y: -1 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
    { x: 3, y: 0 },
    { x: 4, y: 0 },
    { x: 0, y: 1 },
    { x: 1, y: 1 },
    { x: 2, y: 1 },
    { x: 3, y: 1 },
    { x: 0, y: 2 },
    { x: 1, y: 2 },
    { x: 2, y: 2 },
  ],
  chenDefault: [{ x: 1, y: 0 }],
  chenSkill2: [
    { x: 0, y: -1 },
    { x: 1, y: -1 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
    { x: 3, y: 0 },
    { x: 4, y: 0 },
    { x: 0, y: 1 },
    { x: 1, y: 1 },
  ],
  chenSkill3: [
    { x: 0, y: -2 },
    { x: -1, y: -1 },
    { x: 0, y: -1 },
    { x: -2, y: 0 },
    { x: -1, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
    { x: -1, y: 1 },
    { x: 0, y: 1 },
    { x: 0, y: 2 },
  ],
  exusiaiDefault: [
    { x: 1, y: -1 },
    { x: 2, y: -1 },
    { x: 3, y: -1 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
    { x: 3, y: 0 },
    { x: 1, y: 1 },
    { x: 2, y: 1 },
    { x: 3, y: 1 },
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

export const displayCellsByRange: Record<AttackRangeId, RangeCell[]> = {
  amiyaDefault: [
    ...attackCellsByRange.amiyaDefault,
    operatorCellByRange.amiyaDefault,
  ],
  amiyaChimera: [
    ...attackCellsByRange.amiyaChimera,
    operatorCellByRange.amiyaChimera,
  ],
  chenDefault: [
    ...attackCellsByRange.chenDefault,
    operatorCellByRange.chenDefault,
  ],
  chenSkill2: [
    ...attackCellsByRange.chenSkill2,
    operatorCellByRange.chenSkill2,
  ],
  chenSkill3: [
    ...attackCellsByRange.chenSkill3,
    operatorCellByRange.chenSkill3,
  ],
  exusiaiDefault: [
    ...attackCellsByRange.exusiaiDefault,
    operatorCellByRange.exusiaiDefault,
  ],
  forwardShort: [
    ...attackCellsByRange.forwardShort,
    operatorCellByRange.forwardShort,
  ],
  forwardWide: [
    ...attackCellsByRange.forwardWide,
    operatorCellByRange.forwardWide,
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
  const tileSize = attacker.rangeTileSize;
  const half = tileSize / 2;

  for (const cell of attackCellsByRange[attacker.attackRangeId]) {
    const center = getRangeCellCenter(
      attacker.x,
      attacker.y,
      attacker.facingAngle,
      attacker.attackRangeId,
      cell,
      tileSize,
    );
    const distanceX = Math.abs(target.x - center.x);
    const distanceY = Math.abs(target.y - center.y);

    if (distanceX <= half + target.radius && distanceY <= half + target.radius) {
      return true;
    }
  }

  return false;
}

export function getRangeCellCenter(
  originX: number,
  originY: number,
  facingAngle: number,
  rangeId: AttackRangeId,
  cell: RangeCell,
  tileSize: number,
) {
  const operatorCell = operatorCellByRange[rangeId];
  const localX = (cell.x - operatorCell.x) * tileSize;
  const localY = (cell.y - operatorCell.y) * tileSize;
  const cos = Math.cos(facingAngle);
  const sin = Math.sin(facingAngle);

  return {
    x: originX + localX * cos - localY * sin,
    y: originY + localX * sin + localY * cos,
  };
}
