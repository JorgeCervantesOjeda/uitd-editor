// src/fragments/fragmentBounds.test.ts
// Verifies shared fragment bounds used by canvas frames and grid compaction.

import { describe, expect, it } from "vitest";
import type { ActionLabel, Edge, NodeBox } from "../model/types";
import { buildFragmentBounds, FRAGMENT_FRAME_PADDING } from "./fragmentBounds";

describe( "buildFragmentBounds", () => {
    it( "computes padded bounds for connected fragment entities", () => {
        const nodes: NodeBox[] = [
            { id: 1, x: 100, y: 100, title: "First", w: 20, h: 10 },
        ];
        const actions: ActionLabel[] = [
            {
                id: 1,
                originNodeId: 1,
                x: 200,
                y: 100,
                verb: "clicks",
                complement: "Next",
                title: "clicks \"Next\"",
                w: 40,
                h: 20,
            },
        ];
        const edges: Edge[] = [
            { id: 1, from: { kind: "node", id: 1 }, to: { kind: "action", id: 1 }, style: "solid" },
        ];

        const [ bounds ] = buildFragmentBounds( {
            nodes,
            actions,
            conditions: [],
            edges,
        } );

        expect( bounds.x ).toBe( 90 - FRAGMENT_FRAME_PADDING );
        expect( bounds.y ).toBe( 90 - FRAGMENT_FRAME_PADDING );
        expect( bounds.w ).toBe( 130 + 2 * FRAGMENT_FRAME_PADDING );
        expect( bounds.h ).toBe( 20 + 2 * FRAGMENT_FRAME_PADDING );
        expect( bounds.nodeIds ).toEqual( [ 1 ] );
        expect( bounds.actionIds ).toEqual( [ 1 ] );
    } );
} );
