// src/physics/force-simulator.test.ts
// Verifies geometry-aware UI root separation in the force simulator.

import { describe, expect, it } from "vitest";
import { ForceSimulator } from "./force-simulator";

function distanceBetween( left: { x: number; y: number }, right: { x: number; y: number } ) {
    return Math.hypot( right.x - left.x, right.y - left.y );
}

describe( "ForceSimulator", () => {
    it( "pushes overlapping UIs apart when they belong to different roots", () => {
        const simulator = new ForceSimulator(
            [
                { id: "N.1", base: { x: 0, y: 0 }, rootId: "N.1", collisionRadius: 60 },
                { id: "N.2", base: { x: 0, y: 0 }, rootId: "N.2", collisionRadius: 60 },
            ],
            [],
            {
                coulombC: 0,
                independentUICollisionK: 1,
                independentUICollisionPadding: 24,
                maxDisplacement: 200,
            }
        );

        const before = simulator.getPositions();
        simulator.step();
        const after = simulator.getPositions();

        expect( distanceBetween( after[ "N.1" ], after[ "N.2" ] ) )
            .toBeGreaterThan( distanceBetween( before[ "N.1" ], before[ "N.2" ] ) );
    } );

    it( "does not push UIs apart when they share the same root", () => {
        const simulator = new ForceSimulator(
            [
                { id: "N.1", base: { x: 0, y: 0 }, rootId: "N.1", collisionRadius: 60 },
                { id: "N.2", base: { x: 0, y: 0 }, rootId: "N.1", collisionRadius: 60 },
            ],
            [],
            {
                coulombC: 0,
                independentUICollisionK: 1,
                independentUICollisionPadding: 24,
                maxDisplacement: 200,
            }
        );

        simulator.step();
        const after = simulator.getPositions();

        expect( after[ "N.1" ] ).toEqual( { x: 0, y: 0 } );
        expect( after[ "N.2" ] ).toEqual( { x: 0, y: 0 } );
    } );
} );
