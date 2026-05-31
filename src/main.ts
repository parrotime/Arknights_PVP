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
            <div class="selector-row">
              <select id="left-operator"></select>
              <button class="dice-button" id="left-operator-random" type="button" title="随机蓝方干员" aria-label="随机蓝方干员">🎲</button>
            </div>
          </label>
          <label>
            蓝方技能
            <div class="selector-row">
              <select id="left-skill"></select>
              <button class="dice-button" id="left-skill-random" type="button" title="随机蓝方技能" aria-label="随机蓝方技能">🎲</button>
            </div>
          </label>
        </div>
        <div class="status-panel" id="left-status"></div>
      </aside>
      <div class="arena-stack">
        <div class="battle-timer" id="battle-timer">0:00</div>
        <div class="ticker-bar">
          <div class="ticker-row" id="ticker-row-1"></div>
          <div class="ticker-row" id="ticker-row-2"></div>
        </div>
        <div class="arena-wrap">
          <canvas id="arena" width="648" height="648"></canvas>
          <div class="result-banner" id="result-banner" hidden></div>
        </div>
      </div>
      <aside class="side-panel side-panel-red">
        <div class="match-selectors">
          <label>
            红方干员
            <div class="selector-row">
              <select id="right-operator"></select>
              <button class="dice-button" id="right-operator-random" type="button" title="随机红方干员" aria-label="随机红方干员">🎲</button>
            </div>
          </label>
          <label>
            红方技能
            <div class="selector-row">
              <select id="right-skill"></select>
              <button class="dice-button" id="right-skill-random" type="button" title="随机红方技能" aria-label="随机红方技能">🎲</button>
            </div>
          </label>
        </div>
        <div class="status-panel" id="right-status"></div>
      </aside>
    </section>

    <section class="controls">
      <button id="start-button" type="button">开始</button>
      <button id="pause-button" type="button">暂停</button>
      <button id="restart-button" type="button">重开</button>
      <button class="dice-button wide-dice-button" id="setup-random" type="button" title="随机双方站位和朝向" aria-label="随机双方站位和朝向">🎲 站位</button>
      <label class="arena-size-control">
        场地
        <div class="selector-row">
          <select id="arena-size">
            <option value="350">350 x 350</option>
            <option value="500">500 x 500</option>
            <option value="648" selected>648 x 648</option>
            <option value="800">800 x 800</option>
          </select>
          <button class="dice-button" id="arena-size-random" type="button" title="随机场地大小" aria-label="随机场地大小">🎲</button>
        </div>
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
