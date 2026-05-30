import type { Body } from "matter-js";

export type OperatorRole =
  | "guard"
  | "defender"
  | "caster"
  | "sniper"
  | "medic"
  | "specialist";

export type DamageType = "physical" | "arts" | "true";

export type BuffType = "speed" | "damageReduction" | "attack";

export interface Buff {
  type: BuffType;
  value: number;
  duration: number;
}

export interface OperatorDefinition {
  id: string;
  name: string;
  role: OperatorRole;
  maxHp: number;
  attack: number;
  defense: number;
  radius: number;
  speed: number;
  spRegen: number;
  skillId: string;
}

export interface SkillContext {
  self: OperatorRuntimeLike;
  enemy: OperatorRuntimeLike;
  log: (message: string) => void;
}

export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  maxSp: number;
  activate: (ctx: SkillContext) => void;
}

export interface OperatorRuntimeLike {
  definition: OperatorDefinition;
  body: Body;
  currentHp: number;
  currentSp: number;
  isAlive: boolean;
  attack: number;
  defense: number;
  speed: number;
  addBuff: (buff: Buff) => void;
  takeDamage: (amount: number, type: DamageType) => number;
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
