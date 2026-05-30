import { roleLabels } from "../game/operators";
import type {
  BattleUi,
  OperatorDefinition,
  OperatorSnapshot,
} from "../game/types";

export function createBattleUi(): BattleUi {
  const canvas = getElement<HTMLCanvasElement>("arena");
  const leftSelect = getElement<HTMLSelectElement>("left-operator");
  const rightSelect = getElement<HTMLSelectElement>("right-operator");
  const startButton = getElement<HTMLButtonElement>("start-button");
  const pauseButton = getElement<HTMLButtonElement>("pause-button");
  const restartButton = getElement<HTMLButtonElement>("restart-button");
  const resultBanner = getElement<HTMLDivElement>("result-banner");
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
    startButton,
    pauseButton,
    restartButton,
    speedButtons,
    resultBanner,
    setOperatorOptions: (operators, leftId, rightId) => {
      fillSelect(leftSelect, operators, leftId);
      fillSelect(rightSelect, operators, rightId);
    },
    updateStatus: (snapshot) => {
      leftStatus.innerHTML = renderStatusCard(snapshot.left);
      rightStatus.innerHTML = renderStatusCard(snapshot.right);
      resultBanner.hidden = !snapshot.winnerName;
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

function renderStatusCard(operator: OperatorSnapshot) {
  const hpRatio = toPercent(operator.hp / operator.maxHp);
  const spRatio = toPercent(operator.sp / operator.maxSp);

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
            <span>${Math.floor(operator.sp)} / ${operator.maxSp}</span>
          </div>
          <div class="bar-track">
            <div class="bar-fill sp-fill" style="width: ${spRatio}%"></div>
          </div>
        </div>
      </div>
      <div class="skill-name">
        <strong>${operator.skillName}</strong><br />
        ${operator.skillDescription}
      </div>
    </article>
  `;
}

function toPercent(ratio: number) {
  return Math.max(0, Math.min(100, ratio * 100));
}
