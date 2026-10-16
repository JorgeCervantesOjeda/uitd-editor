// src/physics/force-simulator.test.ts
// Verifies geometry-aware independent root separation in the force simulator.

import { describe, expect, it } from "vitest";
import { ForceSimulator } from "./force-simulator";

function distanceBetween( left: { x: number; y: number }, right: { x: number; y: number } ) {
    return Math.hypot( right.x - left.x, right.y - left.y );
}

describe( "ForceSimulator", () => {
    it( "uses twice the normal Coulomb repulsion for two UIs", () => {
        const options = {
            springK: 0,
            coulombC: 100,
            frictionGamma: 0,
            timeStep: 1,
            dtMax: 1,
            uiCoulombRepulsionFactor: 2,
            maxDisplacement: 1000,
            threshLow: 0,
            threshHigh: 1000,
        };
        const uiSimulator = new ForceSimulator(
            [
                { id: "N.1", base: { x: 0, y: 0 }, rootId: "N.1", repulsionKind: "ui" },
                { id: "N.2", base: { x: 100, y: 0 }, rootId: "N.2", repulsionKind: "ui" },
            ],
            [ { from: "N.1", to: "N.2" } ],
            options
        );
        const particleSimulator = new ForceSimulator(
            [
                { id: "A.1", base: { x: 0, y: 0 }, repulsionKind: "particle" },
                { id: "C.1", base: { x: 100, y: 0 }, repulsionKind: "particle" },
            ],
            [ { from: "A.1", to: "C.1" } ],
            options
        );

        const initialUiDistance = distanceBetween( uiSimulator.getPositions()[ "N.1" ], uiSimulator.getPositions()[ "N.2" ] );
        const initialParticleDistance = distanceBetween( particleSimulator.getPositions()[ "A.1" ], particleSimulator.getPositions()[ "C.1" ] );
        uiSimulator.step();
        particleSimulator.step();
        const uiDistanceIncrease = distanceBetween( uiSimulator.getPositions()[ "N.1" ], uiSimulator.getPositions()[ "N.2" ] ) - initialUiDistance;
        const particleDistanceIncrease = distanceBetween( particleSimulator.getPositions()[ "A.1" ], particleSimulator.getPositions()[ "C.1" ] ) - initialParticleDistance;

        expect( uiDistanceIncrease ).toBeCloseTo( particleDistanceIncrease * 2 );
    } );

    it( "uses edge-specific equilibrium distance and spring strength", () => {
        const simulator = new ForceSimulator(
            [
                { id: "A.1", base: { x: 0, y: 0 } },
                { id: "C.1", base: { x: 200, y: 0 } },
            ],
            [ { from: "A.1", to: "C.1", restLength: 100, springK: 0.1 } ],
            {
                springK: 0,
                coulombC: 0,
                frictionGamma: 0,
                timeStep: 1,
                dtMax: 1,
                maxDisplacement: 1000,
                threshLow: 0,
                threshHigh: 1000,
            }
        );

        simulator.step();

        expect( simulator.getPositions()[ "A.1" ] ).toEqual( { x: 10, y: 0 } );
        expect( simulator.getPositions()[ "C.1" ] ).toEqual( { x: 190, y: 0 } );
    } );

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

    it( "capsRigidBlockOverlapForce", () => {
        const simulator = new ForceSimulator(
            [
                { id: "N.1", base: { x: 0, y: 0 }, rigidBodyId: "RB.1" },
                { id: "N.2", base: { x: 9, y: 0 }, rigidBodyId: "RB.2" },
            ],
            [],
            {
                coulombC: 0,
                frictionGamma: 0,
                timeStep: 1,
                dtMax: 1,
                maxDisplacement: 1000,
                independentRootCollisionK: 100,
                independentRootCollisionPadding: 0,
                maxRigidBlockOverlapForce: 5,
            },
            new Set( [ "RB.1", "RB.2" ] ),
            [
                {
                    id: "RB.1",
                    center: { x: 0, y: 0 },
                    width: 10,
                    height: 10,
                    area: 100,
                    mass: 1,
                    members: [ { id: "N.1", offset: { x: 0, y: 0 } } ],
                },
                {
                    id: "RB.2",
                    center: { x: 9, y: 0 },
                    width: 10,
                    height: 10,
                    area: 100,
                    mass: 1,
                    members: [ { id: "N.2", offset: { x: 0, y: 0 } } ],
                },
            ],
        );

        const before = simulator.getPositions();
        simulator.step();
        const after = simulator.getPositions();

        expect( distanceBetween( after[ "N.1" ], after[ "N.2" ] ) )
            .toBeLessThanOrEqual( distanceBetween( before[ "N.1" ], before[ "N.2" ] ) + 10 );
    } );

    it( "does not report a visible overlap when rigid blocks are separated inside the collision padding", () => {
        const simulator = new ForceSimulator(
            [
                { id: "N.1", base: { x: 0, y: 0 }, rigidBodyId: "RB.1" },
                { id: "N.2", base: { x: 15, y: 0 }, rigidBodyId: "RB.2" },
            ],
            [],
            {
                coulombC: 0,
                frictionGamma: 0,
                timeStep: 1,
                independentRootCollisionK: 1,
                independentRootCollisionPadding: 32,
                maxRigidBlockOverlapForce: 0,
                maxDisplacement: 200,
            },
            new Set( [ "RB.1", "RB.2" ] ),
            [
                {
                    id: "RB.1",
                    center: { x: 0, y: 0 },
                    width: 10,
                    height: 10,
                    area: 100,
                    mass: 1,
                    members: [ { id: "N.1", offset: { x: 0, y: 0 } } ],
                },
                {
                    id: "RB.2",
                    center: { x: 15, y: 0 },
                    width: 10,
                    height: 10,
                    area: 100,
                    mass: 1,
                    members: [ { id: "N.2", offset: { x: 0, y: 0 } } ],
                },
            ],
        );

        const stats = simulator.step();

        expect( stats.overlapDetected ).toBe( false );
        expect( stats.overlapPairs ).toEqual( [] );
    } );

    it( "does not report a visible overlap when a normal element only touches a rigid block corner", () => {
        const simulator = new ForceSimulator(
            [
                { id: "N.1", base: { x: 0, y: 0 }, collisionRadius: 50, rigidBodyId: "RB.1" },
                { id: "A.1", base: { x: 55, y: 10 }, collisionRadius: 50, collisionWidth: 100, collisionHeight: 10 },
            ],
            [],
            {
                coulombC: 0,
                frictionGamma: 0,
                timeStep: 1,
                independentRootCollisionK: 0,
                independentRootCollisionPadding: 32,
                maxRigidBlockOverlapForce: 0,
                maxDisplacement: 200,
            },
            new Set( [ "RB.1", "A.1" ] ),
            [
                {
                    id: "RB.1",
                    center: { x: 0, y: 0 },
                    width: 100,
                    height: 10,
                    area: 1000,
                    mass: 1,
                    members: [ { id: "N.1", offset: { x: 45, y: 0 } } ],
                },
            ],
        );

        const stats = simulator.step();

        expect( stats.overlapDetected ).toBe( false );
        expect( stats.overlapPairs ).toEqual( [] );
    } );
} );
