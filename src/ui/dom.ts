import { roleLabels } from "../game/operators";
import type {
  BattleUi,
  OperatorDefinition,
  OperatorSnapshot,
  SkillDefinition,
  SummonStatusSnapshot,
  TickerMessage,
} from "../game/types";

export function createBattleUi(): BattleUi {
  const canvas = getElement<HTMLCanvasElement>("arena");
  const leftSelect = getElement<HTMLSelectElement>("left-operator");
  const rightSelect = getElement<HTMLSelectElement>("right-operator");
  const leftSkillSelect = getElement<HTMLSelectElement>("left-skill");
  const rightSkillSelect = getElement<HTMLSelectElement>("right-skill");
  const arenaSizeSelect = getElement<HTMLSelectElement>("arena-size");
  const leftOperatorRandomButton = getElement<HTMLButtonElement>("left-operator-random");
  const rightOperatorRandomButton = getElement<HTMLButtonElement>("right-operator-random");
  const leftSkillRandomButton = getElement<HTMLButtonElement>("left-skill-random");
  const rightSkillRandomButton = getElement<HTMLButtonElement>("right-skill-random");
  const arenaSizeRandomButton = getElement<HTMLButtonElement>("arena-size-random");
  const setupRandomButton = getElement<HTMLButtonElement>("setup-random");
  const startButton = getElement<HTMLButtonElement>("start-button");
  const pauseButton = getElement<HTMLButtonElement>("pause-button");
  const restartButton = getElement<HTMLButtonElement>("restart-button");
  const resultBanner = getElement<HTMLDivElement>("result-banner");
  const timer = getElement<HTMLDivElement>("battle-timer");
  const tickerRow1 = getElement<HTMLDivElement>("ticker-row-1");
  const tickerRow2 = getElement<HTMLDivElement>("ticker-row-2");
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
    arenaSizeSelect,
    leftOperatorRandomButton,
    rightOperatorRandomButton,
    leftSkillRandomButton,
    rightSkillRandomButton,
    arenaSizeRandomButton,
    setupRandomButton,
    startButton,
    pauseButton,
    restartButton,
    speedButtons,
    resultBanner,
    timer,
    tickerRow1,
    tickerRow2,
    setOperatorOptions: (operators, leftId, rightId) => {
      fillSelect(leftSelect, operators, leftId);
      fillSelect(rightSelect, operators, rightId);
    },
    setSkillOptions: (leftSkills, rightSkills, leftSkillId, rightSkillId) => {
      fillSkillSelect(leftSkillSelect, leftSkills, leftSkillId);
      fillSkillSelect(rightSkillSelect, rightSkills, rightSkillId);
    },
    updateStatus: (snapshot) => {
      leftStatus.innerHTML = renderStatusCard(
        snapshot.left,
        snapshot.summonStatuses.filter((summon) => summon.ownerSide === "left"),
      );
      rightStatus.innerHTML = renderStatusCard(
        snapshot.right,
        snapshot.summonStatuses.filter((summon) => summon.ownerSide === "right"),
      );
      resultBanner.hidden = !snapshot.winnerName;
      timer.textContent = formatElapsed(snapshot.elapsed);
      updateTicker(tickerRow1, tickerRow2, snapshot.tickerMessages);
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

function renderStatusCard(
  operator: OperatorSnapshot,
  summonStatuses: SummonStatusSnapshot[] = [],
) {
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
      ${summonStatuses.length > 0
        ? `<div class="summon-card-container">${renderSummonCards(summonStatuses)}</div>`
        : ""}
    </article>
  `;
}

function toPercent(ratio: number) {
  return Math.max(0, Math.min(100, ratio * 100));
}

function renderSummonCards(
  summonStatuses: SummonStatusSnapshot[],
) {
  return summonStatuses
    .map((summon) => {
      const statusLabel = summon.isDeployed
        ? '<span class="summon-tag alive-tag">存活</span>'
        : summon.redeployRemaining > 0
          ? '<span class="summon-tag cd-tag">复活中</span>'
          : '<span class="summon-tag idle-tag">待部署</span>';

      if (summon.isDeployed) {
        const hpRatio = toPercent(summon.hp / summon.maxHp);
        const hasSp = summon.maxSp > 0;
        const spRatio = hasSp ? toPercent(summon.sp / summon.maxSp) : 100;
        const spText = hasSp
          ? `${Math.floor(summon.sp)} / ${summon.maxSp}`
          : "被动";

        return `
          <div class="summon-card alive">
            <div class="summon-card-header">
              <span class="summon-card-name">${escapeHtml(summon.name)}</span>
              ${statusLabel}
            </div>
            <div class="summon-bars">
              <div class="sbar-row">
                <div class="sbar-meta"><span>HP</span><span>${Math.ceil(summon.hp)} / ${summon.maxHp}</span></div>
                <div class="sbar-track"><div class="sbar-fill hp-fill" style="width:${hpRatio}%"></div></div>
              </div>
              <div class="sbar-row">
                <div class="sbar-meta"><span>SP</span><span>${spText}</span></div>
                <div class="sbar-track"><div class="sbar-fill ${summon.maxSp > 0 ? "sp-fill" : "sp-fill"}" style="width:${spRatio}%"></div></div>
              </div>
            </div>
            <div class="summon-stats">
              <div class="sstat-item"><span class="sstat-label">攻击</span><span class="sstat-value">${Math.round(summon.attack)}</span></div>
              <div class="sstat-item"><span class="sstat-label">防御</span><span class="sstat-value">${Math.round(summon.defense)}</span></div>
              <div class="sstat-item"><span class="sstat-label">法抗</span><span class="sstat-value">${Math.round(summon.resistance)}</span></div>
            </div>
            <div class="summon-card-skill">${escapeHtml(summon.skillName)}</div>
          </div>
        `;
      }

      // Redeploying / idle
      const cdProgress = summon.redeployTotal > 0
        ? toPercent(summon.redeployRemaining / summon.redeployTotal)
        : 0;

      return `
        <div class="summon-card cd">
          <div class="summon-card-header">
            <span class="summon-card-name">${escapeHtml(summon.name)}</span>
            ${statusLabel}
          </div>
          ${summon.redeployRemaining > 0
            ? `<div class="summon-cd-bar">
                <div class="sbar-meta"><span>倒计时</span><span>${Math.ceil(summon.redeployRemaining)}s</span></div>
                <div class="sbar-track"><div class="sbar-fill cd-fill" style="width:${cdProgress}%"></div></div>
              </div>`
            : ""}
        </div>
      `;
    })
    .join("");
}

function updateTicker(
  row1: HTMLDivElement,
  row2: HTMLDivElement,
  messages: TickerMessage[],
) {
  if (messages.length === 0) {
    row1.innerHTML = "";
    row2.innerHTML = "";
    return;
  }

  const primary = messages[0];
  const secondary = messages.length > 1 ? messages[1] : null;

  renderTickerRow(row1, primary, true);
  renderTickerRow(row2, secondary, false);
}

function renderTickerRow(
  row: HTMLDivElement,
  message: TickerMessage | null,
  isNew: boolean,
) {
  if (!message) {
    row.innerHTML = "";
    row.classList.remove("ticker-fade-in");
    return;
  }

  const fadeAge = Math.max(0, message.age - 2.2);
  const fadeProgress = Math.min(1, fadeAge / 0.8);
  const opacity = 1 - fadeProgress;
  const dotColor = message.level === "c" ? "#ff6b6b" : message.level === "s" ? "#c684ff" : "#f0a53a";
  const dotLabel = message.level === "c" ? "关键" : message.level === "s" ? "技能" : "";

  row.innerHTML = `
    <span class="ticker-dot" style="background:${dotColor}"></span>
    ${dotLabel ? `<span class="ticker-tag">${dotLabel}</span>` : ""}
    <span class="ticker-text">${escapeHtml(message.text)}</span>
  `;
  row.style.opacity = opacity.toFixed(3);

  if (isNew) {
    row.classList.add("ticker-fade-in");
  }
}

function escapeHtml(text: string) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function formatElapsed(elapsed: number) {
  const minutes = Math.floor(elapsed / 60);
  const seconds = Math.floor(elapsed % 60)
    .toString()
    .padStart(2, "0");

  return `${minutes}:${seconds}`;
}
