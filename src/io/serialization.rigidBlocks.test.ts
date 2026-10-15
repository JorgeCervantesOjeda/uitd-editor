// src/io/serialization.rigidBlocks.test.ts
// Verifies project persistence and migration of visual RigidBlock metadata.

import { describe, expect, it } from "vitest";
import { makeProjectSnapshot, migrateProjectData, validateProjectData } from "./serialization";
import type { AppState } from "../state/types";

function makeState( overrides: Partial<AppState> = {} ): AppState {
    return {
        ...({} as AppState),
        nodes: [],
        actions: [],
        conditions: [],
        edges: [],
        fragmentTitles: {},
        rigidBlocks: [ { id: 1, members: [ { kind: "node", id: 4 } ] } ],
        panzoom: { x: 0, y: 0, zoom: 1 },
        viewBox: { w: 800, h: 600 },
        colorMode: "random",
        uniformColorKey: "fill",
        uniformTone: "mid",
        uniformIncludesActions: true,
        uniformIncludesConditions: true,
        ...overrides,
    } as AppState;
}

describe( "RigidBlock project persistence", () => {
    it( "roundTripsRigidBlocksInProjectData", () => {
        const snapshot = makeProjectSnapshot( makeState() );
        const validated = validateProjectData( snapshot );

        expect( validated.version ).toBe( 2 );
        expect( validated.rigidBlocks ).toEqual( [ { id: 1, members: [ { kind: "node", id: 4 } ] } ] );
    } );

    it( "migratesVersionOneProjectsWithNoBlocks", () => {
        const migrated = migrateProjectData( {
            version: 1,
            nodes: [],
            actions: [],
            conditions: [],
            edges: [],
        } );

        expect( migrated.version ).toBe( 2 );
        expect( migrated.rigidBlocks ).toEqual( [] );
        expect( migrated.nextRigidBlockId ).toBe( 1 );
    } );
} );
