import { Engine } from "matter-js";
import { OperatorRuntime } from "./OperatorRuntime";
import { operators, roleColors } from "./operators";
import { createPhysicsWorld, type PhysicsWorld } from "./physics";
import {
  displayCellsByRange,
  getRangeCellCenter,
  isPointInAttackRange,
} from "./ranges";
import { skills } from "./skills";
import type {
  BattleSnapshot,
  BattleUi,
  DamageType,
  FloatingDamageSnapshot,
  OperatorDefinition,
  OperatorSnapshot,
  OperatorRuntimeLike,
  ProjectileSnapshot,
  RepeatedStrikeDefinition,
} from "./types";
import { renderArena } from "../ui/renderer";

const arenaSize = 648;
const collisionDamageCooldown = 0.5;
const collisionDamageRatio = 0.1;
const fixedStepMs = 1000 / 60;
const damageNumberDuration = 0.95;
const battleCastDuration = 3;
const projectileDuration = 0.26;

export class Game {
  private readonly ui: BattleUi;
  private physics: PhysicsWorld | null = null;
  private left: OperatorRuntime | null = null;
  private right: OperatorRuntime | null = null;
  private animationFrameId = 0;
  private lastFrameTime = 0;
  private collisionCooldown = 0;
  private elapsed = 0;
  private running = false;
  private winnerName: string | null = null;
  private speedMultiplier = 1;
  private leftId = "amiya";
  private rightId = "chen";
  private leftSkillId = "chimera";
  private rightSkillId = "sheathStrike";
  private damageNumbers: FloatingDamageSnapshot[] = [];
  private projectiles: ProjectileSnapshot[] = [];
  private battleCast: { message: string; age: number; duration: number } | null =
    null;
  private nextDamageNumberId = 1;
  private nextProjectileId = 1;
  private chenTalentTimer = 0;
  private repeatedStrikes: ActiveRepeatedStrike[] = [];
  private setupDrag:
    | { operator: OperatorRuntime; mode: "move" | "rotate"; pointerId: number }
    | null = null;

  constructor(ui: BattleUi) {
    this.ui = ui;
  }

  mount() {
    this.ui.setOperatorOptions(operators, this.leftId, this.rightId);
    this.syncSkillOptions();
    this.bindEvents();
    this.resetBattle();
    this.lastFrameTime = performance.now();
    this.loop(this.lastFrameTime);
  }

  private bindEvents() {
    this.ui.startButton.addEventListener("click", () => {
      if (this.winnerName) {
        this.resetBattle();
      }

      this.running = true;
    });

    this.ui.pauseButton.addEventListener("click", () => {
      this.running = !this.running;
      this.ui.pauseButton.textContent = this.running ? "暂停" : "继续";
    });

    this.ui.restartButton.addEventListener("click", () => {
      this.resetBattle();
    });

    this.ui.leftSelect.addEventListener("change", () => {
      this.leftId = this.ui.leftSelect.value;

      if (this.leftId === this.rightId) {
        this.rightId = this.pickAlternativeOperator(this.leftId);
        this.rightSkillId = this.getOperator(this.rightId).skillId;
      }

      this.leftSkillId = this.getOperator(this.leftId).skillId;
      this.resetBattle();
    });

    this.ui.rightSelect.addEventListener("change", () => {
      this.rightId = this.ui.rightSelect.value;

      if (this.leftId === this.rightId) {
        this.leftId = this.pickAlternativeOperator(this.rightId);
        this.leftSkillId = this.getOperator(this.leftId).skillId;
      }

      this.rightSkillId = this.getOperator(this.rightId).skillId;
      this.resetBattle();
    });

    this.ui.leftSkillSelect.addEventListener("change", () => {
      this.leftSkillId = this.ui.leftSkillSelect.value;
      this.resetBattle();
    });

    this.ui.rightSkillSelect.addEventListener("change", () => {
      this.rightSkillId = this.ui.rightSkillSelect.value;
      this.resetBattle();
    });

    for (const button of this.ui.speedButtons) {
      button.addEventListener("click", () => {
        this.speedMultiplier = Number(button.dataset.speed ?? "1");

        for (const current of this.ui.speedButtons) {
          current.classList.toggle("active", current === button);
        }
      });
    }

    this.ui.canvas.addEventListener("pointerdown", (event) =>
      this.handleCanvasPointerDown(event),
    );
    this.ui.canvas.addEventListener("pointermove", (event) =>
      this.handleCanvasPointerMove(event),
    );
    this.ui.canvas.addEventListener("pointerup", (event) =>
      this.handleCanvasPointerEnd(event),
    );
    this.ui.canvas.addEventListener("pointercancel", (event) =>
      this.handleCanvasPointerEnd(event),
    );
  }

  private pickAlternativeOperator(currentId: string) {
    return operators.find((operator) => operator.id !== currentId)?.id ?? currentId;
  }

  private resetBattle() {
    this.physics?.clear();
    this.running = false;
    this.winnerName = null;
    this.elapsed = 0;
    this.collisionCooldown = 0;
    this.chenTalentTimer = 0;
    this.repeatedStrikes = [];
    this.damageNumbers = [];
    this.projectiles = [];
    this.battleCast = null;
    this.nextDamageNumberId = 1;
    this.nextProjectileId = 1;
    this.setupDrag = null;

    const leftDefinition = this.getOperator(this.leftId);
    const rightDefinition = this.getOperator(this.rightId);

    this.physics = createPhysicsWorld(
      arenaSize,
      leftDefinition,
      rightDefinition,
      () => this.handleOperatorCollision(),
    );

    this.left = new OperatorRuntime(
      leftDefinition,
      this.getSkill(this.leftSkillId),
      this.physics.leftBody,
    );
    this.right = new OperatorRuntime(
      rightDefinition,
      this.getSkill(this.rightSkillId),
      this.physics.rightBody,
    );

    this.left.applySpeedToBody();
    this.right.applySpeedToBody();
    this.ui.pauseButton.textContent = "暂停";
    this.ui.setOperatorOptions(operators, this.leftId, this.rightId);
    this.syncSkillOptions();
    this.ui.clearLog();
    this.ui.addLog(`${leftDefinition.name} vs ${rightDefinition.name}，战斗准备完成`);
    this.render();
  }

  private getOperator(id: string): OperatorDefinition {
    const operator = operators.find((current) => current.id === id);

    if (!operator) {
      throw new Error(`Unknown operator: ${id}`);
    }

    return operator;
  }

  private getSkill(id: string) {
    const skill = skills[id];

    if (!skill) {
      throw new Error(`Unknown skill: ${id}`);
    }

    return skill;
  }

  private getSelectableSkills(operatorId: string) {
    if (operatorId === "amiya") {
      return [skills.tacticalChant, skills.spiritBurst, skills.chimera];
    }

    if (operatorId === "chen") {
      return [
        skills.sheathStrike,
        skills.chiXiaoUnsheath,
        skills.chiXiaoShadowless,
      ];
    }

    if (operatorId === "exusiai") {
      return [
        skills.exusiaiChargeMode,
        skills.exusiaiSweepingMode,
        skills.exusiaiOverloadMode,
      ];
    }

    const operator = this.getOperator(operatorId);
    return [this.getSkill(operator.skillId)];
  }

  private syncSkillOptions() {
    const leftSkills = this.getSelectableSkills(this.leftId);
    const rightSkills = this.getSelectableSkills(this.rightId);

    if (!leftSkills.some((skill) => skill.id === this.leftSkillId)) {
      this.leftSkillId = leftSkills[0].id;
    }

    if (!rightSkills.some((skill) => skill.id === this.rightSkillId)) {
      this.rightSkillId = rightSkills[0].id;
    }

    this.ui.setSkillOptions(
      leftSkills,
      rightSkills,
      this.leftSkillId,
      this.rightSkillId,
    );
  }

  private loop = (time: number) => {
    const rawDelta = Math.min(0.05, (time - this.lastFrameTime) / 1000);
    this.lastFrameTime = time;

    if (this.running && !this.winnerName) {
      this.update(rawDelta * this.speedMultiplier);
    }

    this.updateBattleCast(rawDelta);
    this.render();
    this.animationFrameId = requestAnimationFrame(this.loop);
  };

  private update(deltaSeconds: number) {
    if (!this.physics || !this.left || !this.right) {
      return;
    }

    this.elapsed += deltaSeconds;
    this.collisionCooldown = Math.max(
      0,
      this.collisionCooldown - deltaSeconds,
    );
    this.damageNumbers = this.damageNumbers
      .map((number) => ({ ...number, age: number.age + deltaSeconds }))
      .filter((number) => number.age < number.duration);
    this.projectiles = this.projectiles
      .map((projectile) => ({
        ...projectile,
        age: projectile.age + deltaSeconds,
      }))
      .filter((projectile) => projectile.age < projectile.duration);
    this.left.update(deltaSeconds);
    this.right.update(deltaSeconds);
    this.chargeNaturalSkill(this.left, deltaSeconds);
    this.chargeNaturalSkill(this.right, deltaSeconds);
    this.updateChenTalent(deltaSeconds);
    this.updateRepeatedStrikes(deltaSeconds);
    this.updateBasicAttack(this.left, this.right, deltaSeconds);
    this.updateBasicAttack(this.right, this.left, deltaSeconds);
    this.tryActivateSkill(this.left, this.right);
    this.tryActivateSkill(this.right, this.left);
    this.left.applySpeedToBody();
    this.right.applySpeedToBody();

    Engine.update(this.physics.engine, fixedStepMs * this.speedMultiplier);
    this.left.keepInsideArena(arenaSize);
    this.right.keepInsideArena(arenaSize);
    this.checkWinner();
  }

  private updateBattleCast(deltaSeconds: number) {
    this.battleCast = this.battleCast
      ? { ...this.battleCast, age: this.battleCast.age + deltaSeconds }
      : null;

    if (this.battleCast && this.battleCast.age >= this.battleCast.duration) {
      this.battleCast = null;
    }
  }

  private tryActivateSkill(
    self: OperatorRuntime,
    enemy: OperatorRuntime,
  ) {
    if (
      !self.isAlive ||
      !enemy.isAlive ||
      self.isSkillActive ||
      self.currentSp < self.skill.maxSp
    ) {
      return;
    }

    if (!self.skill.autoActivate && !this.isEnemyInSkillRange(self, enemy)) {
      return;
    }

    self.startSkillCooldown(self.skill.duration ?? 0);
    this.showSkillRange(self);
    self.skill.activate({
      self,
      enemy,
      log: (message) => this.addBattleLog(message),
      dealDamage: (attacker, defender, rawAmount, type) =>
        this.dealDamage(attacker, defender, rawAmount, type),
      isEnemyInRange: (rangeId) =>
        this.isEnemyInRangeById(
          self,
          enemy,
          rangeId ?? self.skill.skillRangeId ?? self.attackRangeId,
        ),
      startRepeatedStrike: (strike) =>
        this.startRepeatedStrike(self, enemy, strike),
    });
  }

  private chargeNaturalSkill(operator: OperatorRuntime, deltaSeconds: number) {
    if (this.getSpRecoveryType(operator) !== "natural") {
      return;
    }

    operator.chargeSkill(deltaSeconds);
  }

  private updateChenTalent(deltaSeconds: number) {
    if (!this.left || !this.right) {
      return;
    }

    const chen = [this.left, this.right].find(
      (operator) => operator.definition.id === "chen" && operator.isAlive,
    );

    if (!chen) {
      this.chenTalentTimer = 0;
      return;
    }

    this.chenTalentTimer += deltaSeconds;

    while (this.chenTalentTimer >= 4) {
      this.chenTalentTimer -= 4;
      chen.gainSp(1);
    }
  }

  private showSkillRange(self: OperatorRuntime) {
    const rangeId = self.skill.skillRangeId;

    if (!rangeId) {
      return;
    }

    const duration = Math.max(
      1,
      self.skill.minimumRangeDisplayDuration ?? 0,
      self.skill.duration ?? 0,
    );
    self.showSkillRange(rangeId, duration);
  }

  private updateBasicAttack(
    self: OperatorRuntime,
    enemy: OperatorRuntime,
    deltaSeconds: number,
  ) {
    if (!self.isAlive || !enemy.isAlive || self.isStunned) {
      return;
    }

    self.attackTimer += deltaSeconds;

    if (self.attackTimer < self.attackInterval) {
      return;
    }

    if (!this.isEnemyInRange(self, enemy)) {
      self.attackTimer = Math.min(self.attackTimer, self.attackInterval);
      return;
    }

    self.attackTimer = 0;
    this.gainAttackRecoverySp(self);
    const multiHit = self.multiHit;

    if (multiHit) {
      this.spawnProjectile(self, enemy);
      let total = 0;

      for (let index = 0; index < multiHit.hits; index += 1) {
        total += this.dealDamage(
          self,
          enemy,
          self.attack * multiHit.multiplier,
          self.damageType,
        );
      }

      if (multiHit.consumeOnAttack) {
        self.removeBuff("multiHit");
      }

      this.addBattleLog(
        `${self.definition.name} 连续攻击 ${multiHit.hits} 次，合计造成 ${total} 点伤害`,
      );
      this.checkWinner();
      return;
    }

    this.spawnProjectile(self, enemy);
    const dealt = this.dealDamage(self, enemy, self.attack, self.damageType);

    if (dealt > 0) {
      this.addBattleLog(
        `${self.definition.name} 攻击命中，造成 ${dealt} 点${this.getDamageTypeLabel(self.damageType)}伤害`,
      );
    }

    this.checkWinner();
  }

  private gainAttackRecoverySp(operator: OperatorRuntime) {
    if (this.getSpRecoveryType(operator) === "attack") {
      operator.gainSp(1);
    }
  }

  private getSpRecoveryType(operator: OperatorRuntime) {
    return operator.skill.spRecoveryType ?? operator.definition.spRecoveryType;
  }

  private startRepeatedStrike(
    self: OperatorRuntime,
    enemy: OperatorRuntime,
    definition: RepeatedStrikeDefinition,
  ) {
    self.addBuff({ type: "invincible", value: 1, duration: 1 });
    self.addBuff({ type: "stunImmune", value: 1, duration: 1 });
    this.repeatedStrikes.push({
      self,
      enemy,
      definition,
      remainingHits: definition.hits,
      timer: 0,
      totalDamage: 0,
    });
  }

  private updateRepeatedStrikes(deltaSeconds: number) {
    const active: ActiveRepeatedStrike[] = [];

    for (const strike of this.repeatedStrikes) {
      strike.timer -= deltaSeconds;

      while (strike.timer <= 0 && strike.remainingHits > 0) {
        if (!strike.self.isAlive || !strike.enemy.isAlive) {
          strike.remainingHits = 0;
          break;
        }

        if (!this.isEnemyInRangeById(
          strike.self,
          strike.enemy,
          strike.definition.rangeId,
        )) {
          this.addBattleLog(`${strike.self.definition.name} 的${strike.definition.name}因目标脱离范围而中止`);
          strike.remainingHits = 0;
          break;
        }

        const dealt = this.dealDamage(
          strike.self,
          strike.enemy,
          strike.self.attack * strike.definition.damageMultiplier,
          strike.definition.damageType,
        );
        strike.totalDamage += dealt;
        strike.remainingHits -= 1;

        if (
          strike.remainingHits === 0 &&
          strike.definition.finalStunDuration &&
          strike.enemy.isAlive
        ) {
          strike.enemy.addBuff({
            type: "stun",
            value: 1,
            duration: strike.definition.finalStunDuration,
          });
        }

        strike.timer += strike.definition.interval;
      }

      if (strike.remainingHits > 0) {
        active.push(strike);
      } else if (strike.totalDamage > 0) {
        this.addBattleLog(
          `${strike.self.definition.name} 完成${strike.definition.name}，合计造成 ${strike.totalDamage} 点伤害`,
        );
      }
    }

    this.repeatedStrikes = active;
    this.checkWinner();
  }

  private isEnemyInRange(self: OperatorRuntime, enemy: OperatorRuntime) {
    return this.isEnemyInRangeById(self, enemy, self.attackRangeId);
  }

  private isEnemyInSkillRange(self: OperatorRuntime, enemy: OperatorRuntime) {
    return this.isEnemyInRangeById(
      self,
      enemy,
      self.skill.skillRangeId ?? self.attackRangeId,
    );
  }

  private isEnemyInRangeById(
    self: OperatorRuntime,
    enemy: OperatorRuntime,
    attackRangeId: OperatorRuntime["attackRangeId"],
  ) {
    return isPointInAttackRange(
      {
        x: self.body.position.x,
        y: self.body.position.y,
        facingAngle: this.getFacingAngle(self),
        attackRangeId,
        rangeTileSize: self.rangeTileSize,
      },
      {
        x: enemy.body.position.x,
        y: enemy.body.position.y,
        radius: enemy.definition.radius,
      },
    );
  }

  private getFacingAngle(self: OperatorRuntime) {
    if (!this.running && self.manualFacingAngle !== null) {
      return self.manualFacingAngle;
    }

    const velocity = self.body.velocity;

    if (Math.hypot(velocity.x, velocity.y) < 0.001) {
      return 0;
    }

    return Math.atan2(velocity.y, velocity.x);
  }

  private dealDamage(
    attacker: OperatorRuntimeLike,
    defender: OperatorRuntimeLike,
    rawAmount: number,
    type: DamageType,
  ) {
    const dealt = defender.takeAttack(rawAmount, type);

    if (dealt > 0) {
      this.spawnDamageNumber(attacker, defender, dealt);
    }

    return dealt;
  }

  private dealCollisionDamage(
    attacker: OperatorRuntime,
    defender: OperatorRuntime,
    rawAmount: number,
  ) {
    const dealt = defender.takeDamage(rawAmount, attacker.damageType);

    if (dealt > 0) {
      this.spawnDamageNumber(attacker, defender, dealt);
    }

    return dealt;
  }

  private spawnProjectile(attacker: OperatorRuntime, defender: OperatorRuntime) {
    if (!this.isRangedOperator(attacker)) {
      return;
    }

    this.projectiles.push({
      id: this.nextProjectileId,
      fromX: attacker.body.position.x,
      fromY: attacker.body.position.y,
      toX: defender.body.position.x,
      toY: defender.body.position.y,
      age: 0,
      duration: projectileDuration,
      damageType: attacker.damageType,
    });
    this.nextProjectileId += 1;
  }

  private isRangedOperator(operator: OperatorRuntime) {
    return operator.definition.attackMode === "ranged";
  }

  private spawnDamageNumber(
    attacker: OperatorRuntimeLike,
    defender: OperatorRuntimeLike,
    amount: number,
  ) {
    const directionX = defender.body.position.x - attacker.body.position.x;
    const directionY = defender.body.position.y - attacker.body.position.y;
    const length = Math.hypot(directionX, directionY) || 1;

    this.damageNumbers.push({
      id: this.nextDamageNumberId,
      amount,
      x: defender.body.position.x + (directionX / length) * 8,
      y: defender.body.position.y - defender.definition.radius - 10 + (directionY / length) * 8,
      age: 0,
      duration: damageNumberDuration,
    });
    this.nextDamageNumberId += 1;
  }

  private handleOperatorCollision() {
    if (!this.left || !this.right || this.collisionCooldown > 0) {
      return;
    }

    if (!this.left.isAlive || !this.right.isAlive || this.winnerName) {
      return;
    }

    const leftDamage = Math.max(
      1,
      this.left.attack * collisionDamageRatio,
    );
    const rightDamage = Math.max(
      1,
      this.right.attack * collisionDamageRatio,
    );
    const dealtToRight = this.dealCollisionDamage(
      this.left,
      this.right,
      leftDamage,
    );
    const dealtToLeft = this.dealCollisionDamage(
      this.right,
      this.left,
      rightDamage,
    );

    this.collisionCooldown = collisionDamageCooldown;
    this.addBattleLog(
      `碰撞：${this.left.definition.name} 造成 ${dealtToRight} 碰撞伤害，${this.right.definition.name} 造成 ${dealtToLeft} 碰撞伤害`,
    );
    this.checkWinner();
  }

  private checkWinner() {
    if (!this.left || !this.right || this.winnerName) {
      return;
    }

    if (!this.left.isAlive && !this.right.isAlive) {
      this.winnerName = "平局";
      this.running = false;
      this.addBattleLog("双方同时倒下，判定为平局");
      return;
    }

    if (!this.left.isAlive) {
      this.winnerName = this.right.definition.name;
      this.running = false;
      this.addBattleLog(`${this.right.definition.name} 获胜`);
      return;
    }

    if (!this.right.isAlive) {
      this.winnerName = this.left.definition.name;
      this.running = false;
      this.addBattleLog(`${this.left.definition.name} 获胜`);
    }
  }

  private render() {
    const snapshot = this.createSnapshot();

    renderArena(this.ui.canvas, snapshot);
    this.ui.updateStatus(snapshot);
  }

  private createSnapshot(): BattleSnapshot {
    if (!this.left || !this.right) {
      throw new Error("Battle is not initialized.");
    }

    return {
      left: this.createOperatorSnapshot(this.left),
      right: this.createOperatorSnapshot(this.right),
      damageNumbers: this.damageNumbers,
      projectiles: this.projectiles,
      battleCast: this.battleCast,
      elapsed: this.elapsed,
      running: this.running,
      winnerName: this.winnerName,
    };
  }

  private createOperatorSnapshot(
    operator: OperatorRuntime,
  ): OperatorSnapshot {
    if (!this.left || !this.right) {
      throw new Error("Battle is not initialized.");
    }

    return {
      id: operator.definition.id,
      name: operator.definition.name,
      englishName: operator.definition.englishName,
      role: operator.definition.role,
      attackMode: operator.definition.attackMode,
      hp: operator.currentHp,
      maxHp: operator.maxHp,
      sp: operator.displayedSp,
      maxSp: operator.skill.maxSp,
      attack: operator.attack,
      defense: operator.defense,
      resistance: operator.resistance,
      skillName: operator.skill.name,
      skillDescription: operator.skill.description,
      x: operator.body.position.x,
      y: operator.body.position.y,
      radius: operator.definition.radius,
      color: roleColors[operator.definition.role],
      isAlive: operator.isAlive,
      hasShield: operator.hasShield,
      isStunned: operator.isStunned,
      isSkillActive: operator.isSkillActive,
      facingAngle: this.getFacingAngle(operator),
      attackRangeId: operator.attackRangeId,
      displayRangeId: operator.displayRangeId,
      rangeTileSize: operator.rangeTileSize,
    };
  }

  private addBattleLog(message: string) {
    this.ui.addLog(message);
    this.battleCast = {
      message,
      age: 0,
      duration: battleCastDuration,
    };
  }

  private handleCanvasPointerDown(event: PointerEvent) {
    if (
      this.running ||
      this.elapsed > 0 ||
      this.winnerName ||
      !this.left ||
      !this.right
    ) {
      return;
    }

    const point = this.getCanvasPoint(event);
    const operator = this.pickSetupOperator(point);

    if (!operator) {
      return;
    }

    this.setupDrag = {
      operator,
      mode: this.isPointInsideOperator(point, operator) ? "move" : "rotate",
      pointerId: event.pointerId,
    };
    this.ui.canvas.setPointerCapture(event.pointerId);
    this.updateSetupDrag(point);
  }

  private handleCanvasPointerMove(event: PointerEvent) {
    if (!this.setupDrag || this.setupDrag.pointerId !== event.pointerId) {
      return;
    }

    this.updateSetupDrag(this.getCanvasPoint(event));
  }

  private handleCanvasPointerEnd(event: PointerEvent) {
    if (!this.setupDrag || this.setupDrag.pointerId !== event.pointerId) {
      return;
    }

    this.ui.canvas.releasePointerCapture(event.pointerId);
    this.setupDrag = null;
  }

  private updateSetupDrag(point: { x: number; y: number }) {
    if (!this.setupDrag) {
      return;
    }

    const operator = this.setupDrag.operator;

    if (this.setupDrag.mode === "move") {
      const radius = operator.definition.radius;
      operator.setPosition(
        Math.max(radius, Math.min(arenaSize - radius, point.x)),
        Math.max(radius, Math.min(arenaSize - radius, point.y)),
      );
      return;
    }

    operator.setFacingAngle(
      Math.atan2(
        point.y - operator.body.position.y,
        point.x - operator.body.position.x,
      ),
    );
  }

  private pickSetupOperator(point: { x: number; y: number }) {
    const candidates = [this.left, this.right].filter(
      (operator): operator is OperatorRuntime => Boolean(operator),
    );

    return (
      candidates.find((operator) => this.isPointInsideOperator(point, operator)) ??
      candidates.find((operator) =>
        this.isPointInsideDisplayRange(point, operator),
      ) ??
      null
    );
  }

  private isPointInsideOperator(
    point: { x: number; y: number },
    operator: OperatorRuntime,
  ) {
    return (
      Math.hypot(
        point.x - operator.body.position.x,
        point.y - operator.body.position.y,
      ) <= operator.definition.radius
    );
  }

  private isPointInsideDisplayRange(
    point: { x: number; y: number },
    operator: OperatorRuntime,
  ) {
    const tileSize = operator.rangeTileSize;
    const half = tileSize / 2;
    const angle = this.getFacingAngle(operator);
    const cos = Math.cos(-angle);
    const sin = Math.sin(-angle);

    for (const cell of displayCellsByRange[operator.displayRangeId]) {
      const center = getRangeCellCenter(
        operator.body.position.x,
        operator.body.position.y,
        angle,
        operator.displayRangeId,
        cell,
        tileSize,
      );
      const localX = (point.x - center.x) * cos - (point.y - center.y) * sin;
      const localY = (point.x - center.x) * sin + (point.y - center.y) * cos;

      if (Math.abs(localX) <= half && Math.abs(localY) <= half) {
        return true;
      }
    }

    return false;
  }

  private getCanvasPoint(event: PointerEvent) {
    const rect = this.ui.canvas.getBoundingClientRect();
    const scaleX = this.ui.canvas.width / rect.width;
    const scaleY = this.ui.canvas.height / rect.height;

    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  }

  private getDamageTypeLabel(type: DamageType) {
    if (type === "arts") {
      return "法术";
    }

    if (type === "true") {
      return "真实";
    }

    return "物理";
  }

  destroy() {
    cancelAnimationFrame(this.animationFrameId);
    this.physics?.clear();
  }
}

interface ActiveRepeatedStrike {
  self: OperatorRuntime;
  enemy: OperatorRuntime;
  definition: RepeatedStrikeDefinition;
  remainingHits: number;
  timer: number;
  totalDamage: number;
}
