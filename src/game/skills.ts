import { Body, Vector } from "matter-js";
import type { SkillDefinition } from "./types";

export const skills: Record<string, SkillDefinition> = {
  spiritBurst: {
    id: "spiritBurst",
    name: "精神爆发",
    description: "造成 240% 攻击力的法术伤害",
    maxSp: 100,
    activate: ({ self, enemy, log }) => {
      const dealt = enemy.takeDamage(self.attack * 2.4, "arts");
      log(`${self.definition.name} 释放精神爆发，造成 ${dealt} 点伤害`);
    },
  },

  chiXiao: {
    id: "chiXiao",
    name: "赤霄",
    description: "造成伤害并短暂提升速度",
    maxSp: 100,
    activate: ({ self, enemy, log }) => {
      const dealt = enemy.takeDamage(self.attack * 1.8, "physical");
      self.addBuff({ type: "speed", value: 1.35, duration: 3 });
      log(`${self.definition.name} 拔出赤霄，造成 ${dealt} 点伤害并加速`);
    },
  },

  ironWall: {
    id: "ironWall",
    name: "力之锯",
    description: "获得 55% 减伤并提高攻击",
    maxSp: 100,
    activate: ({ self, log }) => {
      self.addBuff({ type: "damageReduction", value: 0.55, duration: 5 });
      self.addBuff({ type: "attack", value: 1.35, duration: 5 });
      log(`${self.definition.name} 架起防线，进入高减伤状态`);
    },
  },

  overload: {
    id: "overload",
    name: "过载模式",
    description: "连续造成多段物理伤害",
    maxSp: 100,
    activate: ({ self, enemy, log }) => {
      let total = 0;

      for (let index = 0; index < 5; index += 1) {
        total += enemy.takeDamage(self.attack * 0.58, "physical");
      }

      log(`${self.definition.name} 启动过载模式，合计造成 ${total} 点伤害`);
    },
  },

  firstAid: {
    id: "firstAid",
    name: "急救",
    description: "恢复生命并获得短暂减伤",
    maxSp: 100,
    activate: ({ self, log }) => {
      const healed = self.heal(self.definition.maxHp * 0.22);
      self.addBuff({ type: "damageReduction", value: 0.25, duration: 3 });
      log(`${self.definition.name} 进行急救，恢复 ${healed} 点生命`);
    },
  },

  shadowPush: {
    id: "shadowPush",
    name: "夜幕突袭",
    description: "造成伤害并击退敌人",
    maxSp: 100,
    activate: ({ self, enemy, log }) => {
      const dealt = enemy.takeDamage(self.attack * 1.35, "physical");
      const direction = Vector.normalise(
        Vector.sub(enemy.body.position, self.body.position),
      );

      Body.setVelocity(enemy.body, {
        x: direction.x * 8,
        y: direction.y * 8,
      });
      Body.setVelocity(self.body, {
        x: -direction.x * 5,
        y: -direction.y * 5,
      });

      log(`${self.definition.name} 发动夜幕突袭，造成 ${dealt} 点伤害并击退`);
    },
  },
};
