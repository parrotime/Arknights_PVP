import { Body, Vector } from "matter-js";
import type { SkillDefinition } from "./types";

export const skills: Record<string, SkillDefinition> = {
  tacticalChant: {
    id: "tacticalChant",
    name: "战术咏唱·γ型",
    description: "30 秒内攻击速度 +60",
    initialSp: 10,
    maxSp: 32,
    duration: 30,
    activate: ({ self, log }) => {
      self.addBuff({ type: "attackInterval", value: 0.625, duration: 30 });
      log(`${self.definition.name} 开启战术咏唱，攻击速度提升`);
    },
  },

  spiritBurst: {
    id: "spiritBurst",
    name: "精神爆发",
    description: "25 秒内攻击变为 45% 攻击力的 7 连发，结束后晕眩 10 秒",
    initialSp: 0,
    maxSp: 100,
    duration: 25,
    activate: ({ self, log }) => {
      self.addBuff({
        type: "multiHit",
        value: 0.45,
        hits: 7,
        duration: 25,
        stunAfterExpire: 10,
      });
      log(`${self.definition.name} 开启精神爆发，攻击变为 7 连发`);
    },
  },

  chimera: {
    id: "chimera",
    name: "奇美拉",
    description: "30 秒内攻击力 +160%，生命上限 +75%，范围扩大，伤害变为真实",
    initialSp: 0,
    maxSp: 120,
    duration: 30,
    skillRangeId: "amiyaChimera",
    activate: ({ self, log }) => {
      self.addBuff({ type: "attack", value: 2.6, duration: 30 });
      self.addBuff({ type: "maxHp", value: 1.75, duration: 30 });
      self.addBuff({
        type: "rangeOverride",
        value: 1,
        duration: 30,
        rangeId: "amiyaChimera",
      });
      self.addBuff({
        type: "damageTypeOverride",
        value: 1,
        duration: 30,
        damageType: "true",
      });
      log(`${self.definition.name} 开启奇美拉，攻击范围扩大并造成真实伤害`);
    },
  },

  sheathStrike: {
    id: "sheathStrike",
    name: "鞘击",
    description: "下次攻击造成 260% 物理伤害，并使目标晕眩 1.5 秒",
    initialSp: 0,
    maxSp: 5,
    skillRangeId: "chenDefault",
    minimumRangeDisplayDuration: 1,
    activate: ({ self, enemy, log, dealDamage }) => {
      const dealt = dealDamage(self, enemy, self.attack * 2.6, "physical");
      enemy.addBuff({ type: "stun", value: 1, duration: 1.5 });
      log(`${self.definition.name} 发动鞘击，造成 ${dealt} 点物理伤害并晕眩目标`);
    },
  },

  chiXiaoUnsheath: {
    id: "chiXiaoUnsheath",
    name: "赤霄·拔刀",
    description: "对前方范围造成 410% 物理伤害和 410% 法术伤害",
    initialSp: 14,
    maxSp: 25,
    skillRangeId: "chenSkill2",
    minimumRangeDisplayDuration: 1,
    activate: ({ self, enemy, log, dealDamage }) => {
      const physical = dealDamage(self, enemy, self.attack * 4.1, "physical");
      const arts = dealDamage(self, enemy, self.attack * 4.1, "arts");

      log(`${self.definition.name} 发动赤霄·拔刀，造成 ${physical} 点物理和 ${arts} 点法术伤害`);
    },
  },

  chiXiaoShadowless: {
    id: "chiXiaoShadowless",
    name: "赤霄·绝影",
    description: "寻找最近目标连续斩击 10 次，每次造成 260% 物理伤害，最后一击晕眩 3 秒",
    initialSp: 10,
    maxSp: 36,
    skillRangeId: "chenSkill3",
    minimumRangeDisplayDuration: 1,
    activate: ({ self, log, startRepeatedStrike }) => {
      self.addBuff({ type: "invincible", value: 1, duration: 1.05 });
      self.addBuff({ type: "stunImmune", value: 1, duration: 1.05 });
      startRepeatedStrike({
        rangeId: "chenSkill3",
        hits: 10,
        interval: 0.08,
        damageMultiplier: 2.6,
        damageType: "physical",
        finalStunDuration: 3,
        name: "赤霄·绝影",
      });
      log(`${self.definition.name} 发动赤霄·绝影，开始连续斩击`);
    },
  },

  exusiaiChargeMode: {
    id: "exusiaiChargeMode",
    name: "冲锋模式",
    description: "下次攻击变为 3 连射，每次造成 121% 物理伤害",
    initialSp: 0,
    maxSp: 4,
    spRecoveryType: "attack",
    minimumRangeDisplayDuration: 1,
    activate: ({ self, log }) => {
      self.addBuff({
        type: "multiHit",
        value: 1.21,
        hits: 3,
        duration: Math.max(0.2, self.attackInterval + 0.05),
        consumeOnAttack: true,
      });
      log(`${self.definition.name} 启动冲锋模式，下次攻击变为 3 连射`);
    },
  },

  exusiaiSweepingMode: {
    id: "exusiaiSweepingMode",
    name: "扫射模式",
    description: "15 秒内攻击变为 4 连射，每次造成 110% 物理伤害",
    initialSp: 18,
    maxSp: 39,
    duration: 15,
    spRecoveryType: "natural",
    activate: ({ self, log }) => {
      self.addBuff({
        type: "multiHit",
        value: 1.1,
        hits: 4,
        duration: 15,
      });
      log(`${self.definition.name} 开启扫射模式，攻击变为 4 连射`);
    },
  },

  exusiaiOverloadMode: {
    id: "exusiaiOverloadMode",
    name: "过载模式",
    description: "15 秒内攻击变为 5 连射，攻击间隔缩短 0.16 秒",
    initialSp: 20,
    maxSp: 38,
    duration: 15,
    spRecoveryType: "natural",
    autoActivate: true,
    activate: ({ self, log }) => {
      self.addBuff({
        type: "multiHit",
        value: 1,
        hits: 5,
        duration: 15,
      });
      self.addBuff({
        type: "attackInterval",
        value: Math.max(0.1, self.definition.attackInterval - 0.16) /
          self.definition.attackInterval,
        duration: 15,
      });
      log(`${self.definition.name} 自动开启过载模式，攻击变为 5 连射`);
    },
  },

  sariaFirstAid: {
    id: "sariaFirstAid",
    name: "急救",
    description: "可充能 2 次；生命低于一半时恢复 150% 攻击力生命",
    initialSp: 0,
    maxSp: 10,
    spCost: 5,
    skillRangeId: "sariaSkill1",
    minimumRangeDisplayDuration: 1,
    spRecoveryType: "natural",
    canActivate: ({ self, isSelfInRange }) =>
      self.currentHp <= self.maxHp * 0.5 && isSelfInRange("sariaSkill1"),
    activate: ({ self, log, heal }) => {
      const healed = heal(self, self, self.attack * 1.5);
      log(`${self.definition.name} 使用急救，恢复 ${healed} 点生命并回复 1 点技力`);
    },
  },

  sariaMedicineDispensing: {
    id: "sariaMedicineDispensing",
    name: "药物配置",
    description: "治疗附近所有友军，恢复 110% 攻击力生命",
    initialSp: 0,
    maxSp: 8,
    skillRangeId: "sariaSkill2",
    minimumRangeDisplayDuration: 1,
    spRecoveryType: "natural",
    canActivate: ({ self, isSelfInRange }) =>
      self.currentHp < self.maxHp && isSelfInRange("sariaSkill2"),
    activate: ({ self, log, heal }) => {
      const healed = heal(self, self, self.attack * 1.1);
      log(`${self.definition.name} 使用药物配置，恢复 ${healed} 点生命并回复 1 点技力`);
    },
  },

  sariaCalcification: {
    id: "sariaCalcification",
    name: "钙质化",
    description: "22 秒内治疗范围内友军，并使敌人受到法术伤害 +40%、移动速度 -60%",
    initialSp: 55,
    maxSp: 80,
    duration: 22,
    skillRangeId: "sariaSkill3",
    spRecoveryType: "natural",
    canActivate: ({ isEnemyInRange }) => isEnemyInRange("sariaSkill3"),
    activate: ({ self, enemy, log }) => {
      self.addBuff({ type: "attackInterval", value: 1 / self.definition.attackInterval, duration: 22 });
      self.addBuff({ type: "rangeOverride", value: 1, duration: 22, rangeId: "sariaSkill3" });
      enemy.addBuff({ type: "speed", value: 0.4, duration: 22 });
      enemy.addBuff({ type: "artsFragile", value: 1.4, duration: 22 });
      log(`${self.definition.name} 开启钙质化，敌方移动速度降低并更易受到法术伤害`);
    },
  },

  hoshigumaWarpath: {
    id: "hoshigumaWarpath",
    name: "战意",
    description: "26 秒内防御力 +65%，攻击力 +30%",
    initialSp: 20,
    maxSp: 44,
    duration: 26,
    spRecoveryType: "natural",
    activate: ({ self, log }) => {
      self.addBuff({ type: "defense", value: 1.65, duration: 26 });
      self.addBuff({ type: "attack", value: 1.3, duration: 26 });
      log(`${self.definition.name} 开启战意，攻防提升`);
    },
  },

  hoshigumaThorns: {
    id: "hoshigumaThorns",
    name: "荆棘",
    description: "被动：每次受到攻击时，对伤害来源造成 80% 攻击力的物理伤害",
    initialSp: 0,
    maxSp: 0,
    passive: true,
    activate: () => {},
  },

  hoshigumaSaw: {
    id: "hoshigumaSaw",
    name: "力之锯",
    description: "25 秒内攻击力 +95%，防御力 +60%，切割前方一格敌人",
    initialSp: 26,
    maxSp: 54,
    duration: 25,
    skillRangeId: "hoshigumaDefault",
    spRecoveryType: "natural",
    activate: ({ self, log }) => {
      self.addBuff({ type: "attack", value: 1.95, duration: 25 });
      self.addBuff({ type: "defense", value: 1.6, duration: 25 });
      log(`${self.definition.name} 开启力之锯，盾牌开始高速切割`);
    },
  },

  phantomNightPhantom: {
    id: "phantomNightPhantom",
    name: "暗夜魅影",
    description: "被动：部署后获得 40% 物理闪避和可吸收 50% 最大生命的物理屏障，持续 10 秒",
    initialSp: 0,
    maxSp: 0,
    passive: true,
    deployEffect: true,
    activate: ({ self, log }) => {
      self.addBuff({ type: "physicalShield", value: self.maxHp * 0.5, duration: 10 });
      self.addBuff({ type: "physicalDodge", value: 0.4, duration: 10 });
      log(`${self.definition.name} 进入暗夜魅影，获得物理闪避和屏障`);
    },
  },

  phantomBloodyOpus: {
    id: "phantomBloodyOpus",
    name: "血色乐章",
    description: "被动：部署后获得 9 层攻击力 +16%，成功造成伤害后消耗一层",
    initialSp: 0,
    maxSp: 0,
    passive: true,
    deployEffect: true,
    activate: ({ self, log }) => {
      for (let index = 0; index < 9; index += 1) {
        self.addBuff({
          type: "attack",
          value: 1.16,
          duration: 9999,
          stacks: 1,
          consumeOnDamage: true,
        });
      }

      log(`${self.definition.name} 奏响血色乐章，获得 9 层攻击增益`);
    },
  },

  phantomNightRaid: {
    id: "phantomNightRaid",
    name: "夜幕突袭",
    description: "被动：部署后对周围敌人造成 240% 物理伤害，推开并随机施加停顿、束缚或晕眩 3 秒",
    initialSp: 0,
    maxSp: 0,
    skillRangeId: "phantomSkill3",
    minimumRangeDisplayDuration: 1,
    passive: true,
    deployEffect: true,
    activate: ({ self, enemy, log, dealDamage, isEnemyInRange, getEnemiesInRange, pushEnemy }) => {
      self.showSkillRange("phantomSkill3", 1);

      if (!isEnemyInRange("phantomSkill3")) {
        log(`${self.definition.name} 发动夜幕突袭，但目标不在范围内`);
        return;
      }

      const extraTargets = getEnemiesInRange("phantomSkill3").filter(
        (target) => target !== enemy,
      );
      const dealt = dealDamage(self, enemy, self.attack * 2.4, "physical");
      pushEnemy(enemy, 8);

      const state = Math.floor(Math.random() * 3);

      if (state === 0) {
        enemy.addBuff({ type: "speed", value: 0.35, duration: 3 });
        log(`${self.definition.name} 发动夜幕突袭，造成 ${dealt} 点物理伤害并使目标停顿`);
      } else if (state === 1) {
        enemy.addBuff({ type: "stun", value: 1, duration: 3 });
        log(`${self.definition.name} 发动夜幕突袭，造成 ${dealt} 点物理伤害并束缚目标`);
      } else {
        enemy.addBuff({ type: "stun", value: 1, duration: 3 });
        log(`${self.definition.name} 发动夜幕突袭，造成 ${dealt} 点物理伤害并晕眩目标`);
      }

      for (const target of extraTargets) {
        dealDamage(self, target, self.attack * 2.4, "physical");
        pushEnemy(target, 8);

        if (Math.random() < 1 / 3) {
          target.addBuff({ type: "speed", value: 0.35, duration: 3 });
        } else {
          target.addBuff({ type: "stun", value: 1, duration: 3 });
        }
      }
    },
  },

  ironWall: {
    id: "ironWall",
    name: "力之锯",
    description: "获得 55% 减伤并提高攻击",
    initialSp: 0,
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
    initialSp: 0,
    maxSp: 100,
    activate: ({ self, enemy, log, dealDamage }) => {
      let total = 0;

      for (let index = 0; index < 5; index += 1) {
        total += dealDamage(self, enemy, self.attack * 0.58, "physical");
      }

      log(`${self.definition.name} 启动过载模式，合计造成 ${total} 点伤害`);
    },
  },

  firstAid: {
    id: "firstAid",
    name: "急救",
    description: "恢复生命并获得短暂减伤",
    initialSp: 0,
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
    initialSp: 0,
    maxSp: 100,
    activate: ({ self, enemy, log, dealDamage }) => {
      const dealt = dealDamage(self, enemy, self.attack * 1.35, "physical");
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
