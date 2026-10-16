// src/rigidBlocks/rigidBlockModel.test.ts
// Verifies RigidBlock selection normalization, validation, and shared geometry.

import { describe, expect, it } from "vitest";
import {
    buildRigidBlockBounds,
    expandRigidBlockSelection,
    memberKey,
    reconcileRigidBlocks,
    validateRigidBlockSelection,
} from "./rigidBlockModel";

const baseInput = {
    nodes: [
        { id: 1, x: 20, y: 30, title: "Root", w: 40, h: 30, parentId: null },
        { id: 2, x: 80, y: 30, title: "Child", w: 30, h: 20, parentId: 1 },
        { id: 3, x: 140, y: 30, title: "Grandchild", w: 20, h: 20, parentId: 2 },
        { id: 4, x: 300, y: 30, title: "Other fragment", w: 20, h: 20, parentId: null },
    ],
    actions: [
        { id: 1, originNodeId: 1, x: 20, y: 90, title: "clicks \"Save\"", verb: "clicks" as const, complement: "Save" },
    ],
    conditions: [
        { id: 1, originActionId: 1, x: 20, y: 140, title: "ready" },
    ],
    edges: [],
};

describe( "RigidBlock domain model", () => {
    it( "expandsSelectedNodesToAllDescendants", () => {
        const expanded = expandRigidBlockSelection( {
            nodes: baseInput.nodes,
            actions: [],
            conditions: [],
            selection: { nodes: new Set( [ 1 ] ), actions: new Set(), conditions: new Set() },
        } );

        expect( expanded.nodes ).toEqual( new Set( [ 1, 2, 3 ] ) );
    } );

    it( "deduplicatesMembersAcrossMixedSelection", () => {
        const expanded = expandRigidBlockSelection( {
            nodes: baseInput.nodes,
            actions: baseInput.actions,
            conditions: baseInput.conditions,
            selection: {
                nodes: new Set( [ 1, 2 ] ),
                actions: new Set( [ 1 ] ),
                conditions: new Set( [ 1 ] ),
            },
        } );

        expect( expanded.members.map( memberKey ) ).toEqual( [
            "node:1",
            "node:2",
            "node:3",
            "action:1",
            "condition:1",
        ] );
    } );

    it( "rejectsMembersFromDifferentFragments", () => {
        const result = validateRigidBlockSelection( {
            ...baseInput,
            selection: { nodes: new Set( [ 1, 4 ] ), actions: new Set(), conditions: new Set() },
            existingBlocks: [],
        } );

        expect( result ).toMatchObject( { ok: false, error: { code: "multiple-fragments" } } );
    } );

    it( "rejectsMembershipAlreadyOwnedByAnotherBlock", () => {
        const result = validateRigidBlockSelection( {
            ...baseInput,
            selection: { nodes: new Set( [ 1 ] ), actions: new Set(), conditions: new Set() },
            existingBlocks: [ { id: 7, members: [ { kind: "node", id: 2 } ] } ],
        } );

        expect( result ).toMatchObject( { ok: false, error: { code: "member-overlap" } } );
    } );

    it( "acceptsMembersFromOneFragment", () => {
        const result = validateRigidBlockSelection( {
            ...baseInput,
            selection: { nodes: new Set( [ 1 ] ), actions: new Set( [ 1 ] ), conditions: new Set( [ 1 ] ) },
            existingBlocks: [],
        } );

        expect( result ).toMatchObject( {
            ok: true,
            members: [
                { kind: "node", id: 1 },
                { kind: "node", id: 2 },
                { kind: "node", id: 3 },
                { kind: "action", id: 1 },
                { kind: "condition", id: 1 },
            ],
        } );
    } );

    it( "buildsBoundsFromMeasuredElements", () => {
        const bounds = buildRigidBlockBounds( {
            members: [ { kind: "node", id: 1 }, { kind: "node", id: 2 } ],
            nodes: baseInput.nodes,
            actions: baseInput.actions,
            conditions: baseInput.conditions,
        } );

        expect( bounds ).toMatchObject( {
            left: -4,
            right: 99,
            top: 11,
            bottom: 49,
            width: 103,
            height: 38,
            physicalArea: 30 * 20 + 40 * 30,
        } );
    } );

    it( "usesBoundsCenterAsRigidBodyCenter", () => {
        const bounds = buildRigidBlockBounds( {
            members: [ { kind: "node", id: 1 }, { kind: "node", id: 2 } ],
            nodes: baseInput.nodes,
            actions: baseInput.actions,
            conditions: baseInput.conditions,
        } );

        expect( bounds!.center ).toEqual( { x: 47.5, y: 30 } );
    } );

    it( "reconcilesStaleAndOverlappingPersistedBlocks", () => {
        const result = reconcileRigidBlocks( {
            ...baseInput,
            rigidBlocks: [
                { id: 1, members: [ { kind: "node", id: 1 } ] },
                { id: 2, members: [ { kind: "node", id: 1 } ] },
                { id: 3, members: [ { kind: "node", id: 999 } ] },
            ],
        } );

        expect( result.rigidBlocks ).toEqual( [ { id: 1, members: [ { kind: "node", id: 1 } ] } ] );
        expect( result.removedBlockIds ).toEqual( [ 2, 3 ] );
    } );
} );
