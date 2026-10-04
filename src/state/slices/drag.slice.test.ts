// src/state/slices/drag.slice.test.ts
// Verifica el anidamiento provisional durante el arrastre y su reversión en jerarquías profundas.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useAppStore } from "../store";
import { withMeasuredNodeBox } from "../../layout/measurement";

const initial = useAppStore.getState();

function setDiagram( nodes: Parameters<typeof withMeasuredNodeBox>[ 0 ][] ) {
    useAppStore.setState( {
        ...initial,
        nodes: nodes.map( withMeasuredNodeBox ),
        selection: new Set(),
        historyUndo: [],
        historyRedo: [],
        historyBytes: 0,
    }, true );
}

describe( "drag preview nesting", () => {
    beforeEach( () => {
        setDiagram( [
            { id: 1, displayId: "1", title: "Container", x: 200, y: 200 },
            { id: 2, displayId: "2", title: "Dragged", x: 500, y: 200 },
        ] );
    } );

    afterEach( () => useAppStore.setState( initial, true ) );

    it( "expands the target before the node is released and restores it when the node leaves", () => {
        const before = useAppStore.getState().nodes.map( node => ( { ...node } ) );
        useAppStore.setState( { selection: new Set( [ 2 ] ) } );

        useAppStore.getState().beginCombinedDrag( { x: 500, y: 200 }, new Set( [ 2 ] ), new Set(), new Set() );
        useAppStore.getState().updateCombinedDrag( { x: 200, y: 200 }, false );

        const preview = useAppStore.getState().nodes;
        expect( preview.find( node => node.id === 2 )?.parentId ).toBe( 1 );
        expect( preview.find( node => node.id === 1 )?.h ).toBeGreaterThan( before.find( node => node.id === 1 )!.h! );
        expect( useAppStore.getState().historyUndo ).toHaveLength( 0 );

        useAppStore.getState().updateCombinedDrag( { x: 500, y: 200 }, false );

        const restored = useAppStore.getState().nodes;
        expect( restored.find( node => node.id === 2 )?.parentId ?? null ).toBeNull();
        expect( restored.find( node => node.id === 1 )?.h ).toBe( before.find( node => node.id === 1 )?.h );
    } );

    it( "grows every affected ancestor while preserving existing children", () => {
        setDiagram( [
            { id: 1, displayId: "1", title: "Outer", x: 240, y: 240 },
            { id: 2, displayId: "2", title: "Inner", x: 240, y: 240, parentId: 1 },
            { id: 3, displayId: "3", title: "Existing A", x: 220, y: 340, parentId: 2 },
            { id: 4, displayId: "4", title: "Existing B", x: 300, y: 340, parentId: 2 },
            { id: 5, displayId: "5", title: "Dragged node with a long title", wrap: 5, x: 600, y: 240 },
        ] );
        useAppStore.getState().relayoutContainer( 2 );
        useAppStore.getState().relayoutAncestors( 2 );
        const before = useAppStore.getState().nodes.map( node => ( { ...node } ) );
        useAppStore.setState( { selection: new Set( [ 5 ] ) } );

        useAppStore.getState().beginCombinedDrag( { x: 600, y: 240 }, new Set( [ 5 ] ), new Set(), new Set() );
        useAppStore.getState().updateCombinedDrag( { x: 240, y: 200 }, false );

        const preview = useAppStore.getState().nodes;
        expect( preview.find( node => node.id === 5 )?.parentId ).toBe( 2 );
        expect( preview.find( node => node.id === 2 )?.h ).toBeGreaterThan( before.find( node => node.id === 2 )!.h! );
        expect( preview.find( node => node.id === 1 )?.h ).toBeGreaterThan( before.find( node => node.id === 1 )!.h! );
        expect( preview.filter( node => node.parentId === 2 ).map( node => node.id ) ).toEqual( [ 3, 4, 5 ] );
    } );

    it( "keeps a dragged node nested while it still overlaps its current container", () => {
        setDiagram( [
            { id: 1, displayId: "1", title: "Container", x: 200, y: 200 },
            { id: 2, displayId: "2", title: "First", x: 200, y: 200, parentId: 1 },
            { id: 3, displayId: "3", title: "Second", x: 300, y: 200, parentId: 1 },
        ] );
        useAppStore.getState().relayoutContainer( 1 );
        const before = useAppStore.getState().nodes;
        const container = before.find( node => node.id === 1 )!;
        const dragged = before.find( node => node.id === 2 )!;
        useAppStore.setState( { selection: new Set( [ 2 ] ) } );

        useAppStore.getState().beginCombinedDrag( { x: dragged.x, y: dragged.y }, new Set( [ 2 ] ), new Set(), new Set() );
        useAppStore.getState().updateCombinedDrag( {
            x: container.x + container.w! / 2 + dragged.w! / 2 - 4,
            y: container.y,
        }, false );

        expect( useAppStore.getState().nodes.find( node => node.id === 2 )?.parentId ).toBe( 1 );
    } );

    it( "orders contained nodes by id before laying them out", () => {
        setDiagram( [
            { id: 1, displayId: "1", title: "Container", x: 200, y: 200 },
            { id: 3, displayId: "3", title: "Id 3", x: 300, y: 200, parentId: 1 },
            { id: 2, displayId: "2", title: "Id 2", x: 200, y: 200, parentId: 1 },
        ] );

        useAppStore.getState().relayoutContainer( 1 );

        const nodes = useAppStore.getState().nodes;
        expect( nodes.find( node => node.id === 2 )!.x ).toBeLessThan( nodes.find( node => node.id === 3 )!.x );
        expect( nodes.find( node => node.id === 2 )!.y ).toBe( nodes.find( node => node.id === 3 )!.y );
    } );

    it( "recalculates nested descendants before every affected ancestor", () => {
        setDiagram( [
            { id: 1, displayId: "1", title: "Outer", x: 200, y: 200 },
            { id: 2, displayId: "2", title: "Middle", x: 200, y: 200, parentId: 1 },
            { id: 3, displayId: "3", title: "Inner", x: 200, y: 200, parentId: 2 },
            { id: 4, displayId: "4", title: "Child", x: 200, y: 200, parentId: 3 },
        ] );
        useAppStore.getState().relayoutContainer( 3 );
        useAppStore.getState().relayoutContainer( 2 );
        useAppStore.getState().relayoutContainer( 1 );
        const before = useAppStore.getState().nodes.map( node => ( { ...node } ) );

        useAppStore.setState( {
            nodes: useAppStore.getState().nodes.map( node => node.id === 4
                ? withMeasuredNodeBox( {
                    ...node,
                    title: "Child with a much longer title that must wrap",
                    wrap: 5,
                } )
                : node ),
        } );
        useAppStore.getState().relayoutContainer( 1 );

        const after = useAppStore.getState().nodes;
        expect( after.find( node => node.id === 3 )!.h ).toBeGreaterThan( before.find( node => node.id === 3 )!.h! );
        expect( after.find( node => node.id === 2 )!.h ).toBeGreaterThan( before.find( node => node.id === 2 )!.h! );
        expect( after.find( node => node.id === 1 )!.h ).toBeGreaterThan( before.find( node => node.id === 1 )!.h! );
    } );

    it( "moves every descendant with a nested container repositioned by its parent", () => {
        setDiagram( [
            { id: 1, displayId: "1", title: "Outer", x: 200, y: 200 },
            { id: 2, displayId: "2", title: "Middle", x: 200, y: 200, parentId: 1 },
            { id: 3, displayId: "3", title: "Inner child", x: 200, y: 200, parentId: 2 },
            { id: 4, displayId: "4", title: "Sibling", x: 300, y: 200, parentId: 1 },
        ] );
        useAppStore.getState().relayoutContainer( 2 );
        useAppStore.getState().relayoutContainer( 1 );
        const before = useAppStore.getState().nodes.map( node => ( { ...node } ) );

        useAppStore.setState( {
            nodes: useAppStore.getState().nodes.map( node => node.id === 4
                ? withMeasuredNodeBox( {
                    ...node,
                    title: "Sibling with a much longer title that changes the grid",
                    wrap: 5,
                } )
                : node ),
        } );
        useAppStore.getState().relayoutContainer( 1 );

        const after = useAppStore.getState().nodes;
        const middleBefore = before.find( node => node.id === 2 )!;
        const childBefore = before.find( node => node.id === 3 )!;
        const middleAfter = after.find( node => node.id === 2 )!;
        const childAfter = after.find( node => node.id === 3 )!;
        expect( middleAfter.x ).not.toBe( middleBefore.x );
        expect( childAfter.x - childBefore.x ).toBe( middleAfter.x - middleBefore.x );
    } );
} );
