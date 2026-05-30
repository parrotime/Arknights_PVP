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
    </section>

    <section class="battle-layout">
      <aside class="side-panel side-panel-blue">
        <div class="match-selectors">
          <label>
            蓝方干员
            <select id="left-operator"></select>
          </label>
          <label>
            蓝方技能
            <select id="left-skill"></select>
          </label>
        </div>
        <div class="status-panel" id="left-status"></div>
      </aside>
      <div class="arena-stack">
        <div class="battle-timer" id="battle-timer">0:00</div>
        <div class="arena-wrap">
          <canvas id="arena" width="648" height="648"></canvas>
          <div class="battle-cast" id="battle-cast" hidden></div>
          <div class="result-banner" id="result-banner" hidden></div>
        </div>
      </div>
      <aside class="side-panel side-panel-red">
        <div class="match-selectors">
          <label>
            红方干员
            <select id="right-operator"></select>
          </label>
          <label>
            红方技能
            <select id="right-skill"></select>
          </label>
        </div>
        <div class="status-panel" id="right-status"></div>
      </aside>
    </section>

    <section class="controls">
      <button id="start-button" type="button">开始</button>
      <button id="pause-button" type="button">暂停</button>
      <button id="restart-button" type="button">重开</button>
      <label class="arena-size-control">
        场地
        <select id="arena-size">
          <option value="350">350 × 350</option>
          <option value="500">500 × 500</option>
          <option value="648" selected>648 × 648</option>
          <option value="800">800 × 800</option>
        </select>
      </label>
      <div class="speed-group" aria-label="战斗速度">
        <button class="speed-button active" data-speed="1" type="button">x1</button>
        <button class="speed-button" data-speed="2" type="button">x2</button>
        <button class="speed-button" data-speed="4" type="button">x4</button>
        <button class="speed-button" data-speed="8" type="button">x8</button>
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
