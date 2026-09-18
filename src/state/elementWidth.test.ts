// src/state/elementWidth.test.ts
// Checks text-driven width limits, anchored resizing, nesting, and undo behavior.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useAppStore } from "./store";
import { resizeElementWidth } from "./elementWidth";
import { withMeasuredNodeBox, withMeasuredActionLabel, withMeasuredConditionLabel } from "../layout/measurement";

const initial = useAppStore.getState();
const title = "Alpha Beta Gamma Delta";

describe( "element width", () => {
    beforeEach( () => useAppStore.setState( {
        ...initial,
        nodes: [ withMeasuredNodeBox( { id: 1, displayId: "1", title, x: 200, y: 200, wrap: 10 } ) ],
        actions: [ withMeasuredActionLabel( { id: 1, originNodeId: 1, verb: "clicks", complement: title, title, x: 400, y: 200, wrap: 10 } ) ],
        conditions: [ withMeasuredConditionLabel( { id: 1, originActionId: 1, title, x: 600, y: 200, wrap: 10 } ) ],
    }, true ) );
    afterEach( () => useAppStore.setState( initial, true ) );

    it.each( [
        { kind: "node" as const, key: "nodes" as const, maxWidth: 240 },
        { kind: "action" as const, key: "actions" as const, maxWidth: 222 },
        { kind: "condition" as const, key: "conditions" as const, maxWidth: 238 },
    ] )( "resizes a $kind within text limits with its left edge fixed", ( { kind, key, maxWidth } ) => {
        const before = useAppStore.getState()[ key ][ 0 ];
        const left = before.x - before.w! / 2;
        resizeElementWidth( { kind, id: 1 }, 100 );
        const narrow = useAppStore.getState()[ key ][ 0 ];
        expect( narrow.w ).toBe( 100 );
        expect( narrow.x - narrow.w! / 2 ).toBe( left );
        expect( narrow.h ).toBeGreaterThan( before.h! );
        resizeElementWidth( { kind, id: 1 }, 10000 );
        const wide = useAppStore.getState()[ key ][ 0 ];
        expect( wide.w ).toBe( maxWidth );
        expect( wide.x - wide.w! / 2 ).toBe( left );
        expect( wide.h ).toBeLessThan( narrow.h! );
    } );

    it( "groups an entire drag into one undo entry", () => {
        const before = useAppStore.getState().nodes;
        useAppStore.getState().beginEditingSession( [ "nodes", "actions", "conditions" ] );
        resizeElementWidth( { kind: "node", id: 1 }, 120 );
        resizeElementWidth( { kind: "node", id: 1 }, 200 );
        useAppStore.getState().commitEditingSession();
        expect( useAppStore.getState().historyUndo ).toHaveLength( 1 );
        useAppStore.getState().undo();
        expect( useAppStore.getState().nodes ).toEqual( before );
    } );

    it( "supports unbroken words, empty text, and text longer than 80 characters", () => {
        useAppStore.setState( { conditions: [ { id: 1, originActionId: 1, title: "X".repeat( 100 ), x: 0, y: 0 } ] } );
        resizeElementWidth( { kind: "condition", id: 1 }, 1 );
        expect( useAppStore.getState().conditions[ 0 ].w ).toBe( 940 );
        expect( useAppStore.getState().conditions[ 0 ].wrap ).toBe( 100 );
        useAppStore.setState( { conditions: [ { id: 1, originActionId: 1, title: "", x: 0, y: 0 } ] } );
        resizeElementWidth( { kind: "condition", id: 1 }, 10000 );
        expect( useAppStore.getState().conditions[ 0 ].w ).toBe( 70 );
    } );

    it( "keeps children inside a resized container and expands ancestors for a wider child", () => {
        useAppStore.setState( { nodes: [
            { id: 1, title: "Parent", x: 200, y: 200, w: 300, h: 200 },
            withMeasuredNodeBox( { id: 2, title, x: 200, y: 230, wrap: 6, parentId: 1 } ),
        ] } );
        const childBefore = useAppStore.getState().nodes[ 1 ];
        resizeElementWidth( { kind: "node", id: 1 }, 1 );
        let [ parent, child ] = useAppStore.getState().nodes;
        expect( parent.x + parent.w! / 2 ).toBeGreaterThan( child.x + child.w! / 2 );
        expect( child.x ).toBe( childBefore.x );
        resizeElementWidth( { kind: "node", id: 2 }, 10000 );
        [ parent, child ] = useAppStore.getState().nodes;
        expect( child.w ).toBe( 222 );
        expect( parent.x + parent.w! / 2 ).toBeGreaterThan( child.x + child.w! / 2 );
        expect( child.x - child.w! / 2 ).toBe( childBefore.x - childBefore.w! / 2 );
    } );
} );
