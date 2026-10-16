// src/physics/rigidBlockBodies.test.ts
// Verifies RigidBlock-to-body conversion and immutable local geometry.

import { describe, expect, it } from "vitest";
import { buildRigidBodyInputs } from "./rigidBlockBodies";
import { ForceSimulator } from "./force-simulator";
import { buildRigidBlockBounds } from "../rigidBlocks/rigidBlockModel";

const state = {
    nodes: [ { id: 1, x: 0, y: 0, title: "UI", w: 40, h: 30, parentId: null } ],
    actions: [ { id: 1, originNodeId: 1, x: 100, y: 0, title: "clicks \"Save\"", verb: "clicks" as const, complement: "Save", w: 80, h: 44 } ],
    conditions: [],
    edges: [],
    rigidBlocks: [ { id: 3, members: [ { kind: "node" as const, id: 1 }, { kind: "action" as const, id: 1 } ] } ],
};

describe( "RigidBlock bodies", () => {
    it( "buildsOneBodyFromMixedRigidBlockMembers", () => {
        const bodies = buildRigidBodyInputs( state );
        const bounds = buildRigidBlockBounds( { ...state, members: state.rigidBlocks[ 0 ].members } );

        expect( bodies ).toHaveLength( 1 );
        expect( bodies[ 0 ] ).toMatchObject( {
            id: "RB.3",
            members: [ { id: "N.1" }, { id: "A.1" } ],
            mass: 1,
        } );
        expect( bodies[ 0 ].members.map( member => member.offset ) ).toEqual( [
            { x: state.nodes[ 0 ].x - bounds!.center.x, y: state.nodes[ 0 ].y - bounds!.center.y },
            { x: state.actions[ 0 ].x - bounds!.center.x, y: state.actions[ 0 ].y - bounds!.center.y },
        ] );
    } );

    it( "usesRectangleCenterAndAreaForBodyGeometry", () => {
        const bodies = buildRigidBodyInputs( state );
        const bounds = buildRigidBlockBounds( { ...state, members: state.rigidBlocks[ 0 ].members } );

        expect( bounds ).not.toBeNull();
        expect( bodies[ 0 ] ).toMatchObject( {
            center: bounds!.center,
            width: bounds!.width,
            height: bounds!.height,
            area: 40 * 30 + 80 * 44,
        } );
        expect( bounds!.physicalArea ).toBe( 40 * 30 + 80 * 44 );
    } );

    it( "keepsMemberOffsetsAfterSteps", () => {
        const simulator = new ForceSimulator(
            [
                { id: "N.1", base: { x: 0, y: 0 }, rigidBodyId: "RB.3" },
                { id: "A.1", base: { x: 100, y: 0 }, rigidBodyId: "RB.3" },
                { id: "N.2", base: { x: 220, y: 0 }, rootId: "N.2" },
            ],
            [ { from: "A.1", to: "N.2", restLength: 20, springK: 0.1 } ],
            { coulombC: 0, frictionGamma: 0, timeStep: 1, dtMax: 1, maxDisplacement: 1000 },
            new Set( [ "RB.3" ] ),
            [ {
                id: "RB.3",
                center: { x: 50, y: 0 },
                width: 108,
                height: 52,
                area: 5616,
                mass: 1,
                members: [
                    { id: "N.1", offset: { x: -50, y: 0 } },
                    { id: "A.1", offset: { x: 50, y: 0 } },
                ],
            } ],
        );

        const before = simulator.getPositions();
        simulator.run( 3 );
        const after = simulator.getPositions();

        expect( after[ "A.1" ].x - after[ "N.1" ].x ).toBeCloseTo( before[ "A.1" ].x - before[ "N.1" ].x );
        expect( after[ "A.1" ].y - after[ "N.1" ].y ).toBeCloseTo( before[ "A.1" ].y - before[ "N.1" ].y );
        expect( after[ "N.1" ].x ).not.toBe( before[ "N.1" ].x );
    } );

    it( "revertsTheStepWhenRigidBodiesOverlap", () => {
        const simulator = new ForceSimulator(
            [
                { id: "N.1", base: { x: 0, y: 0 }, rigidBodyId: "RB.1" },
                { id: "N.2", base: { x: 20, y: 0 }, rigidBodyId: "RB.2" },
            ],
            [],
            {
                coulombC: 0,
                frictionGamma: 0,
                timeStep: 1,
                dtMax: 1,
                maxDisplacement: 1000,
                independentRootCollisionK: 0,
            },
            new Set( [ "RB.1", "RB.2" ] ),
            [
                {
                    id: "RB.1",
                    center: { x: 0, y: 0 },
                    width: 100,
                    height: 100,
                    area: 900,
                    mass: 1,
                    members: [ { id: "N.1", offset: { x: 0, y: 0 } } ],
                },
                {
                    id: "RB.2",
                    center: { x: 20, y: 0 },
                    width: 100,
                    height: 100,
                    area: 900,
                    mass: 1,
                    members: [ { id: "N.2", offset: { x: 0, y: 0 } } ],
                },
            ],
        );

        const before = simulator.getPositions();
        const result = simulator.run( 1 );
        const after = simulator.getPositions();

        expect( result ).toMatchObject( { overlapDetected: true } );
        expect( after ).toEqual( before );
    } );
} );
