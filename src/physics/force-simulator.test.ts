// src/physics/force-simulator.test.ts
// Verifies geometry-aware independent root separation in the force simulator.

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
                independentRootCollisionK: 1,
                independentRootCollisionPadding: 24,
                maxDisplacement: 200,
            }
        );

        const before = simulator.getPositions();
        simulator.step();
        const after = simulator.getPositions();

        expect( distanceBetween( after[ "N.1" ], after[ "N.2" ] ) )
            .toBeGreaterThan( distanceBetween( before[ "N.1" ], before[ "N.2" ] ) );
    } );

    it( "pushes overlapping actions and conditions apart because each particle is its own root", () => {
        const simulator = new ForceSimulator(
            [
                { id: "A.1", base: { x: 0, y: 0 }, collisionRadius: 45 },
                { id: "C.1", base: { x: 0, y: 0 }, collisionRadius: 45 },
            ],
            [],
            {
                coulombC: 0,
                independentRootCollisionK: 1,
                independentRootCollisionPadding: 24,
                maxDisplacement: 200,
            }
        );

        const before = simulator.getPositions();
        simulator.step();
        const after = simulator.getPositions();

        expect( distanceBetween( after[ "A.1" ], after[ "C.1" ] ) )
            .toBeGreaterThan( distanceBetween( before[ "A.1" ], before[ "C.1" ] ) );
    } );

    it( "pushes an overlapping UI and action apart because their roots differ", () => {
        const simulator = new ForceSimulator(
            [
                { id: "N.1", base: { x: 0, y: 0 }, rootId: "N.1", collisionRadius: 60 },
                { id: "A.1", base: { x: 0, y: 0 }, collisionRadius: 45 },
            ],
            [],
            {
                coulombC: 0,
                independentRootCollisionK: 1,
                independentRootCollisionPadding: 24,
                maxDisplacement: 200,
            }
        );

        const before = simulator.getPositions();
        simulator.step();
        const after = simulator.getPositions();

        expect( distanceBetween( after[ "N.1" ], after[ "A.1" ] ) )
            .toBeGreaterThan( distanceBetween( before[ "N.1" ], before[ "A.1" ] ) );
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
                independentRootCollisionK: 1,
                independentRootCollisionPadding: 24,
                maxDisplacement: 200,
            }
        );

        simulator.step();
        const after = simulator.getPositions();

        expect( after[ "N.1" ] ).toEqual( { x: 0, y: 0 } );
        expect( after[ "N.2" ] ).toEqual( { x: 0, y: 0 } );
    } );
} );
