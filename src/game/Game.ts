import { Engine } from "matter-js";
import { OperatorRuntime } from "./OperatorRuntime";
import { operators, roleColors } from "./operators";
import { createPhysicsWorld, type PhysicsWorld } from "./physics";
import { skills } from "./skills";
import type {
  BattleSnapshot,
  BattleUi,
  OperatorDefinition,
  OperatorSnapshot,
} from "./types";
import { renderArena } from "../ui/renderer";

const arenaSize = 720;
const collisionDamageCooldown = 0.5;
const fixedStepMs = 1000 / 60;

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

    this.left.update(deltaSeconds);
    this.right.update(deltaSeconds);
    this.left.chargeSkill(deltaSeconds);
    this.right.chargeSkill(deltaSeconds);
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
    });
  }

  private handleOperatorCollision() {
    if (!this.left || !this.right || this.collisionCooldown > 0) {
      return;
    }

    if (!this.left.isAlive || !this.right.isAlive || this.winnerName) {
      return;
    }

    const leftDamage = Math.max(1, this.left.attack - this.right.defense);
    const rightDamage = Math.max(1, this.right.attack - this.left.defense);
    const dealtToRight = this.right.takeDamage(leftDamage, "physical");
    const dealtToLeft = this.left.takeDamage(rightDamage, "physical");

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
      elapsed: this.elapsed,
      running: this.running,
      winnerName: this.winnerName,
    };
  }

  private createOperatorSnapshot(
    operator: OperatorRuntime,
  ): OperatorSnapshot {
    return {
      id: operator.definition.id,
      name: operator.definition.name,
      role: operator.definition.role,
      hp: operator.currentHp,
      maxHp: operator.definition.maxHp,
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
    };
  }

  destroy() {
    cancelAnimationFrame(this.animationFrameId);
    this.physics?.clear();
  }
}
