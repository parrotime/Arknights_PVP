import { Body } from "matter-js";
import type {
  AttackRangeId,
  Buff,
  DamageType,
  OperatorDefinition,
  SkillDefinition,
} from "./types";

const smoothTurnRadiansPerSecond = (30 * Math.PI) / 180;

export class OperatorRuntime {
  readonly definition: OperatorDefinition;
  readonly skill: SkillDefinition;
  readonly body: Body;
  readonly speedVariation: number;
  currentHp: number;
  currentSp = 0;
  attackTimer = 0;
  manualFacingAngle: number | null = null;
  lastFacingAngle = 0;
  expiredSkillId: string | null = null;
  driftTimer = 1.5 + Math.random() * 1.5;
  private preservedVelocity:
    | { x: number; y: number }
    | null = null;
  private stunnedPosition:
    | { x: number; y: number }
    | null = null;
  private targetTurnAngle: number | null = null;
  private buffs: Buff[] = [];
  private skillRangeDisplay: { rangeId: AttackRangeId; duration: number } | null =
    null;
  private activeSkill: { duration: number; remaining: number } | null = null;

  constructor(
    definition: OperatorDefinition,
    skill: SkillDefinition,
    body: Body,
  ) {
    this.definition = definition;
    this.skill = skill;
    this.body = body;
    this.speedVariation = 0.975 + Math.random() * 0.05;
    this.currentHp = definition.maxHp;
    this.currentSp = Math.min(skill.initialSp, skill.maxSp);
  }

  get isAlive() {
    return this.currentHp > 0;
  }

  get attack() {
    const attackBuffs = this.buffs.filter((buff) => buff.type === "attack");
    return (
      this.definition.attack *
      (this.definition.attackMultiplier ?? 1) *
      attackBuffs.reduce((total, buff) => total * buff.value, 1)
    );
  }

  get maxHp() {
    const maxHpBuff = this.buffs.find((buff) => buff.type === "maxHp");
    return Math.round(
      this.definition.maxHp *
        (this.definition.maxHpMultiplier ?? 1) *
        (maxHpBuff?.value ?? 1),
    );
  }

  get defense() {
    const defenseBuff = this.buffs.find((buff) => buff.type === "defense");
    return (
      this.definition.defense *
      (this.definition.defenseMultiplier ?? 1) *
      (defenseBuff?.value ?? 1)
    );
  }

  get resistance() {
    return this.definition.resistance;
  }

  get physicalDodge() {
    const dodgeBuff = this.buffs.find((buff) => buff.type === "physicalDodge");
    return (this.definition.physicalDodge ?? 0) + (dodgeBuff?.value ?? 0);
  }

  get damageBlockChance() {
    return this.definition.damageBlockChance ?? 0;
  }

  get speed() {
    const speedBuff = this.buffs.find((buff) => buff.type === "speed");
    return this.definition.speed * this.speedVariation * (speedBuff?.value ?? 1);
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
    const speedBuff = this.buffs.find((buff) => buff.type === "attackSpeed");
    const attackSpeed =
      100 +
      (this.definition.attackSpeedBonus ?? 0) +
      (speedBuff?.value ?? 0);

    return (
      (this.definition.attackInterval * (intervalBuff?.value ?? 1) * 100) /
      attackSpeed
    );
  }

  get attackRangeId() {
    const override = this.buffs.find((buff) => buff.type === "rangeOverride");
    return override?.rangeId ?? this.definition.attackRangeId;
  }

  get displayRangeId() {
    return this.skillRangeDisplay?.rangeId ?? this.attackRangeId;
  }

  get displayedSp() {
    if (!this.activeSkill) {
      return this.currentSp;
    }

    return (
      this.skill.maxSp *
      Math.max(0, this.activeSkill.remaining / this.activeSkill.duration)
    );
  }

  get isSkillActive() {
    return Boolean(this.activeSkill);
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
      consumeOnAttack: Boolean(buff.consumeOnAttack),
    };
  }

  get hasShield() {
    return this.buffs.some(
      (buff) => buff.type === "damageReduction" || buff.type === "physicalShield",
    );
  }

  get artsFragileMultiplier() {
    const buff = this.buffs.find((current) => current.type === "artsFragile");
    return buff?.value ?? 1;
  }

  get isInvincible() {
    return this.buffs.some((buff) => buff.type === "invincible");
  }

  update(deltaSeconds: number) {
    this.expiredSkillId = null;
    const wasStunned = this.isStunned;
    const expiring = this.buffs.filter(
      (buff) => buff.duration > 0 && buff.duration - deltaSeconds <= 0,
    );

    this.buffs = this.buffs
      .map((buff) => ({ ...buff, duration: buff.duration - deltaSeconds }))
      .filter((buff) => buff.duration > 0);

    if (this.skillRangeDisplay) {
      const duration = this.skillRangeDisplay.duration - deltaSeconds;
      this.skillRangeDisplay =
        duration > 0
          ? { ...this.skillRangeDisplay, duration }
          : null;
    }

    if (this.activeSkill) {
      const remaining = this.activeSkill.remaining - deltaSeconds;

      if (remaining > 0) {
        this.activeSkill = { ...this.activeSkill, remaining };
      } else {
        this.expiredSkillId = this.skill.id;
        this.activeSkill = null;
      }
    }

    for (const buff of expiring) {
      if (buff.stunAfterExpire) {
        this.addBuff({ type: "stun", value: 1, duration: buff.stunAfterExpire });
      }
    }

    const isStunned = this.isStunned;

    if (!wasStunned && isStunned) {
      this.freezeMovement();
    } else if (wasStunned && !isStunned) {
      this.restoreMovement();
    }

    this.currentHp = Math.min(this.currentHp, this.maxHp);
  }

  chargeSkill(deltaSeconds: number) {
    if (!this.isAlive || this.activeSkill) {
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
    if (!this.isAlive || this.activeSkill) {
      return;
    }

    this.currentSp = Math.min(this.skill.maxSp, this.currentSp + amount);
  }

  spendSp(amount: number) {
    this.currentSp = Math.max(0, this.currentSp - amount);
  }

  addBuff(buff: Buff) {
    if (buff.type === "stun" && this.buffs.some((current) => current.type === "stunImmune")) {
      return;
    }

    if (buff.type === "stun" && !this.isStunned) {
      this.freezeMovement();
    }

    const existingIndex = this.buffs.findIndex((current) => {
      if (current.type !== buff.type) {
        return false;
      }

      return !(buff.type === "attack" && buff.consumeOnDamage);
    });
    const previousMaxHp = this.maxHp;

    if (existingIndex >= 0) {
      this.buffs[existingIndex] = buff;
      this.scaleHpForMaxHpChange(previousMaxHp);
      return;
    }

    this.buffs.push(buff);
    this.scaleHpForMaxHpChange(previousMaxHp);
  }

  removeBuff(type: Buff["type"]) {
    const previousMaxHp = this.maxHp;
    this.buffs = this.buffs.filter((buff) => buff.type !== type);
    this.scaleHpForMaxHpChange(previousMaxHp);
  }

  showSkillRange(rangeId: AttackRangeId, duration: number) {
    this.skillRangeDisplay = {
      rangeId,
      duration,
    };
  }

  startSkillCooldown(duration: number, spCost = this.skill.maxSp) {
    this.currentSp = Math.max(0, this.currentSp - spCost);

    if (duration <= 0) {
      this.activeSkill = null;
      return;
    }

    this.activeSkill = {
      duration,
      remaining: duration,
    };
  }

  private scaleHpForMaxHpChange(previousMaxHp: number) {
    if (this.maxHp <= previousMaxHp) {
      return;
    }

    this.currentHp += this.maxHp - previousMaxHp;
  }

  takeDamage(amount: number, type: DamageType) {
    if (!this.isAlive || this.isInvincible) {
      return 0;
    }

    const reductionBuff = this.buffs.find(
      (buff) => buff.type === "damageReduction",
    );
    const reduction = type === "true" ? 0 : (reductionBuff?.value ?? 0);
    let finalDamage = Math.max(1, Math.round(amount * (1 - reduction)));

    if (type === "physical") {
      finalDamage = this.absorbPhysicalShield(finalDamage);
    }

    this.currentHp = Math.max(0, this.currentHp - finalDamage);
    return finalDamage;
  }

  consumeAttackStack() {
    const index = this.buffs.findIndex(
      (buff) =>
        buff.type === "attack" &&
        Boolean(buff.consumeOnDamage) &&
        (buff.stacks ?? 0) > 0,
    );

    if (index < 0) {
      return;
    }

    const buff = this.buffs[index];
    const stacks = (buff.stacks ?? 1) - 1;

    if (stacks <= 0) {
      this.buffs.splice(index, 1);
      return;
    }

    this.buffs[index] = { ...buff, stacks };
  }

  private absorbPhysicalShield(damage: number) {
    const index = this.buffs.findIndex((buff) => buff.type === "physicalShield");

    if (index < 0) {
      return damage;
    }

    const buff = this.buffs[index];
    const remainingShield = Math.max(0, buff.value);
    const absorbed = Math.min(damage, remainingShield);
    const nextShield = remainingShield - absorbed;

    if (nextShield <= 0) {
      this.buffs.splice(index, 1);
    } else {
      this.buffs[index] = { ...buff, value: nextShield };
    }

    return damage - absorbed;
  }

  takeAttack(amount: number, type: DamageType) {
    if (type === "physical" && Math.random() < this.physicalDodge) {
      return 0;
    }

    if (type === "true") {
      return this.takeDamage(amount, type);
    }

    if (type === "arts") {
      return this.takeDamage(
        amount * this.artsFragileMultiplier * (1 - this.resistance / 100),
        type,
      );
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

  applySpeedToBody(deltaSeconds = 1 / 60) {
    if (this.isStunned) {
      this.holdStunnedPosition();
      return;
    }

    this.applySmoothTurn(deltaSeconds);
    const velocity = this.body.velocity;
    const length = Math.hypot(velocity.x, velocity.y) || 1;
    const target = this.speed / 60;

    Body.setVelocity(this.body, {
      x: (velocity.x / length) * target,
      y: (velocity.y / length) * target,
    });
  }

  setPosition(x: number, y: number) {
    Body.setPosition(this.body, { x, y });
  }

  setFacingAngle(angle: number) {
    this.manualFacingAngle = angle;
    this.lastFacingAngle = angle;
    const target = this.speed / 60;

    Body.setVelocity(this.body, {
      x: Math.cos(angle) * target,
      y: Math.sin(angle) * target,
    });
  }

  keepInsideArena(arenaSize: number) {
    if (this.isStunned) {
      this.holdStunnedPosition();
      return;
    }

    const radius = this.definition.radius;
    const min = radius;
    const max = arenaSize - radius;
    const edgeEpsilon = 0.8;
    const target = this.speed / 60;
    const minNormalSpeed = Math.max(0.6, target * 0.35);
    let { x, y } = this.body.position;
    let { x: velocityX, y: velocityY } = this.body.velocity;
    let adjusted = false;

    if (x <= min + edgeEpsilon) {
      x = min;
      velocityX = Math.max(Math.abs(velocityX), minNormalSpeed);
      adjusted = true;
    } else if (x >= max - edgeEpsilon) {
      x = max;
      velocityX = -Math.max(Math.abs(velocityX), minNormalSpeed);
      adjusted = true;
    }

    if (y <= min + edgeEpsilon) {
      y = min;
      velocityY = Math.max(Math.abs(velocityY), minNormalSpeed);
      adjusted = true;
    } else if (y >= max - edgeEpsilon) {
      y = max;
      velocityY = -Math.max(Math.abs(velocityY), minNormalSpeed);
      adjusted = true;
    }

    if (!adjusted) {
      return;
    }

    const length = Math.hypot(velocityX, velocityY) || 1;

    Body.setPosition(this.body, { x, y });
    this.setVelocityByDirection(velocityX / length, velocityY / length);
    this.jitterVelocity(5);
  }

  updateDrift(deltaSeconds: number) {
    if (!this.isAlive || this.isStunned) {
      return;
    }

    this.driftTimer -= deltaSeconds;

    if (this.driftTimer > 0) {
      return;
    }

    this.jitterVelocity(5);
    this.driftTimer = 1.5 + Math.random() * 1.5;
  }

  jitterVelocity(maxDegrees: number) {
    if (this.isStunned) {
      return;
    }

    const velocity = this.body.velocity;
    const length = Math.hypot(velocity.x, velocity.y);

    if (length < 0.001) {
      return;
    }

    const angle =
      Math.atan2(velocity.y, velocity.x) +
      ((Math.random() * 2 - 1) * maxDegrees * Math.PI) / 180;

    this.targetTurnAngle = normalizeAngle(angle);
  }

  private freezeMovement() {
    const velocity = this.body.velocity;

    if (Math.hypot(velocity.x, velocity.y) > 0.001) {
      this.preservedVelocity = { x: velocity.x, y: velocity.y };
    }

    this.stunnedPosition = {
      x: this.body.position.x,
      y: this.body.position.y,
    };
    Body.setVelocity(this.body, { x: 0, y: 0 });
    this.targetTurnAngle = null;
  }

  private restoreMovement() {
    const velocity = this.preservedVelocity ?? {
      x: Math.cos(this.manualFacingAngle ?? 0),
      y: Math.sin(this.manualFacingAngle ?? 0),
    };
    const length = Math.hypot(velocity.x, velocity.y) || 1;
    const target = this.speed / 60;

    Body.setVelocity(this.body, {
      x: (velocity.x / length) * target,
      y: (velocity.y / length) * target,
    });
    this.lastFacingAngle = Math.atan2(velocity.y, velocity.x);
    this.preservedVelocity = null;
    this.stunnedPosition = null;
    this.targetTurnAngle = null;
  }

  private holdStunnedPosition() {
    if (this.stunnedPosition) {
      Body.setPosition(this.body, this.stunnedPosition);
    }

    Body.setVelocity(this.body, { x: 0, y: 0 });
  }

  private setVelocityByDirection(x: number, y: number) {
    const length = Math.hypot(x, y) || 1;
    const target = this.speed / 60;

    Body.setVelocity(this.body, {
      x: (x / length) * target,
      y: (y / length) * target,
    });
    this.lastFacingAngle = Math.atan2(y, x);
  }

  private applySmoothTurn(deltaSeconds: number) {
    if (this.targetTurnAngle === null) {
      return;
    }

    const velocity = this.body.velocity;
    const length = Math.hypot(velocity.x, velocity.y);

    if (length < 0.001) {
      return;
    }

    const currentAngle = Math.atan2(velocity.y, velocity.x);
    const difference = shortestAngleDifference(currentAngle, this.targetTurnAngle);
    const maxStep = smoothTurnRadiansPerSecond * deltaSeconds;

    if (Math.abs(difference) <= maxStep) {
      this.setVelocityByDirection(
        Math.cos(this.targetTurnAngle),
        Math.sin(this.targetTurnAngle),
      );
      this.targetTurnAngle = null;
      return;
    }

    const nextAngle = currentAngle + Math.sign(difference) * maxStep;
    this.setVelocityByDirection(Math.cos(nextAngle), Math.sin(nextAngle));
  }
}

function normalizeAngle(angle: number) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function shortestAngleDifference(from: number, to: number) {
  return normalizeAngle(to - from);
}
