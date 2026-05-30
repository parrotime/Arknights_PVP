import { roleLabels } from "../game/operators";
import type {
  BattleCastSnapshot,
  BattleUi,
  OperatorDefinition,
  OperatorSnapshot,
  SkillDefinition,
} from "../game/types";

export function createBattleUi(): BattleUi {
  const canvas = getElement<HTMLCanvasElement>("arena");
  const leftSelect = getElement<HTMLSelectElement>("left-operator");
  const rightSelect = getElement<HTMLSelectElement>("right-operator");
  const leftSkillSelect = getElement<HTMLSelectElement>("left-skill");
  const rightSkillSelect = getElement<HTMLSelectElement>("right-skill");
  const startButton = getElement<HTMLButtonElement>("start-button");
  const pauseButton = getElement<HTMLButtonElement>("pause-button");
  const restartButton = getElement<HTMLButtonElement>("restart-button");
  const resultBanner = getElement<HTMLDivElement>("result-banner");
  const timer = getElement<HTMLDivElement>("battle-timer");
  const battleCast = getElement<HTMLDivElement>("battle-cast");
  const leftStatus = getElement<HTMLElement>("left-status");
  const rightStatus = getElement<HTMLElement>("right-status");
  const battleLog = getElement<HTMLOListElement>("battle-log");
  const speedButtons = Array.from(
    document.querySelectorAll<HTMLButtonElement>(".speed-button"),
  );

  return {
    canvas,
    leftSelect,
    rightSelect,
    leftSkillSelect,
    rightSkillSelect,
    startButton,
    pauseButton,
    restartButton,
    speedButtons,
    resultBanner,
    timer,
    battleCast,
    setOperatorOptions: (operators, leftId, rightId) => {
      fillSelect(leftSelect, operators, leftId);
      fillSelect(rightSelect, operators, rightId);
    },
    setSkillOptions: (leftSkills, rightSkills, leftSkillId, rightSkillId) => {
      fillSkillSelect(leftSkillSelect, leftSkills, leftSkillId);
      fillSkillSelect(rightSkillSelect, rightSkills, rightSkillId);
    },
    updateStatus: (snapshot) => {
      leftStatus.innerHTML = renderStatusCard(snapshot.left);
      rightStatus.innerHTML = renderStatusCard(snapshot.right);
      resultBanner.hidden = !snapshot.winnerName;
      timer.textContent = formatElapsed(snapshot.elapsed);
      updateBattleCast(battleCast, snapshot.battleCast);
      resultBanner.textContent = snapshot.winnerName
        ? snapshot.winnerName === "平局"
          ? "平局"
          : `${snapshot.winnerName} 获胜`
        : "";
    },
    addLog: (message) => {
      const item = document.createElement("li");
      item.textContent = message;
      battleLog.prepend(item);

      while (battleLog.children.length > 12) {
        battleLog.lastElementChild?.remove();
      }
    },
    clearLog: () => {
      battleLog.innerHTML = "";
    },
  };
}

function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);

  if (!element) {
    throw new Error(`Missing element: #${id}`);
  }

  return element as T;
}

function fillSelect(
  select: HTMLSelectElement,
  operators: OperatorDefinition[],
  selectedId: string,
) {
  const currentValue = select.value;

  if (select.options.length !== operators.length) {
    select.innerHTML = operators
      .map(
        (operator) =>
          `<option value="${operator.id}">${operator.name} · ${
            roleLabels[operator.role]
          }</option>`,
      )
      .join("");
  }

  select.value = selectedId || currentValue;
}

function fillSkillSelect(
  select: HTMLSelectElement,
  skills: SkillDefinition[],
  selectedId: string,
) {
  const optionsKey = skills.map((skill) => skill.id).join("|");

  if (select.dataset.optionsKey !== optionsKey) {
    select.innerHTML = skills
      .map((skill) => `<option value="${skill.id}">${skill.name}</option>`)
      .join("");
    select.dataset.optionsKey = optionsKey;
  }

  select.disabled = skills.length <= 1;
  select.value = selectedId;
}

function renderStatusCard(operator: OperatorSnapshot) {
  const hpRatio = toPercent(operator.hp / operator.maxHp);
  const hasSpBar = operator.maxSp > 0;
  const spRatio = hasSpBar ? toPercent(operator.sp / operator.maxSp) : 100;
  const spClassName = operator.isSkillActive ? "sp-fill active-sp-fill" : "sp-fill";
  const spText = hasSpBar
    ? `${Math.floor(operator.sp)} / ${operator.maxSp}`
    : "被动";

  return `
    <article class="operator-card">
      <div class="operator-name-row">
        <div class="operator-name">${operator.name}</div>
        <span class="role-tag">${roleLabels[operator.role]}</span>
      </div>
      <div class="bar-stack">
        <div class="bar-row">
          <div class="bar-meta">
            <span>HP</span>
            <span>${Math.ceil(operator.hp)} / ${operator.maxHp}</span>
          </div>
          <div class="bar-track">
            <div class="bar-fill hp-fill" style="width: ${hpRatio}%"></div>
          </div>
        </div>
        <div class="bar-row">
          <div class="bar-meta">
            <span>SP</span>
            <span>${spText}</span>
          </div>
          <div class="bar-track">
            <div class="bar-fill ${spClassName}" style="width: ${spRatio}%"></div>
          </div>
        </div>
      </div>
      <div class="stat-grid">
        <div class="stat-item">
          <div class="stat-label">攻击</div>
          <div class="stat-value">${Math.round(operator.attack)}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">防御</div>
          <div class="stat-value">${Math.round(operator.defense)}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">法抗</div>
          <div class="stat-value">${Math.round(operator.resistance)}</div>
        </div>
      </div>
      <div class="skill-name">
        <strong>${operator.skillName}</strong><br />
        ${operator.skillDescription}
        ${operator.isStunned ? '<div class="state-line">晕眩中</div>' : ""}
      </div>
    </article>
  `;
}

function toPercent(ratio: number) {
  return Math.max(0, Math.min(100, ratio * 100));
}

function updateBattleCast(
  element: HTMLDivElement,
  casts: BattleCastSnapshot[],
) {
  element.hidden = casts.length === 0;

  if (casts.length === 0) {
    element.replaceChildren();
    element.style.opacity = "0";
    return;
  }

  element.style.opacity = "1";
  element.replaceChildren(
    ...casts.map((cast, index) => {
      const item = document.createElement("div");
      const fadeStart = cast.duration * 0.62;
      const fadeProgress =
        cast.age <= fadeStart
          ? 0
          : (cast.age - fadeStart) / Math.max(0.001, cast.duration - fadeStart);
      const opacity = Math.max(0, 1 - fadeProgress);
      const offsetY = -12 * fadeProgress;

      item.className = "battle-cast-item";
      item.textContent = cast.message;
      item.style.opacity = opacity.toFixed(3);
      item.style.transform = `translateY(${offsetY - index * 2}px)`;
      return item;
    }),
  );
}

function formatElapsed(elapsed: number) {
  const minutes = Math.floor(elapsed / 60);
  const seconds = Math.floor(elapsed % 60)
    .toString()
    .padStart(2, "0");

  return `${minutes}:${seconds}`;
}
