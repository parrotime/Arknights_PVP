import type { BattleSnapshot, OperatorSnapshot } from "../game/types";
import { attackRanges } from "../game/ranges";

const arenaSize = 720;

export function renderArena(
  canvas: HTMLCanvasElement,
  snapshot: BattleSnapshot,
) {
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    return;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawArenaBackground(ctx);
  drawAttackRange(ctx, snapshot.left);
  drawAttackRange(ctx, snapshot.right);
  drawOperator(ctx, snapshot.left);
  drawOperator(ctx, snapshot.right);
  drawCenterInfo(ctx, snapshot);
}

function drawArenaBackground(ctx: CanvasRenderingContext2D) {
  const gridSize = 60;

  ctx.fillStyle = "#171f2d";
  ctx.fillRect(0, 0, arenaSize, arenaSize);

  ctx.strokeStyle = "#263246";
  ctx.lineWidth = 1;

  for (let position = gridSize; position < arenaSize; position += gridSize) {
    ctx.beginPath();
    ctx.moveTo(position, 0);
    ctx.lineTo(position, arenaSize);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, position);
    ctx.lineTo(arenaSize, position);
    ctx.stroke();
  }

  ctx.strokeStyle = "#78aaff";
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, arenaSize - 4, arenaSize - 4);
}

function drawOperator(
  ctx: CanvasRenderingContext2D,
  operator: OperatorSnapshot,
) {
  ctx.save();
  ctx.translate(operator.x, operator.y);

  if (operator.hasShield) {
    ctx.beginPath();
    ctx.arc(0, 0, operator.radius + 9, 0, Math.PI * 2);
    ctx.fillStyle = "rgb(118 202 255 / 0.16)";
    ctx.fill();
    ctx.strokeStyle = "rgb(129 220 255 / 0.72)";
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  if (operator.isStunned) {
    ctx.beginPath();
    ctx.arc(0, 0, operator.radius + 13, 0, Math.PI * 2);
    ctx.strokeStyle = "rgb(255 229 122 / 0.9)";
    ctx.lineWidth = 4;
    ctx.setLineDash([8, 6]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.beginPath();
  ctx.arc(0, 0, operator.radius, 0, Math.PI * 2);
  ctx.fillStyle = operator.isAlive ? operator.color : "#566070";
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = operator.isAlive ? "#f7fbff" : "#2c3440";
  ctx.stroke();

  ctx.fillStyle = "#10151d";
  ctx.font = "700 17px Microsoft YaHei, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(operator.name, 0, 0, operator.radius * 1.65);

  drawMiniBars(ctx, operator);
  ctx.restore();
}

function drawAttackRange(
  ctx: CanvasRenderingContext2D,
  operator: OperatorSnapshot,
) {
  if (!operator.isAlive) {
    return;
  }

  const cells = attackRanges[operator.attackRangeId];
  const cos = Math.cos(operator.facingAngle);
  const sin = Math.sin(operator.facingAngle);
  const tileSize = operator.rangeTileSize;

  ctx.save();
  ctx.fillStyle =
    operator.attackRangeId === "amiyaChimera"
      ? "rgb(255 255 255 / 0.16)"
      : "rgb(255 255 255 / 0.09)";
  ctx.strokeStyle =
    operator.attackRangeId === "amiyaChimera"
      ? "rgb(255 255 255 / 0.4)"
      : "rgb(255 255 255 / 0.24)";
  ctx.lineWidth = 1;

  for (const cell of cells) {
    const localX = cell.x * tileSize;
    const localY = cell.y * tileSize;
    const cornerX = operator.x + localX * cos - localY * sin;
    const cornerY = operator.y + localX * sin + localY * cos;

    ctx.save();
    ctx.translate(cornerX, cornerY);
    ctx.rotate(operator.facingAngle);
    ctx.fillRect(0, 0, tileSize, tileSize);
    ctx.strokeRect(0, 0, tileSize, tileSize);
    ctx.restore();
  }

  ctx.restore();
}

function drawMiniBars(
  ctx: CanvasRenderingContext2D,
  operator: OperatorSnapshot,
) {
  const width = operator.radius * 2.2;
  const x = -width / 2;
  const y = operator.radius + 12;
  const hpRatio = operator.hp / operator.maxHp;
  const spRatio = operator.sp / operator.maxSp;

  ctx.fillStyle = "#070a0f";
  ctx.fillRect(x, y, width, 6);
  ctx.fillStyle = "#4bb5ff";
  ctx.fillRect(x, y, width * hpRatio, 6);

  ctx.fillStyle = "#070a0f";
  ctx.fillRect(x, y + 8, width, 5);
  ctx.fillStyle = "#65e874";
  ctx.fillRect(x, y + 8, width * spRatio, 5);
}

function drawCenterInfo(
  ctx: CanvasRenderingContext2D,
  snapshot: BattleSnapshot,
) {
  const minutes = Math.floor(snapshot.elapsed / 60);
  const seconds = Math.floor(snapshot.elapsed % 60)
    .toString()
    .padStart(2, "0");

  ctx.fillStyle = "rgb(8 12 18 / 0.6)";
  ctx.fillRect(arenaSize / 2 - 54, 14, 108, 34);
  ctx.fillStyle = "#e8f2ff";
  ctx.font = "800 18px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`${minutes}:${seconds}`, arenaSize / 2, 31);
}
