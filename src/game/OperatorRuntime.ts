import { Body } from "matter-js";
import type {
  Buff,
  DamageType,
  OperatorDefinition,
  SkillDefinition,
} from "./types";

export class OperatorRuntime {
  readonly definition: OperatorDefinition;
  readonly skill: SkillDefinition;
  readonly body: Body;
  currentHp: number;
  currentSp = 0;
  attackTimer = 0;
  private buffs: Buff[] = [];

  constructor(
    definition: OperatorDefinition,
    skill: SkillDefinition,
    body: Body,
  ) {
    this.definition = definition;
    this.skill = skill;
    this.body = body;
    this.currentHp = definition.maxHp;
    this.currentSp = Math.min(skill.initialSp, skill.maxSp);
  }

  get isAlive() {
    return this.currentHp > 0;
  }

  get attack() {
    const attackBuff = this.buffs.find((buff) => buff.type === "attack");
    return this.definition.attack * (attackBuff?.value ?? 1);
  }

  get maxHp() {
    const maxHpBuff = this.buffs.find((buff) => buff.type === "maxHp");
    return Math.round(this.definition.maxHp * (maxHpBuff?.value ?? 1));
  }

  get defense() {
    return this.definition.defense;
  }

  get resistance() {
    return this.definition.resistance;
  }

  get speed() {
    const speedBuff = this.buffs.find((buff) => buff.type === "speed");
    return this.definition.speed * (speedBuff?.value ?? 1);
  }

  get damageType() {
    const override = this.buffs.find(
      (buff) => buff.type === "damageTypeOverride",
    );
    return override?.damageType ?? this.definition.damageType;
  }

  get attackInterval() {
    const intervalBuff = this.buffs.find(
      (buff) => buff.type === "attackInterval",
    );
    return this.definition.attackInterval * (intervalBuff?.value ?? 1);
  }

  get attackRangeId() {
    const override = this.buffs.find((buff) => buff.type === "rangeOverride");
    return override?.rangeId ?? this.definition.attackRangeId;
  }

  get rangeTileSize() {
    return this.definition.rangeTileSize;
  }

  get isStunned() {
    return this.buffs.some((buff) => buff.type === "stun");
  }

  get multiHit() {
    const buff = this.buffs.find((current) => current.type === "multiHit");

    if (!buff?.hits) {
      return null;
    }

    return {
      hits: buff.hits,
      multiplier: buff.value,
    };
  }

  get hasShield() {
    return this.buffs.some((buff) => buff.type === "damageReduction");
  }

  update(deltaSeconds: number) {
    const expiring = this.buffs.filter(
      (buff) => buff.duration > 0 && buff.duration - deltaSeconds <= 0,
    );

    this.buffs = this.buffs
      .map((buff) => ({ ...buff, duration: buff.duration - deltaSeconds }))
      .filter((buff) => buff.duration > 0);

    for (const buff of expiring) {
      if (buff.stunAfterExpire) {
        this.addBuff({ type: "stun", value: 1, duration: buff.stunAfterExpire });
      }
    }

    this.currentHp = Math.min(this.currentHp, this.maxHp);
  }

  chargeSkill(deltaSeconds: number) {
    if (!this.isAlive) {
      return;
    }

    this.currentSp = Math.min(
      this.skill.maxSp,
      this.currentSp + this.definition.spRegen * deltaSeconds,
    );
  }

  resetSkill() {
    this.currentSp = 0;
  }

  gainSp(amount: number) {
    if (!this.isAlive) {
      return;
    }

    this.currentSp = Math.min(this.skill.maxSp, this.currentSp + amount);
  }

  spendSp(amount: number) {
    this.currentSp = Math.max(0, this.currentSp - amount);
  }

  addBuff(buff: Buff) {
    const existingIndex = this.buffs.findIndex(
      (current) => current.type === buff.type,
    );
    const previousMaxHp = this.maxHp;

    if (existingIndex >= 0) {
      this.buffs[existingIndex] = buff;
      this.scaleHpForMaxHpChange(previousMaxHp);
      return;
    }

    this.buffs.push(buff);
    this.scaleHpForMaxHpChange(previousMaxHp);
  }

  private scaleHpForMaxHpChange(previousMaxHp: number) {
    if (this.maxHp <= previousMaxHp) {
      return;
    }

    this.currentHp += this.maxHp - previousMaxHp;
  }

  takeDamage(amount: number, type: DamageType) {
    if (!this.isAlive) {
      return 0;
    }

    const reductionBuff = this.buffs.find(
      (buff) => buff.type === "damageReduction",
    );
    const reduction = type === "true" ? 0 : (reductionBuff?.value ?? 0);
    const finalDamage = Math.max(1, Math.round(amount * (1 - reduction)));

    this.currentHp = Math.max(0, this.currentHp - finalDamage);
    return finalDamage;
  }

  takeAttack(amount: number, type: DamageType) {
    if (type === "true") {
      return this.takeDamage(amount, type);
    }

    if (type === "arts") {
      return this.takeDamage(amount * (1 - this.resistance / 100), type);
    }

    return this.takeDamage(Math.max(1, amount - this.defense), type);
  }

  heal(amount: number) {
    if (!this.isAlive) {
      return 0;
    }

    const before = this.currentHp;
    this.currentHp = Math.min(this.maxHp, this.currentHp + Math.round(amount));
    return this.currentHp - before;
  }

  applySpeedToBody() {
    const velocity = this.body.velocity;
    const length = Math.hypot(velocity.x, velocity.y) || 1;
    const target = this.speed / 60;

    Body.setVelocity(this.body, {
      x: (velocity.x / length) * target,
      y: (velocity.y / length) * target,
    });
  }
}
