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
  }

  get isAlive() {
    return this.currentHp > 0;
  }

  get attack() {
    const attackBuff = this.buffs.find((buff) => buff.type === "attack");
    return this.definition.attack * (attackBuff?.value ?? 1);
  }

  get defense() {
    return this.definition.defense;
  }

  get speed() {
    const speedBuff = this.buffs.find((buff) => buff.type === "speed");
    return this.definition.speed * (speedBuff?.value ?? 1);
  }

  get hasShield() {
    return this.buffs.some((buff) => buff.type === "damageReduction");
  }

  update(deltaSeconds: number) {
    this.buffs = this.buffs
      .map((buff) => ({ ...buff, duration: buff.duration - deltaSeconds }))
      .filter((buff) => buff.duration > 0);
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

  addBuff(buff: Buff) {
    const existingIndex = this.buffs.findIndex(
      (current) => current.type === buff.type,
    );

    if (existingIndex >= 0) {
      this.buffs[existingIndex] = buff;
      return;
    }

    this.buffs.push(buff);
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

  heal(amount: number) {
    if (!this.isAlive) {
      return 0;
    }

    const before = this.currentHp;
    this.currentHp = Math.min(
      this.definition.maxHp,
      this.currentHp + Math.round(amount),
    );
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
