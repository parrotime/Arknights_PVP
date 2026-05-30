import { Engine } from "matter-js";
import { OperatorRuntime } from "./OperatorRuntime";
import { operators, roleColors } from "./operators";
import { createPhysicsWorld, type PhysicsWorld } from "./physics";
import { isPointInAttackRange } from "./ranges";
import { skills } from "./skills";
import type {
  BattleSnapshot,
  BattleUi,
  DamageType,
  FacingDirection,
  FloatingDamageSnapshot,
  OperatorDefinition,
  OperatorSnapshot,
  OperatorRuntimeLike,
} from "./types";
import { renderArena } from "../ui/renderer";

const arenaSize = 720;
const collisionDamageCooldown = 0.5;
const collisionDamageRatio = 0.1;
const fixedStepMs = 1000 / 60;
const damageNumberDuration = 0.95;

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
  private damageNumbers: FloatingDamageSnapshot[] = [];
  private nextDamageNumberId = 1;

  constructor(ui: BattleUi) {
    this.ui = ui;
  }

  mount() {
    this.ui.setOperatorOptions(operators, this.leftId, this.rightId);
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
      this.running = true;
    });

    this.ui.leftSelect.addEventListener("change", () => {
      this.leftId = this.ui.leftSelect.value;

      if (this.leftId === this.rightId) {
        this.rightId = this.pickAlternativeOperator(this.leftId);
      }

      this.resetBattle();
    });

    this.ui.rightSelect.addEventListener("change", () => {
      this.rightId = this.ui.rightSelect.value;

      if (this.leftId === this.rightId) {
        this.leftId = this.pickAlternativeOperator(this.rightId);
      }

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
    this.damageNumbers = [];
    this.nextDamageNumberId = 1;

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
      this.getSkill(leftDefinition.skillId),
      this.physics.leftBody,
    );
    this.right = new OperatorRuntime(
      rightDefinition,
      this.getSkill(rightDefinition.skillId),
      this.physics.rightBody,
    );

    this.left.applySpeedToBody();
    this.right.applySpeedToBody();
    this.ui.pauseButton.textContent = "暂停";
    this.ui.setOperatorOptions(operators, this.leftId, this.rightId);
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

  private loop = (time: number) => {
    const rawDelta = Math.min(0.05, (time - this.lastFrameTime) / 1000);
    this.lastFrameTime = time;

    if (this.running && !this.winnerName) {
      this.update(rawDelta * this.speedMultiplier);
    }

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

    this.left.update(deltaSeconds);
    this.right.update(deltaSeconds);
    this.left.chargeSkill(deltaSeconds);
    this.right.chargeSkill(deltaSeconds);
    this.updateBasicAttack(this.left, this.right, deltaSeconds);
    this.updateBasicAttack(this.right, this.left, deltaSeconds);
    this.tryActivateSkill(this.left, this.right);
    this.tryActivateSkill(this.right, this.left);
    this.left.applySpeedToBody();
    this.right.applySpeedToBody();

    Engine.update(this.physics.engine, fixedStepMs * this.speedMultiplier);
    this.checkWinner();
  }

  private tryActivateSkill(
    self: OperatorRuntime,
    enemy: OperatorRuntime,
  ) {
    if (!self.isAlive || !enemy.isAlive || self.currentSp < self.skill.maxSp) {
      return;
    }

    self.resetSkill();
    self.skill.activate({
      self,
      enemy,
      log: (message) => this.ui.addLog(message),
      dealDamage: (attacker, defender, rawAmount, type) =>
        this.dealDamage(attacker, defender, rawAmount, type),
    });
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
    const multiHit = self.multiHit;

    if (multiHit) {
      let total = 0;

      for (let index = 0; index < multiHit.hits; index += 1) {
        total += this.dealDamage(
          self,
          enemy,
          self.attack * multiHit.multiplier,
          self.damageType,
        );
      }

      this.ui.addLog(
        `${self.definition.name} 连续攻击 ${multiHit.hits} 次，合计造成 ${total} 点伤害`,
      );
      this.checkWinner();
      return;
    }

    const dealt = this.dealDamage(self, enemy, self.attack, self.damageType);

    if (dealt > 0) {
      this.ui.addLog(
        `${self.definition.name} 攻击命中，造成 ${dealt} 点${this.getDamageTypeLabel(self.damageType)}伤害`,
      );
    }

    this.checkWinner();
  }

  private isEnemyInRange(self: OperatorRuntime, enemy: OperatorRuntime) {
    return isPointInAttackRange(
      {
        x: self.body.position.x,
        y: self.body.position.y,
        facingDirection: this.getFacingDirection(self, enemy),
        attackRangeId: self.attackRangeId,
        rangeTileSize: self.rangeTileSize,
      },
      {
        x: enemy.body.position.x,
        y: enemy.body.position.y,
        radius: enemy.definition.radius,
      },
    );
  }

  private getFacingDirection(
    self: OperatorRuntime,
    enemy: OperatorRuntime,
  ): FacingDirection {
    const deltaX = enemy.body.position.x - self.body.position.x;
    const deltaY = enemy.body.position.y - self.body.position.y;

    if (Math.abs(deltaX) >= Math.abs(deltaY)) {
      return deltaX >= 0 ? "right" : "left";
    }

    return deltaY >= 0 ? "down" : "up";
  }

  private dealDamage(
    attacker: OperatorRuntimeLike,
    defender: OperatorRuntimeLike,
    rawAmount: number,
    type: DamageType,
  ) {
    const wasAlive = defender.isAlive;
    const dealt = defender.takeAttack(rawAmount, type);

    if (dealt > 0) {
      this.spawnDamageNumber(defender, dealt);
    }

    if (dealt > 0 && attacker.definition.id === "amiya") {
      attacker.gainSp(2);
    }

    if (wasAlive && !defender.isAlive && attacker.definition.id === "amiya") {
      attacker.gainSp(8);
      this.ui.addLog(`${attacker.definition.name} 击倒敌人，天赋额外回复 8 点技力`);
    }

    return dealt;
  }

  private spawnDamageNumber(
    defender: OperatorRuntimeLike,
    amount: number,
  ) {
    this.damageNumbers.push({
      id: this.nextDamageNumberId,
      amount,
      x: defender.body.position.x,
      y: defender.body.position.y - defender.definition.radius - 10,
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
    const dealtToRight = this.dealDamage(
      this.left,
      this.right,
      leftDamage,
      this.left.damageType,
    );
    const dealtToLeft = this.dealDamage(
      this.right,
      this.left,
      rightDamage,
      this.right.damageType,
    );

    this.collisionCooldown = collisionDamageCooldown;
    this.ui.addLog(
      `碰撞：${this.left.definition.name} 造成 ${dealtToRight}，${this.right.definition.name} 造成 ${dealtToLeft}`,
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
      this.ui.addLog("双方同时倒下，判定为平局");
      return;
    }

    if (!this.left.isAlive) {
      this.winnerName = this.right.definition.name;
      this.running = false;
      this.ui.addLog(`${this.right.definition.name} 获胜`);
      return;
    }

    if (!this.right.isAlive) {
      this.winnerName = this.left.definition.name;
      this.running = false;
      this.ui.addLog(`${this.left.definition.name} 获胜`);
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

    const enemy = operator === this.left ? this.right : this.left;

    return {
      id: operator.definition.id,
      name: operator.definition.name,
      role: operator.definition.role,
      hp: operator.currentHp,
      maxHp: operator.maxHp,
      sp: operator.currentSp,
      maxSp: operator.skill.maxSp,
      skillName: operator.skill.name,
      skillDescription: operator.skill.description,
      x: operator.body.position.x,
      y: operator.body.position.y,
      radius: operator.definition.radius,
      color: roleColors[operator.definition.role],
      isAlive: operator.isAlive,
      hasShield: operator.hasShield,
      isStunned: operator.isStunned,
      facingDirection: this.getFacingDirection(operator, enemy),
      attackRangeId: operator.attackRangeId,
      rangeTileSize: operator.rangeTileSize,
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
