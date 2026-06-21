// src/validation/diagramValidation.test.ts
// Verifies user-facing validation diagnostics.

import { describe, expect, it } from "vitest";
import { buildFragmentGroups } from "../fragments/fragmentModel";
import type { ActionLabel, ConditionLabel, Edge, NodeBox } from "../model/types";
import { validateDiagram } from "./diagramValidation";

describe( "validateDiagram diagnostics", () => {
    it( "reports transition destination conflicts with display IDs and fragment titles", () => {
        const nodes: NodeBox[] = [
            { id: 21, displayId: "29", title: "Confirm replacement", x: 0, y: 0 },
            { id: 17, displayId: "2", title: "Text editor", x: 100, y: 0 },
            { id: 23, displayId: "20", title: "File menu", x: 200, y: 0 },
        ];
        const actions: ActionLabel[] = [
            {
                id: 30,
                originNodeId: 21,
                x: 50,
                y: 0,
                verb: "clicks",
                complement: "Cancel",
                title: "clicks \"Cancel\"",
            },
        ];
        const conditions: ConditionLabel[] = [];
        const edges: Edge[] = [
            { id: 1, from: { kind: "node", id: 21 }, to: { kind: "action", id: 30 }, style: "solid" },
            { id: 2, from: { kind: "action", id: 30 }, to: { kind: "node", id: 17 }, style: "solid" },
            { id: 3, from: { kind: "action", id: 30 }, to: { kind: "node", id: 23 }, style: "solid" },
        ];
        const fragmentId = buildFragmentGroups( { nodes, actions, conditions, edges } )[ 0 ].id;

        const issues = validateDiagram( {
            nodes,
            actions,
            conditions,
            edges,
            fragmentTitles: { [ fragmentId ]: "Replacement confirmation" },
        } );

        const conflict = issues.find( issue => issue.code === "TRANSITION_CONDITION_CONFLICT" );

        expect( conflict?.message ).toBe(
            "Conflict: UI 29 \"Confirm replacement\" with action clicks \"Cancel\" has multiple destinations (UI 2 \"Text editor\", UI 20 \"File menu\").",
        );
        expect( conflict?.refLabel ).toBe( "UI 29 \"Confirm replacement\"" );
        expect( conflict?.fragmentTitle ).toBe( "Replacement confirmation" );
    } );
} );
