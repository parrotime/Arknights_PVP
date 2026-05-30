import "./style.css";
import { Game } from "./game/Game";
import { createBattleUi } from "./ui/dom";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("App root not found.");
}

app.innerHTML = `
  <main class="shell">
    <section class="topbar">
      <div>
        <h1>明日方舟干员斗蛐蛐</h1>
        <p>本地自动战斗 Demo</p>
      </div>
      <div class="match-selectors">
        <label>
          蓝方
          <select id="left-operator"></select>
        </label>
        <label>
          红方
          <select id="right-operator"></select>
        </label>
      </div>
    </section>

    <section class="battle-layout">
      <aside class="status-panel" id="left-status"></aside>
      <div class="arena-wrap">
        <canvas id="arena" width="720" height="720"></canvas>
        <div class="result-banner" id="result-banner" hidden></div>
      </div>
      <aside class="status-panel" id="right-status"></aside>
    </section>

    <section class="controls">
      <button id="start-button" type="button">开始</button>
      <button id="pause-button" type="button">暂停</button>
      <button id="restart-button" type="button">重开</button>
      <div class="speed-group" aria-label="战斗速度">
        <button class="speed-button active" data-speed="1" type="button">x1</button>
        <button class="speed-button" data-speed="2" type="button">x2</button>
        <button class="speed-button" data-speed="4" type="button">x4</button>
      </div>
    </section>

    <section class="log-panel">
      <div class="log-title">战斗日志</div>
      <ol id="battle-log"></ol>
    </section>
  </main>
`;

const ui = createBattleUi();
const game = new Game(ui);

game.mount();
