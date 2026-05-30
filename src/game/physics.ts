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
  addOperatorBody: (
    label: string,
    definition: OperatorDefinition,
    x: number,
    y: number,
  ) => Body;
  removeBody: (body: Body) => void;
  clear: () => void;
}

export function createPhysicsWorld(
  size: number,
  left: OperatorDefinition,
  right: OperatorDefinition,
  onOperatorCollision: (bodyA: Body, bodyB: Body) => void,
): PhysicsWorld {
  const engine = Engine.create({
    gravity: { x: 0, y: 0 },
  });

  const half = size / 2;
  const leftBody = createOperatorBody("operator:left", left, size * 0.3, half);
  const rightBody = createOperatorBody("operator:right", right, size * 0.7, half);

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
        labels.every((label) => label.startsWith("operator:"))
      ) {
        onOperatorCollision(pair.bodyA, pair.bodyB);
      }
    }
  };

  Events.on(engine, "collisionStart", collisionHandler);

  return {
    engine,
    leftBody,
    rightBody,
    addOperatorBody: (label, definition, x, y) => {
      const body = createOperatorBody(label, definition, x, y);
      Composite.add(engine.world, body);
      return body;
    },
    removeBody: (body) => {
      Composite.remove(engine.world, body);
    },
    clear: () => {
      Events.off(engine, "collisionStart", collisionHandler);
      Composite.clear(engine.world, false);
      Engine.clear(engine);
    },
  };
}

function createOperatorBody(
  label: string,
  definition: OperatorDefinition,
  x: number,
  y: number,
) {
  return Bodies.circle(x, y, definition.radius, {
    label,
    restitution: 1,
    friction: 0,
    frictionAir: 0,
    inertia: Infinity,
  });
}
