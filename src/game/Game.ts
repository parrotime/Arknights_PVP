import { Body, Engine, Vector, type Body as MatterBody } from "matter-js";
import { OperatorRuntime } from "./OperatorRuntime";
import { operators, phantomMirrorDefinition, roleColors } from "./operators";
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

const defaultArenaSize = 648;
const collisionDamageCooldown = 0.5;
const collisionDamageRatio = 0.1;
const fixedStepMs = 1000 / 60;
const damageNumberDuration = 0.95;
const battleCastDuration = 3;
const maxBattleCastItems = 4;
const projectileDuration = 0.26;
const floatingPointEpsilon = 0.001;

export class Game {
  private readonly ui: BattleUi;
  private physics: PhysicsWorld | null = null;
  private left: OperatorRuntime | null = null;
  private right: OperatorRuntime | null = null;
  private summons: SummonRuntime[] = [];
  private animationFrameId = 0;
  private lastFrameTime = 0;
  private collisionCooldown = 0;
  private collisionCooldowns = new Map<string, number>();
  private elapsed = 0;
  private running = false;
  private winnerName: string | null = null;
  private speedMultiplier = 1;
  private arenaSize = defaultArenaSize;
  private leftId = "amiya";
  private rightId = "chen";
  private leftSkillId = "chimera";
  private rightSkillId = "sheathStrike";
  private damageNumbers: FloatingDamageSnapshot[] = [];
  private projectiles: ProjectileSnapshot[] = [];
  private battleCast: {
    id: number;
    message: string;
    age: number;
    duration: number;
  }[] = [];
  private nextDamageNumberId = 1;
  private nextProjectileId = 1;
  private nextBattleCastId = 1;
  private chenTalentTimers = { left: 0, right: 0 };
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

      if (this.elapsed === 0) {
        this.deployInitialSummons();
        this.applyDeployEffects();
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

    this.ui.arenaSizeSelect.addEventListener("change", () => {
      this.arenaSize = Number(this.ui.arenaSizeSelect.value) || defaultArenaSize;
      this.resetBattle();
    });

    this.ui.leftSelect.addEventListener("change", () => {
      this.leftId = this.ui.leftSelect.value;
      this.leftSkillId = this.getOperator(this.leftId).skillId;
      this.resetBattle();
    });

    this.ui.rightSelect.addEventListener("change", () => {
      this.rightId = this.ui.rightSelect.value;
      this.rightSkillId = this.getOperator(this.rightId).skillId;
      this.resetBattle();
    });

    this.ui.leftSkillSelect.addEventListener("change", () => {
      this.leftSkillId = this.ui.leftSkillSelect.value;
      this.resetBattle({ preserveSetup: true });
    });

    this.ui.rightSkillSelect.addEventListener("change", () => {
      this.rightSkillId = this.ui.rightSkillSelect.value;
      this.resetBattle({ preserveSetup: true });
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

  private resetBattle(options: { preserveSetup?: boolean } = {}) {
    const preservedSetup = options.preserveSetup ? this.captureSetupState() : null;

    this.physics?.clear();
    this.running = false;
    this.winnerName = null;
    this.elapsed = 0;
    this.collisionCooldown = 0;
    this.collisionCooldowns.clear();
    this.chenTalentTimers = { left: 0, right: 0 };
    this.repeatedStrikes = [];
    this.summons = [];
    this.damageNumbers = [];
    this.projectiles = [];
    this.battleCast = [];
    this.nextDamageNumberId = 1;
    this.nextProjectileId = 1;
    this.nextBattleCastId = 1;
    this.setupDrag = null;

    const leftDefinition = this.getOperator(this.leftId);
    const rightDefinition = this.getOperator(this.rightId);

    this.physics = createPhysicsWorld(
      this.arenaSize,
      leftDefinition,
      rightDefinition,
      (bodyA, bodyB) => this.handleOperatorCollision(bodyA, bodyB),
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

    this.restoreSetupState(preservedSetup);
    if (this.left.definition.id === "phantom") {
      this.ensureMirrorSummon(this.left, "left");
    }
    if (this.right.definition.id === "phantom") {
      this.ensureMirrorSummon(this.right, "right");
    }
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

    if (operatorId === "saria") {
      return [
        skills.sariaFirstAid,
        skills.sariaMedicineDispensing,
        skills.sariaCalcification,
      ];
    }

    if (operatorId === "hoshiguma") {
      return [
        skills.hoshigumaWarpath,
        skills.hoshigumaThorns,
        skills.hoshigumaSaw,
      ];
    }

    if (operatorId === "phantom") {
      return [
        skills.phantomNightPhantom,
        skills.phantomBloodyOpus,
        skills.phantomNightRaid,
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

  private captureSetupState(): SetupState | null {
    if (!this.left || !this.right || this.running || this.elapsed > 0) {
      return null;
    }

    return {
      left: this.captureOperatorSetup(this.left),
      right: this.captureOperatorSetup(this.right),
    };
  }

  private captureOperatorSetup(operator: OperatorRuntime): OperatorSetupState {
    return {
      operatorId: operator.definition.id,
      x: operator.body.position.x,
      y: operator.body.position.y,
      facingAngle: this.getFacingAngle(operator),
    };
  }

  private restoreSetupState(state: SetupState | null) {
    if (!state || !this.left || !this.right) {
      return;
    }

    this.restoreOperatorSetup(this.left, state.left);
    this.restoreOperatorSetup(this.right, state.right);
  }

  private restoreOperatorSetup(
    operator: OperatorRuntime,
    state: OperatorSetupState,
  ) {
    if (operator.definition.id !== state.operatorId) {
      return;
    }

    operator.setPosition(state.x, state.y);
    operator.setFacingAngle(state.facingAngle);
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
    this.updateCollisionCooldowns(deltaSeconds);
    this.damageNumbers = this.damageNumbers
      .map((number) => ({ ...number, age: number.age + deltaSeconds }))
      .filter((number) => number.age < number.duration);
    this.projectiles = this.projectiles
      .map((projectile) => ({
        ...projectile,
        age: projectile.age + deltaSeconds,
      }))
      .filter((projectile) => projectile.age < projectile.duration);
    for (const operator of this.getAllOperators()) {
      operator.update(deltaSeconds);
    }
    this.handleExpiredSkills();
    for (const operator of this.getAllOperators()) {
      this.chargeNaturalSkill(operator, deltaSeconds);
    }
    this.updateChenTalent(deltaSeconds);
    this.updateSummons(deltaSeconds);
    this.updateRepeatedStrikes(deltaSeconds);
    for (const operator of this.getAllOperators()) {
      const enemy = this.findNearestEnemy(operator);

      if (enemy) {
        this.tryActivateSkill(operator, enemy);
        this.updateBasicAttack(operator, enemy, deltaSeconds);
      }

      operator.updateDrift(deltaSeconds);
      operator.applySpeedToBody(deltaSeconds);
    }

    Engine.update(this.physics.engine, fixedStepMs * this.speedMultiplier);
    for (const operator of this.getAllOperators()) {
      operator.keepInsideArena(this.arenaSize);
    }
    this.checkWinner();
  }

  private handleExpiredSkills() {
    if (!this.left || !this.right || this.winnerName) {
      return;
    }

    this.handleChimeraExpiration(this.left, this.right);
    this.handleChimeraExpiration(this.right, this.left);
  }

  private handleChimeraExpiration(
    self: OperatorRuntime,
    enemy: OperatorRuntime,
  ) {
    if (
      self.expiredSkillId !== "chimera" ||
      self.definition.id !== "amiya" ||
      !self.isAlive ||
      !enemy.isAlive
    ) {
      return;
    }

    self.takeDamage(self.currentHp, "true");
    this.addBattleLog(`${self.definition.name} 的奇美拉结束，强制退出战场`);
    this.checkWinner();
  }

  private updateBattleCast(deltaSeconds: number) {
    this.battleCast = this.battleCast
      .map((cast) => ({ ...cast, age: cast.age + deltaSeconds }))
      .filter((cast) => cast.age < cast.duration);
  }

  private updateCollisionCooldowns(deltaSeconds: number) {
    const next = new Map<string, number>();

    for (const [key, value] of this.collisionCooldowns) {
      const remaining = value - deltaSeconds;

      if (remaining > 0) {
        next.set(key, remaining);
      }
    }

    this.collisionCooldowns = next;
  }

  private tryActivateSkill(
    self: OperatorRuntime,
    enemy: OperatorRuntime,
  ) {
    const spCost = self.skill.spCost ?? self.skill.maxSp;

    if (
      !self.isAlive ||
      !enemy.isAlive ||
      self.skill.passive ||
      self.isSkillActive ||
      self.currentSp < spCost
    ) {
      return;
    }

    const skillContext = this.createSkillContext(self, enemy);

    if (self.skill.canActivate && !self.skill.canActivate(skillContext)) {
      return;
    }

    if (
      !self.skill.canActivate &&
      !self.skill.autoActivate &&
      !this.isEnemyInSkillRange(self, enemy)
    ) {
      return;
    }

    self.startSkillCooldown(self.skill.duration ?? 0, spCost);
    this.showSkillRange(self);
    self.skill.activate(skillContext);
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

    for (const { key, operator } of [
      { key: "left" as const, operator: this.left },
      { key: "right" as const, operator: this.right },
    ]) {
      if (operator.definition.id !== "chen" || !operator.isAlive) {
        this.chenTalentTimers[key] = 0;
        continue;
      }

      this.chenTalentTimers[key] += deltaSeconds;

      while (this.chenTalentTimers[key] >= 4) {
        this.chenTalentTimers[key] -= 4;
        const gained = this.gainTalentSp(operator, 1);

        if (gained > 0) {
          this.addBattleLog(
            `${operator.definition.name} 的天赋为自身回复 1 点技力`,
          );
        }
      }
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

  private createSkillContext(self: OperatorRuntime, enemy: OperatorRuntime) {
    return {
      self,
      enemy,
      log: (message: string) => this.addBattleLog(message),
      dealDamage: (
        attacker: OperatorRuntimeLike,
        defender: OperatorRuntimeLike,
        rawAmount: number,
        type: DamageType,
      ) => this.dealDamage(attacker, defender, rawAmount, type),
      heal: (
        healer: OperatorRuntimeLike,
        target: OperatorRuntimeLike,
        amount: number,
      ) => this.healOperator(healer, target, amount),
      isEnemyInRange: (rangeId?: OperatorRuntime["attackRangeId"]) =>
        this.isEnemyInRangeById(
          self,
          enemy,
          rangeId ?? self.skill.skillRangeId ?? self.attackRangeId,
        ),
      getEnemiesInRange: (rangeId?: OperatorRuntime["attackRangeId"]) =>
        this.getEnemiesInRangeById(
          self,
          rangeId ?? self.skill.skillRangeId ?? self.attackRangeId,
        ),
      isSelfInRange: (rangeId?: OperatorRuntime["attackRangeId"]) =>
        this.isSelfInRangeById(
          self,
          rangeId ?? self.skill.skillRangeId ?? self.attackRangeId,
        ),
      startRepeatedStrike: (strike: RepeatedStrikeDefinition) =>
        this.startRepeatedStrike(self, enemy, strike),
      pushEnemy: (target: OperatorRuntimeLike, force: number) =>
        this.pushAway(self, target, force),
    };
  }

  private deployInitialSummons() {
    if (!this.left || !this.right) {
      return;
    }

    this.ensureMirrorSummon(this.left, "left");
    this.ensureMirrorSummon(this.right, "right");

    for (const summon of this.summons) {
      if (!summon.removedFromWorld || !summon.owner.isAlive) {
        continue;
      }

      const deployed = this.deployMirror(summon);

      if (deployed) {
        this.addBattleLog(`${deployed.definition.name} 进入战场`);
      }
    }
  }

  private ensureMirrorSummon(owner: OperatorRuntime, ownerSide: BattleSide) {
    if (owner.definition.id !== "phantom") {
      return;
    }

    if (this.summons.some((summon) => summon.owner === owner)) {
      return;
    }

    const definition: OperatorDefinition = {
      ...phantomMirrorDefinition,
      ownerId: ownerSide,
      skillId: owner.skill.id,
    };
    const runtime = new OperatorRuntime(definition, owner.skill, owner.body);

    this.summons.push({
      owner,
      ownerSide,
      runtime,
      redeployTimer: 0,
      removedFromWorld: true,
    });
  }

  private deployMirror(summon: SummonRuntime) {
    if (!this.physics) {
      return null;
    }

    const owner = summon.owner;
    const ownerSide = summon.ownerSide;
    const target = this.findNearestEnemy(owner);
    const origin = target ?? owner;
    const angle = target
      ? Math.atan2(
          target.body.position.y - owner.body.position.y,
          target.body.position.x - owner.body.position.x,
        )
      : this.getFacingAngle(owner);
    const distance = origin.definition.radius + phantomMirrorDefinition.radius + 18;
    const x = Math.max(
      phantomMirrorDefinition.radius,
      Math.min(
        this.arenaSize - phantomMirrorDefinition.radius,
        origin.body.position.x - Math.cos(angle) * distance,
      ),
    );
    const y = Math.max(
      phantomMirrorDefinition.radius,
      Math.min(
        this.arenaSize - phantomMirrorDefinition.radius,
        origin.body.position.y - Math.sin(angle) * distance,
      ),
    );
    const body = this.physics.addOperatorBody(
      `operator:${ownerSide}:mirror:${this.summons.indexOf(summon)}`,
      summon.runtime.definition,
      x,
      y,
    );
    const mirror = new OperatorRuntime(summon.runtime.definition, owner.skill, body);

    mirror.setFacingAngle(target ? Math.atan2(
      target.body.position.y - mirror.body.position.y,
      target.body.position.x - mirror.body.position.x,
    ) : this.getFacingAngle(owner));
    mirror.applySpeedToBody();

    summon.runtime = mirror;
    summon.redeployTimer = 0;
    summon.removedFromWorld = false;
    return mirror;
  }

  private applyDeployEffects() {
    for (const operator of this.getAllOperators()) {
      this.applyDeployEffect(operator);
    }
  }

  private applyDeployEffect(operator: OperatorRuntime) {
    if (!operator.skill.deployEffect) {
      return;
    }

    const enemy = this.findNearestEnemy(operator);

    if (!enemy) {
      return;
    }

    operator.skill.activate(this.createSkillContext(operator, enemy));
  }

  private updateSummons(deltaSeconds: number) {
    if (!this.physics) {
      return;
    }

    for (const summon of this.summons) {
      if (!summon.owner.isAlive) {
        if (!summon.removedFromWorld) {
          this.physics.removeBody(summon.runtime.body);
          summon.removedFromWorld = true;
        }

        continue;
      }

      if (summon.runtime.isAlive && !summon.removedFromWorld) {
        continue;
      }

      if (!summon.removedFromWorld) {
        this.physics.removeBody(summon.runtime.body);
        summon.removedFromWorld = true;
        summon.redeployTimer = 35;
        this.addBattleLog(`${summon.runtime.definition.name} 被击败，35 秒后可再次部署`);
      }

      summon.redeployTimer -= deltaSeconds;

      if (summon.redeployTimer > 0) {
        continue;
      }

      const redeployed = this.deployMirror(summon);

      if (redeployed) {
        this.addBattleLog(`${redeployed.definition.name} 再次进入战场`);
        this.applyDeployEffect(redeployed);
      }
    }
  }

  private getAllOperators() {
    return [
      this.left,
      this.right,
      ...this.summons
        .filter((summon) => !summon.removedFromWorld)
        .map((summon) => summon.runtime),
    ]
      .filter((operator): operator is OperatorRuntime =>
        Boolean(operator && operator.isAlive),
      );
  }

  private findNearestEnemy(self: OperatorRuntime) {
    const enemies = this.getAllOperators().filter(
      (operator) => operator !== self && this.areEnemies(self, operator),
    );

    let nearest: OperatorRuntime | null = null;
    let nearestDistance = Infinity;

    for (const enemy of enemies) {
      const distance = Vector.magnitude(
        Vector.sub(enemy.body.position, self.body.position),
      );

      if (distance < nearestDistance) {
        nearest = enemy;
        nearestDistance = distance;
      }
    }

    return nearest;
  }

  private areEnemies(a: OperatorRuntime, b: OperatorRuntime) {
    const sideA = this.getOperatorSide(a);
    const sideB = this.getOperatorSide(b);
    return Boolean(sideA && sideB && sideA !== sideB);
  }

  private getOperatorSide(operator: OperatorRuntime): BattleSide | null {
    if (operator === this.left) {
      return "left";
    }

    if (operator === this.right) {
      return "right";
    }

    return (
      this.summons.find((summon) => summon.runtime === operator)?.ownerSide ??
      null
    );
  }

  private getOperatorByBody(body: MatterBody) {
    return this.getAllOperators().find((operator) => operator.body === body) ?? null;
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

    if (self.skill.id === "sariaCalcification" && self.isSkillActive) {
      self.attackTimer = 0;
      const healed = this.healOperator(self, self, self.attack * 0.2);

      if (healed > 0) {
        this.addBattleLog(
          `${self.definition.name} 的钙质化恢复 ${healed} 点生命`,
        );
      }

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
        const dealt = this.dealDamage(
          self,
          enemy,
          self.attack * multiHit.multiplier,
          self.damageType,
        );
        total += dealt;

        if (dealt > 0) {
          self.consumeAttackStack();
        }
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
      self.consumeAttackStack();
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
        if (dealt > 0) {
          strike.self.consumeAttackStack();
        }
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

  private getEnemiesInRangeById(
    self: OperatorRuntime,
    attackRangeId: OperatorRuntime["attackRangeId"],
  ) {
    return this.getAllOperators().filter(
      (operator) =>
        operator !== self &&
        this.areEnemies(self, operator) &&
        this.isEnemyInRangeById(self, operator, attackRangeId),
    );
  }

  private isSelfInRangeById(
    self: OperatorRuntime,
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
        x: self.body.position.x,
        y: self.body.position.y,
        radius: self.definition.radius,
      },
    );
  }

  private getFacingAngle(self: OperatorRuntime) {
    if (!this.running && this.elapsed === 0 && self.manualFacingAngle !== null) {
      return self.manualFacingAngle;
    }

    const velocity = self.body.velocity;

    if (Math.hypot(velocity.x, velocity.y) < 0.001) {
      return self.lastFacingAngle;
    }

    self.lastFacingAngle = Math.atan2(velocity.y, velocity.x);
    return self.lastFacingAngle;
  }

  private dealDamage(
    attacker: OperatorRuntimeLike,
    defender: OperatorRuntimeLike,
    rawAmount: number,
    type: DamageType,
  ) {
    const wasDefenderAlive = defender.isAlive;
    const dealt = this.resolveAttackDamage(attacker, defender, rawAmount, type);

    if (dealt > 0) {
      this.spawnDamageNumber(attacker, defender, dealt);
      this.applyAmiyaDamageTalent(attacker, defender, wasDefenderAlive);
      this.applyHoshigumaThorns(defender, attacker);
    }

    return dealt;
  }

  private resolveAttackDamage(
    attacker: OperatorRuntimeLike,
    defender: OperatorRuntimeLike,
    rawAmount: number,
    type: DamageType,
  ) {
    if (this.tryBlockDamage(defender, type)) {
      this.addBattleLog(`${defender.definition.name} 抵挡了 ${attacker.definition.name} 的伤害`);
      return 0;
    }

    return defender.takeAttack(rawAmount, type);
  }

  private applyAmiyaDamageTalent(
    attacker: OperatorRuntimeLike,
    defender: OperatorRuntimeLike,
    wasDefenderAlive: boolean,
  ) {
    if (attacker.definition.id !== "amiya") {
      return;
    }

    this.gainTalentSp(attacker, 2);

    if (wasDefenderAlive && !defender.isAlive) {
      this.gainTalentSp(attacker, 8);
    }
  }

  private gainTalentSp(operator: OperatorRuntimeLike, amount: number) {
    const previousSp = operator.currentSp;
    operator.gainSp(amount);
    const gained = operator.currentSp - previousSp;

    if (gained > floatingPointEpsilon) {
      this.spawnSpNumber(operator, Math.max(1, Math.round(gained)));
    }

    return gained;
  }

  private dealCollisionDamage(
    attacker: OperatorRuntime,
    defender: OperatorRuntime,
    rawAmount: number,
  ) {
    const dealt = this.resolveDirectDamage(attacker, defender, rawAmount, attacker.damageType);

    if (dealt > 0) {
      this.spawnDamageNumber(attacker, defender, dealt);
      this.applyHoshigumaThorns(defender, attacker);
    }

    return dealt;
  }

  private resolveDirectDamage(
    attacker: OperatorRuntimeLike,
    defender: OperatorRuntimeLike,
    rawAmount: number,
    type: DamageType,
  ) {
    if (this.tryBlockDamage(defender, type)) {
      this.addBattleLog(`${defender.definition.name} 抵挡了 ${attacker.definition.name} 的伤害`);
      return 0;
    }

    return defender.takeDamage(rawAmount, type);
  }

  private tryBlockDamage(defender: OperatorRuntimeLike, type: DamageType) {
    return (
      type !== "true" &&
      defender.damageBlockChance > 0 &&
      Math.random() < defender.damageBlockChance
    );
  }

  private applyHoshigumaThorns(
    defender: OperatorRuntimeLike,
    attacker: OperatorRuntimeLike,
  ) {
    if (
      defender.definition.id !== "hoshiguma" ||
      defender.skill.id !== "hoshigumaThorns" ||
      !defender.isAlive ||
      !attacker.isAlive
    ) {
      return;
    }

    const reflected = attacker.takeAttack(defender.attack * 0.8, "physical");

    if (reflected > 0) {
      this.spawnDamageNumber(defender, attacker, reflected);
      this.addBattleLog(
        `${defender.definition.name} 的荆棘反伤，造成 ${reflected} 点物理伤害`,
      );
    }
  }

  private healOperator(
    healer: OperatorRuntimeLike,
    target: OperatorRuntimeLike,
    amount: number,
  ) {
    const healed = target.heal(amount);

    if (healed > 0) {
      healer.gainSp(1);
    }

    return healed;
  }

  private pushAway(
    source: OperatorRuntimeLike,
    target: OperatorRuntimeLike,
    force: number,
  ) {
    const direction = Vector.normalise(
      Vector.sub(target.body.position, source.body.position),
    );

    Body.setVelocity(target.body, {
      x: direction.x * force,
      y: direction.y * force,
    });
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
      kind: "damage",
      amount,
      x: defender.body.position.x + (directionX / length) * 8,
      y: defender.body.position.y - defender.definition.radius - 10 + (directionY / length) * 8,
      age: 0,
      duration: damageNumberDuration,
    });
    this.nextDamageNumberId += 1;
  }

  private spawnSpNumber(operator: OperatorRuntimeLike, amount: number) {
    this.damageNumbers.push({
      id: this.nextDamageNumberId,
      kind: "sp",
      amount,
      x: operator.body.position.x,
      y: operator.body.position.y - operator.definition.radius - 18,
      age: 0,
      duration: damageNumberDuration,
    });
    this.nextDamageNumberId += 1;
  }

  private handleOperatorCollision(bodyA: MatterBody, bodyB: MatterBody) {
    const operatorA = this.getOperatorByBody(bodyA);
    const operatorB = this.getOperatorByBody(bodyB);

    if (!operatorA || !operatorB || !this.areEnemies(operatorA, operatorB)) {
      return;
    }

    const cooldownKey = this.getCollisionKey(operatorA, operatorB);

    if (this.collisionCooldowns.get(cooldownKey)) {
      return;
    }

    if (!operatorA.isAlive || !operatorB.isAlive || this.winnerName) {
      return;
    }

    const damageA = Math.max(
      1,
      operatorA.attack * collisionDamageRatio,
    );
    const damageB = Math.max(
      1,
      operatorB.attack * collisionDamageRatio,
    );
    const dealtToB = this.dealCollisionDamage(
      operatorA,
      operatorB,
      damageA,
    );
    const dealtToA = this.dealCollisionDamage(
      operatorB,
      operatorA,
      damageB,
    );
    operatorA.jitterVelocity(5);
    operatorB.jitterVelocity(5);

    this.collisionCooldowns.set(cooldownKey, collisionDamageCooldown);
    this.addBattleLog(
      `碰撞：${operatorA.definition.name} 造成 ${dealtToB} 碰撞伤害，${operatorB.definition.name} 造成 ${dealtToA} 碰撞伤害`,
    );
    this.checkWinner();
  }

  private getCollisionKey(a: OperatorRuntime, b: OperatorRuntime) {
    return [a.body.label, b.body.label].sort().join("|");
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

    if (this.ui.canvas.width !== this.arenaSize) {
      this.ui.canvas.width = this.arenaSize;
      this.ui.canvas.height = this.arenaSize;
    }
    this.ui.canvas.style.setProperty("--arena-size", `${this.arenaSize}px`);
    document.documentElement.style.setProperty(
      "--arena-size",
      `${this.arenaSize}px`,
    );
    renderArena(this.ui.canvas, snapshot);
    this.ui.updateStatus(snapshot);
  }

  private createSnapshot(): BattleSnapshot {
    if (!this.left || !this.right) {
      throw new Error("Battle is not initialized.");
    }

    return {
      arenaSize: this.arenaSize,
      left: this.createOperatorSnapshot(this.left),
      right: this.createOperatorSnapshot(this.right),
      summons: this.summons
        .filter((summon) => summon.runtime.isAlive && !summon.removedFromWorld)
        .map((summon) => this.createOperatorSnapshot(summon.runtime)),
      summonStatuses: this.createSummonStatusSnapshots(),
      damageNumbers: this.damageNumbers,
      projectiles: this.projectiles,
      battleCast: this.battleCast,
      elapsed: this.elapsed,
      running: this.running,
      winnerName: this.winnerName,
    };
  }

  private createSummonStatusSnapshots() {
    return this.summons.map((summon) => ({
      ownerSide: summon.ownerSide,
      name: summon.runtime.definition.name,
      isAlive: summon.runtime.isAlive,
      isDeployed: !summon.removedFromWorld && summon.runtime.isAlive,
      redeployRemaining: Math.max(0, summon.redeployTimer),
    }));
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
      isSummon: operator.definition.isSummon,
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
    this.battleCast.unshift({
      id: this.nextBattleCastId,
      message,
      age: 0,
      duration: battleCastDuration,
    });
    this.nextBattleCastId += 1;
    this.battleCast = this.battleCast.slice(0, maxBattleCastItems);
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
        Math.max(radius, Math.min(this.arenaSize - radius, point.x)),
        Math.max(radius, Math.min(this.arenaSize - radius, point.y)),
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

type BattleSide = "left" | "right";

interface SummonRuntime {
  owner: OperatorRuntime;
  ownerSide: BattleSide;
  runtime: OperatorRuntime;
  redeployTimer: number;
  removedFromWorld: boolean;
}

interface OperatorSetupState {
  operatorId: string;
  x: number;
  y: number;
  facingAngle: number;
}

interface SetupState {
  left: OperatorSetupState;
  right: OperatorSetupState;
}
