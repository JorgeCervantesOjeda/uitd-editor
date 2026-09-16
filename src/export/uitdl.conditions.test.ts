// src/export/uitdl.conditions.test.ts
// Verifies condition guard export edge cases from the visual canvas.

import { describe, expect, it } from "vitest";
import type { AppState } from "../state/types";
import { exportToUITDLWithLocations } from "./uitdl";

describe( "exportToUITDL conditions", () => {
    it( "exports a condition whose visible label is empty as a real guard", () => {
        const state = {
            nodes: [
                {
                    id: 1,
                    x: 100,
                    y: 100,
                    title: "Start",
                    displayId: "1",
                },
                {
                    id: 2,
                    x: 320,
                    y: 100,
                    title: "End",
                    displayId: "2",
                },
            ],
            actions: [
                {
                    id: 10,
                    originNodeId: 1,
                    x: 180,
                    y: 100,
                    verb: "clicks",
                    complement: "Continue",
                    title: 'clicks "Continue"',
                },
            ],
            conditions: [
                {
                    id: 20,
                    originActionId: 10,
                    x: 250,
                    y: 100,
                    title: "empty",
                },
            ],
            edges: [
                {
                    id: 1,
                    from: { kind: "node", id: 1 },
                    to: { kind: "action", id: 10 },
                    style: "solid",
                },
                {
                    id: 2,
                    from: { kind: "action", id: 10 },
                    to: { kind: "condition", id: 20 },
                    style: "dashed2",
                },
                {
                    id: 3,
                    from: { kind: "condition", id: 20 },
                    to: { kind: "node", id: 2 },
                    style: "dashed1",
                },
            ],
            fragmentTitles: {},
        } as unknown as AppState;

        const exported = exportToUITDLWithLocations( state );

        expect( exported.text ).toContain(
            'TRANSITION from 1 to 2 if user clicks "Continue" AND "empty";'
        );
        expect( exported.locations.conditions.get( 20 ) ).toBeDefined();
    } );
} );
