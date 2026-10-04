// src/export/uitdl.selection.test.ts
// Verifies that selection exports keep all UI declarations but only selected fragments.

import { describe, expect, it } from "vitest";
import type { AppState } from "../state/types";
import { filterUITDLToSelectedFragments } from "./filterUITDLFragments";
import { exportToUITDLWithLocations } from "./uitdl";

describe( "exportToUITDL fragment selection", () => {
    it( "keeps the complete UITDL model except fragments that were not selected", () => {
        const state = {
            nodes: [
                { id: 1, x: 0, y: 0, title: "First start", displayId: "1" },
                { id: 2, x: 200, y: 0, title: "First end", displayId: "2" },
                { id: 3, x: 0, y: 200, title: "Second start", displayId: "3" },
                { id: 4, x: 200, y: 200, title: "Second end", displayId: "4" },
                { id: 5, x: 0, y: 400, title: "Third start", displayId: "5" },
                { id: 6, x: 200, y: 400, title: "Third end", displayId: "6" },
            ],
            actions: [
                { id: 10, originNodeId: 1, x: 100, y: 0, verb: "clicks", complement: "First", title: "clicks First" },
                { id: 20, originNodeId: 3, x: 100, y: 200, verb: "clicks", complement: "Second", title: "clicks Second" },
                { id: 30, originNodeId: 5, x: 100, y: 400, verb: "clicks", complement: "Third", title: "clicks Third" },
            ],
            conditions: [],
            edges: [
                { id: 1, from: { kind: "node", id: 1 }, to: { kind: "action", id: 10 }, style: "solid" },
                { id: 2, from: { kind: "action", id: 10 }, to: { kind: "node", id: 2 }, style: "dashed1" },
                { id: 3, from: { kind: "node", id: 3 }, to: { kind: "action", id: 20 }, style: "solid" },
                { id: 4, from: { kind: "action", id: 20 }, to: { kind: "node", id: 4 }, style: "dashed1" },
                { id: 5, from: { kind: "node", id: 5 }, to: { kind: "action", id: 30 }, style: "solid" },
                { id: 6, from: { kind: "action", id: 30 }, to: { kind: "node", id: 6 }, style: "dashed1" },
            ],
            fragmentTitles: {
                "action:10|node:1|node:2": "First fragment",
                "action:20|node:3|node:4": "Second fragment",
                "action:30|node:5|node:6": "Third fragment",
            },
        } as unknown as AppState;

        const completeExport = exportToUITDLWithLocations( state );
        const exported = filterUITDLToSelectedFragments(
            completeExport,
            new Set( [ "action:10|node:1|node:2", "action:20|node:3|node:4" ] )
        );

        expect( completeExport.text ).toContain( 'FRAGMENT "Second fragment"' );
        expect( exported ).toContain( 'UI 1 "First start" actions {' );
        expect( exported ).toContain( 'UI 4 "Second end" actions {' );
        expect( exported ).toContain( 'UI 6 "Third end" actions {' );
        expect( exported ).toContain( 'FRAGMENT "First fragment"' );
        expect( exported ).toContain( 'FRAGMENT "Second fragment"' );
        expect( exported ).not.toContain( 'FRAGMENT "Third fragment"' );
        expect( exported ).toContain( 'TRANSITION from 1 to 2 if user clicks "First";' );
        expect( exported ).toContain( 'TRANSITION from 3 to 4 if user clicks "Second";' );
        expect( exported ).not.toContain( 'TRANSITION from 5 to 6 if user clicks "Third";' );
    } );
} );
