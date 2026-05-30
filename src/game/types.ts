import type { Body } from "matter-js";

export type OperatorRole =
  | "guard"
  | "defender"
  | "caster"
  | "sniper"
  | "medic"
  | "specialist";

export type DamageType = "physical" | "arts" | "true";

export type AttackRangeId =
  | "amiyaDefault"
  | "amiyaChimera"
  | "forwardShort"
  | "forwardWide";

export type BuffType =
  | "speed"
  | "damageReduction"
  | "attack"
  | "attackInterval"
  | "maxHp"
  | "rangeOverride"
  | "damageTypeOverride"
  | "stun"
  | "multiHit";

export interface Buff {
  type: BuffType;
  value: number;
  duration: number;
  rangeId?: AttackRangeId;
  damageType?: DamageType;
  hits?: number;
  stunAfterExpire?: number;
}

export interface OperatorDefinition {
  id: string;
  name: string;
  role: OperatorRole;
  maxHp: number;
  attack: number;
  defense: number;
  resistance: number;
  damageType: DamageType;
  attackInterval: number;
  attackRangeId: AttackRangeId;
  rangeTileSize: number;
  radius: number;
  speed: number;
  spRegen: number;
  skillId: string;
}

export interface SkillContext {
  self: OperatorRuntimeLike;
  enemy: OperatorRuntimeLike;
  log: (message: string) => void;
  dealDamage: (
    attacker: OperatorRuntimeLike,
    defender: OperatorRuntimeLike,
    rawAmount: number,
    type: DamageType,
  ) => number;
}

export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  initialSp: number;
  maxSp: number;
  duration?: number;
  activate: (ctx: SkillContext) => void;
}

export interface OperatorRuntimeLike {
  definition: OperatorDefinition;
  body: Body;
  currentHp: number;
  currentSp: number;
  isAlive: boolean;
  maxHp: number;
  attack: number;
  defense: number;
  resistance: number;
  speed: number;
  damageType: DamageType;
  attackInterval: number;
  attackRangeId: AttackRangeId;
  rangeTileSize: number;
  isStunned: boolean;
  multiHit: { hits: number; multiplier: number } | null;
  addBuff: (buff: Buff) => void;
  gainSp: (amount: number) => void;
  spendSp: (amount: number) => void;
  takeDamage: (amount: number, type: DamageType) => number;
  takeAttack: (amount: number, type: DamageType) => number;
  heal: (amount: number) => number;
}

export interface OperatorSnapshot {
  id: string;
  name: string;
  role: OperatorRole;
  hp: number;
  maxHp: number;
  sp: number;
  maxSp: number;
  skillName: string;
  skillDescription: string;
  x: number;
  y: number;
  radius: number;
  color: string;
  isAlive: boolean;
  hasShield: boolean;
  isStunned: boolean;
  facingAngle: number;
  attackRangeId: AttackRangeId;
  rangeTileSize: number;
}

export interface BattleSnapshot {
  left: OperatorSnapshot;
  right: OperatorSnapshot;
  elapsed: number;
  running: boolean;
  winnerName: string | null;
}

export interface BattleUi {
  canvas: HTMLCanvasElement;
  leftSelect: HTMLSelectElement;
  rightSelect: HTMLSelectElement;
  startButton: HTMLButtonElement;
  pauseButton: HTMLButtonElement;
  restartButton: HTMLButtonElement;
  speedButtons: HTMLButtonElement[];
  resultBanner: HTMLDivElement;
  updateStatus: (snapshot: BattleSnapshot) => void;
  setOperatorOptions: (
    operators: OperatorDefinition[],
    leftId: string,
    rightId: string,
  ) => void;
  addLog: (message: string) => void;
  clearLog: () => void;
}
