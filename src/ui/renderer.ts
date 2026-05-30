import type { BattleSnapshot, OperatorSnapshot } from "../game/types";
import { displayCellsByRange, getRangeCellCenter } from "../game/ranges";

const arenaSize = 648;

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
  drawProjectiles(ctx, snapshot);
  drawOperator(ctx, snapshot.left);
  drawOperator(ctx, snapshot.right);
  drawDamageNumbers(ctx, snapshot);
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

  const cells = displayCellsByRange[operator.displayRangeId];
  const tileSize = operator.rangeTileSize;
  const isSkillRange = operator.displayRangeId !== operator.attackRangeId;

  ctx.save();
  ctx.fillStyle =
    isSkillRange
      ? "rgb(255 255 255 / 0.2)"
      : "rgb(255 255 255 / 0.12)";
  ctx.strokeStyle =
    isSkillRange
      ? "rgb(255 255 255 / 0.88)"
      : "rgb(255 255 255 / 0.68)";
  ctx.lineWidth = 2;

  for (const cell of cells) {
    const center = getRangeCellCenter(
      operator.x,
      operator.y,
      operator.facingAngle,
      operator.displayRangeId,
      cell,
      tileSize,
    );

    ctx.save();
    ctx.translate(center.x, center.y);
    ctx.rotate(operator.facingAngle);
    ctx.fillRect(-tileSize / 2, -tileSize / 2, tileSize, tileSize);
    ctx.strokeRect(-tileSize / 2, -tileSize / 2, tileSize, tileSize);
    ctx.restore();
  }

  ctx.restore();
}

function drawDamageNumbers(
  ctx: CanvasRenderingContext2D,
  snapshot: BattleSnapshot,
) {
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "900 26px Inter, Microsoft YaHei, sans-serif";
  ctx.lineWidth = 5;

  for (const number of snapshot.damageNumbers) {
    const progress = number.age / number.duration;
    const y = number.y - progress * 34;
    const alpha = 1 - progress;

    ctx.globalAlpha = Math.max(0, alpha);

    if (number.kind === "sp") {
      const amount = Math.max(1, Math.round(number.amount));

      ctx.strokeStyle = "rgb(0 28 82)";
      ctx.fillStyle = "#55b7ff";
      ctx.strokeText(`SP+${amount}`, number.x, y);
      ctx.fillText(`SP+${amount}`, number.x, y);
    } else {
      ctx.strokeStyle = "rgb(82 0 0)";
      ctx.fillStyle = "#ff3b30";
      ctx.strokeText(`-${number.amount}`, number.x, y);
      ctx.fillText(`-${number.amount}`, number.x, y);
    }
  }

  ctx.restore();
}

function drawProjectiles(
  ctx: CanvasRenderingContext2D,
  snapshot: BattleSnapshot,
) {
  ctx.save();
  ctx.lineCap = "round";

  for (const projectile of snapshot.projectiles) {
    const progress = Math.max(
      0,
      Math.min(1, projectile.age / projectile.duration),
    );
    const eased = 1 - (1 - progress) * (1 - progress);
    const x =
      projectile.fromX + (projectile.toX - projectile.fromX) * eased;
    const y =
      projectile.fromY + (projectile.toY - projectile.fromY) * eased;
    const angle = Math.atan2(
      projectile.toY - projectile.fromY,
      projectile.toX - projectile.fromX,
    );
    const alpha = Math.min(1, (1 - progress) * 1.35);
    const color =
      projectile.damageType === "arts"
        ? "103 210 255"
        : projectile.damageType === "true"
          ? "255 245 196"
          : "255 205 92";

    ctx.globalAlpha = alpha;
    ctx.strokeStyle = `rgb(${color} / 0.3)`;
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(x - Math.cos(angle) * 20, y - Math.sin(angle) * 20);
    ctx.lineTo(x, y);
    ctx.stroke();

    ctx.fillStyle = `rgb(${color})`;
    ctx.beginPath();
    ctx.arc(x, y, 5.5, 0, Math.PI * 2);
    ctx.fill();
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
  const spRatio = operator.maxSp > 0 ? operator.sp / operator.maxSp : 1;

  ctx.fillStyle = "#070a0f";
  ctx.fillRect(x, y, width, 6);
  ctx.fillStyle = "#4bb5ff";
  ctx.fillRect(x, y, width * hpRatio, 6);

  ctx.fillStyle = "#070a0f";
  ctx.fillRect(x, y + 8, width, 5);
  ctx.fillStyle = operator.isSkillActive ? "#0d6f35" : "#65e874";
  ctx.fillRect(x, y + 8, width * spRatio, 5);
}
