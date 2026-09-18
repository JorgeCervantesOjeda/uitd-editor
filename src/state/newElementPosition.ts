// src/state/newElementPosition.ts
// Places a new element at a fixed radius from its origin with a uniformly random angle.

import type { Point } from "./types";

const NEW_ELEMENT_DISTANCE = 100;

export function newElementPosition( origin: Point ): Point {
    const angle = Math.random() * 2 * Math.PI;
    return {
        x: origin.x + NEW_ELEMENT_DISTANCE * Math.cos( angle ),
        y: origin.y + NEW_ELEMENT_DISTANCE * Math.sin( angle ),
    };
}
