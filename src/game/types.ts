import type { Body } from "matter-js";

export type OperatorRole =
  | "guard"
  | "defender"
  | "caster"
  | "sniper"
  | "medic"
  | "specialist";

export type DamageType = "physical" | "arts" | "true";
export type SpRecoveryType = "natural" | "attack";
export type AttackMode = "melee" | "ranged";

export type AttackRangeId =
  | "amiyaDefault"
  | "amiyaChimera"
  | "chenDefault"
  | "chenSkill2"
  | "chenSkill3"
  | "exusiaiDefault"
  | "hoshigumaDefault"
  | "sariaDefault"
  | "sariaSkill1"
  | "sariaSkill2"
  | "sariaSkill3"
  | "forwardShort"
  | "forwardWide";

export type BuffType =
  | "speed"
  | "damageReduction"
  | "attack"
  | "defense"
  | "attackSpeed"
  | "attackInterval"
  | "maxHp"
  | "rangeOverride"
  | "damageTypeOverride"
  | "artsFragile"
  | "stun"
  | "multiHit"
  | "invincible"
  | "stunImmune";

export interface Buff {
  type: BuffType;
  value: number;
  duration: number;
  rangeId?: AttackRangeId;
  damageType?: DamageType;
  hits?: number;
  consumeOnAttack?: boolean;
  stunAfterExpire?: number;
}

export interface OperatorDefinition {
  id: string;
  name: string;
  englishName?: string;
  role: OperatorRole;
  attackMode: AttackMode;
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
  spRecoveryType: SpRecoveryType;
  attackSpeedBonus?: number;
  attackMultiplier?: number;
  maxHpMultiplier?: number;
  defenseMultiplier?: number;
  physicalDodge?: number;
  damageBlockChance?: number;
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
  heal: (healer: OperatorRuntimeLike, target: OperatorRuntimeLike, amount: number) => number;
  isEnemyInRange: (rangeId?: AttackRangeId) => boolean;
  isSelfInRange: (rangeId?: AttackRangeId) => boolean;
  startRepeatedStrike: (strike: RepeatedStrikeDefinition) => void;
}

export interface RepeatedStrikeDefinition {
  rangeId: AttackRangeId;
  hits: number;
  interval: number;
  damageMultiplier: number;
  damageType: DamageType;
  finalStunDuration?: number;
  name: string;
}

export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  initialSp: number;
  maxSp: number;
  duration?: number;
  skillRangeId?: AttackRangeId;
  minimumRangeDisplayDuration?: number;
  spCost?: number;
  spRecoveryType?: SpRecoveryType;
  autoActivate?: boolean;
  passive?: boolean;
  canActivate?: (ctx: SkillContext) => boolean;
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
  physicalDodge: number;
  damageBlockChance: number;
  speed: number;
  damageType: DamageType;
  attackInterval: number;
  attackRangeId: AttackRangeId;
  displayRangeId: AttackRangeId;
  rangeTileSize: number;
  skill: SkillDefinition;
  isStunned: boolean;
  isSkillActive: boolean;
  artsFragileMultiplier: number;
  multiHit: { hits: number; multiplier: number; consumeOnAttack: boolean } | null;
  addBuff: (buff: Buff) => void;
  removeBuff: (type: BuffType) => void;
  showSkillRange: (rangeId: AttackRangeId, duration: number) => void;
  startSkillCooldown: (duration: number, spCost?: number) => void;
  gainSp: (amount: number) => void;
  spendSp: (amount: number) => void;
  takeDamage: (amount: number, type: DamageType) => number;
  takeAttack: (amount: number, type: DamageType) => number;
  heal: (amount: number) => number;
}

export interface OperatorSnapshot {
  id: string;
  name: string;
  englishName?: string;
  role: OperatorRole;
  attackMode: AttackMode;
  hp: number;
  maxHp: number;
  sp: number;
  maxSp: number;
  attack: number;
  defense: number;
  resistance: number;
  skillName: string;
  skillDescription: string;
  x: number;
  y: number;
  radius: number;
  color: string;
  isAlive: boolean;
  hasShield: boolean;
  isStunned: boolean;
  isSkillActive: boolean;
  facingAngle: number;
  attackRangeId: AttackRangeId;
  displayRangeId: AttackRangeId;
  rangeTileSize: number;
}

export interface BattleCastSnapshot {
  id: number;
  message: string;
  age: number;
  duration: number;
}

export interface FloatingDamageSnapshot {
  id: number;
  kind: "damage" | "sp";
  amount: number;
  x: number;
  y: number;
  age: number;
  duration: number;
}

export interface ProjectileSnapshot {
  id: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  age: number;
  duration: number;
  damageType: DamageType;
}

export interface BattleSnapshot {
  left: OperatorSnapshot;
  right: OperatorSnapshot;
  damageNumbers: FloatingDamageSnapshot[];
  projectiles: ProjectileSnapshot[];
  battleCast: BattleCastSnapshot[];
  elapsed: number;
  running: boolean;
  winnerName: string | null;
}

export interface BattleUi {
  canvas: HTMLCanvasElement;
  leftSelect: HTMLSelectElement;
  rightSelect: HTMLSelectElement;
  leftSkillSelect: HTMLSelectElement;
  rightSkillSelect: HTMLSelectElement;
  startButton: HTMLButtonElement;
  pauseButton: HTMLButtonElement;
  restartButton: HTMLButtonElement;
  speedButtons: HTMLButtonElement[];
  resultBanner: HTMLDivElement;
  timer: HTMLDivElement;
  battleCast: HTMLDivElement;
  updateStatus: (snapshot: BattleSnapshot) => void;
  setOperatorOptions: (
    operators: OperatorDefinition[],
    leftId: string,
    rightId: string,
  ) => void;
  setSkillOptions: (
    leftSkills: SkillDefinition[],
    rightSkills: SkillDefinition[],
    leftSkillId: string,
    rightSkillId: string,
  ) => void;
  addLog: (message: string) => void;
  clearLog: () => void;
}
