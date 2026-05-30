import {
  Bodies,
  Body,
  Composite,
  Engine,
  Events,
  type IEventCollision,
} from "matter-js";
import type { OperatorDefinition } from "./types";

const wallThickness = 80;
const wallPhysics = {
  isStatic: true,
  restitution: 1,
  friction: 0,
  frictionStatic: 0,
};

export interface PhysicsWorld {
  engine: Engine;
  leftBody: Body;
  rightBody: Body;
  clear: () => void;
}

export function createPhysicsWorld(
  size: number,
  left: OperatorDefinition,
  right: OperatorDefinition,
  onOperatorCollision: () => void,
): PhysicsWorld {
  const engine = Engine.create({
    gravity: { x: 0, y: 0 },
  });

  const half = size / 2;
  const leftBody = Bodies.circle(size * 0.3, half, left.radius, {
    label: "operator:left",
    restitution: 1,
    friction: 0,
    frictionAir: 0,
    inertia: Infinity,
  });
  const rightBody = Bodies.circle(size * 0.7, half, right.radius, {
    label: "operator:right",
    restitution: 1,
    friction: 0,
    frictionAir: 0,
    inertia: Infinity,
  });

  const walls = [
    Bodies.rectangle(half, -wallThickness / 2, size, wallThickness, {
      ...wallPhysics,
      label: "wall:top",
    }),
    Bodies.rectangle(half, size + wallThickness / 2, size, wallThickness, {
      ...wallPhysics,
      label: "wall:bottom",
    }),
    Bodies.rectangle(-wallThickness / 2, half, wallThickness, size, {
      ...wallPhysics,
      label: "wall:left",
    }),
    Bodies.rectangle(size + wallThickness / 2, half, wallThickness, size, {
      ...wallPhysics,
      label: "wall:right",
    }),
  ];

  Composite.add(engine.world, [leftBody, rightBody, ...walls]);
  Body.setVelocity(leftBody, { x: 3.5, y: -2.8 });
  Body.setVelocity(rightBody, { x: 3.2, y: 3.1 });

  const collisionHandler = (event: IEventCollision<Engine>) => {
    for (const pair of event.pairs) {
      const labels = [pair.bodyA.label, pair.bodyB.label];

      if (
        labels.includes("operator:left") &&
        labels.includes("operator:right")
      ) {
        onOperatorCollision();
      }
    }
  };

  Events.on(engine, "collisionStart", collisionHandler);

  return {
    engine,
    leftBody,
    rightBody,
    clear: () => {
      Events.off(engine, "collisionStart", collisionHandler);
      Composite.clear(engine.world, false);
      Engine.clear(engine);
    },
  };
}
