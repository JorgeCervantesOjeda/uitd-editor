// src/validation/diagramValidation.test.ts
// Verifies user-facing validation diagnostics.

import { describe, expect, it } from "vitest";
import { buildFragmentGroups } from "../fragments/fragmentModel";
import type { ActionLabel, ConditionLabel, Edge, NodeBox } from "../model/types";
import { validateDiagram } from "./diagramValidation";

describe( "validateDiagram diagnostics", () => {
    it( "allows identical transitions repeated across different fragments", () => {
        const nodes: NodeBox[] = [
            { id: 1, displayId: "1", title: "Visual canvas", x: 0, y: 0 },
            { id: 2, displayId: "2", title: "Text editor", x: 100, y: 0 },
            { id: 101, displayId: "1", title: "Visual canvas", x: 0, y: 200 },
            { id: 102, displayId: "2", title: "Text editor", x: 100, y: 200 },
        ];
        const actions: ActionLabel[] = [
            {
                id: 10,
                originNodeId: 1,
                x: 50,
                y: 0,
                verb: "clicks",
                complement: "Edit UITDL",
                title: "clicks \"Edit UITDL\"",
            },
            {
                id: 110,
                originNodeId: 101,
                x: 50,
                y: 200,
                verb: "clicks",
                complement: "Edit UITDL",
                title: "clicks \"Edit UITDL\"",
            },
        ];
        const conditions: ConditionLabel[] = [];
        const edges: Edge[] = [
            { id: 1, from: { kind: "node", id: 1 }, to: { kind: "action", id: 10 }, style: "solid" },
            { id: 2, from: { kind: "action", id: 10 }, to: { kind: "node", id: 2 }, style: "solid" },
            { id: 3, from: { kind: "node", id: 101 }, to: { kind: "action", id: 110 }, style: "solid" },
            { id: 4, from: { kind: "action", id: 110 }, to: { kind: "node", id: 102 }, style: "solid" },
        ];

        const issues = validateDiagram( { nodes, actions, conditions, edges } );

        expect( issues.find( issue => issue.code === "TRANSITION_DUPLICATE" ) ).toBeUndefined();
        expect( issues.find( issue => issue.code === "TRANSITION_CONDITION_CONFLICT" ) ).toBeUndefined();
    } );

    it( "reports identical transitions duplicated inside the same fragment", () => {
        const nodes: NodeBox[] = [
            { id: 1, displayId: "1", title: "Visual canvas", x: 0, y: 0 },
            { id: 2, displayId: "2", title: "Text editor", x: 100, y: 0 },
        ];
        const actions: ActionLabel[] = [
            {
                id: 10,
                originNodeId: 1,
                x: 40,
                y: 0,
                verb: "clicks",
                complement: "Edit UITDL",
                title: "clicks \"Edit UITDL\"",
            },
            {
                id: 11,
                originNodeId: 1,
                x: 60,
                y: 0,
                verb: "clicks",
                complement: "Edit UITDL",
                title: "clicks \"Edit UITDL\"",
            },
        ];
        const conditions: ConditionLabel[] = [];
        const edges: Edge[] = [
            { id: 1, from: { kind: "node", id: 1 }, to: { kind: "action", id: 10 }, style: "solid" },
            { id: 2, from: { kind: "action", id: 10 }, to: { kind: "node", id: 2 }, style: "solid" },
            { id: 3, from: { kind: "node", id: 1 }, to: { kind: "action", id: 11 }, style: "solid" },
            { id: 4, from: { kind: "action", id: 11 }, to: { kind: "node", id: 2 }, style: "solid" },
        ];

        const issues = validateDiagram( { nodes, actions, conditions, edges } );

        expect( issues.find( issue => issue.code === "TRANSITION_DUPLICATE" ) ).toBeDefined();
    } );

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

    it( "rejects conditional and unconditional branches of one action in the same fragment", () => {
        const nodes: NodeBox[] = [
            { id: 1, displayId: "1", title: "Origin", x: 0, y: 0 },
            { id: 2, displayId: "2", title: "First", x: 100, y: 0 },
            { id: 3, displayId: "3", title: "Second", x: 100, y: 100 },
        ];
        const actions: ActionLabel[] = [
            { id: 10, originNodeId: 1, x: 40, y: 0, verb: "clicks", complement: "Continue", title: "clicks Continue" },
        ];
        const conditions: ConditionLabel[] = [
            { id: 20, originActionId: 10, x: 70, y: 100, title: "alternative" },
        ];
        const edges: Edge[] = [
            { id: 1, from: { kind: "node", id: 1 }, to: { kind: "action", id: 10 }, style: "solid" },
            { id: 2, from: { kind: "action", id: 10 }, to: { kind: "node", id: 2 }, style: "solid" },
            { id: 3, from: { kind: "action", id: 10 }, to: { kind: "condition", id: 20 }, style: "solid" },
            { id: 4, from: { kind: "condition", id: 20 }, to: { kind: "node", id: 3 }, style: "solid" },
        ];

        const issues = validateDiagram( { nodes, actions, conditions, edges } );

        expect( issues.some( issue => issue.code === "ACTION_CONDITION_INCONSISTENT" ) ).toBe( true );
    } );
} );
