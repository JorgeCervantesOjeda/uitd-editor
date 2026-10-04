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

    it( "keeps the dragged node under the cursor when preview layout repositions it", () => {
        setDiagram( [
            { id: 1, displayId: "1", title: "Container", x: 200, y: 200 },
            { id: 2, displayId: "2", title: "Dragged", x: 500, y: 200 },
            { id: 3, displayId: "3", title: "Existing", x: 200, y: 300, parentId: 1 },
        ] );
        useAppStore.setState( {
            panzoom: { x: 40, y: -20, zoom: 2 },
            selection: new Set( [ 2 ] ),
            getDropTargetFor: () => 1,
        } );

        const initialPanzoom = useAppStore.getState().panzoom;
        // El agarre está desplazado del centro, como al tomar el título del nodo.
        const initialAnchor = { x: 470, y: 180 };
        useAppStore.getState().beginCombinedDrag( initialAnchor, new Set( [ 2 ] ), new Set(), new Set() );
        useAppStore.getState().updateCombinedDrag( { x: 200, y: 200 }, false );

        const state = useAppStore.getState();
        const dragged = state.nodes.find( node => node.id === 2 )!;
        const expectedCenter = { x: 230, y: 220 };
        const initialPointerScreenPosition = {
            x: initialPanzoom.x + initialPanzoom.zoom * 200,
            y: initialPanzoom.y + initialPanzoom.zoom * 200,
        };
        const initialNodeScreenPosition = {
            x: initialPointerScreenPosition.x + initialPanzoom.zoom * ( expectedCenter.x - 200 ),
            y: initialPointerScreenPosition.y + initialPanzoom.zoom * ( expectedCenter.y - 200 ),
        };
        const actualScreenPosition = {
            x: state.panzoom.x + state.panzoom.zoom * dragged.x,
            y: state.panzoom.y + state.panzoom.zoom * dragged.y,
        };

        expect( dragged.x ).toBe( expectedCenter.x );
        expect( dragged.y ).toBe( expectedCenter.y );
        expect( state.panzoom ).toEqual( initialPanzoom );
        expect( actualScreenPosition ).toEqual( initialNodeScreenPosition );
        expect( state.drag.anchor ).toEqual( initialAnchor );

        const cameraAfterInsertion = state.panzoom;
        useAppStore.getState().updateCombinedDrag( { x: 210, y: 200 }, false );
        expect( useAppStore.getState().panzoom ).toEqual( cameraAfterInsertion );
    } );

    it( "keeps the dragged node aligned when adding it to a container with eight children", () => {
        setDiagram( [
            { id: 1, displayId: "1", title: "Container", x: 200, y: 200 },
            { id: 2, displayId: "2", title: "Dragged", x: 600, y: 200 },
            ...Array.from( { length: 8 }, ( _, index ) => ( {
                id: index + 3,
                displayId: String( index + 3 ),
                title: `Existing ${index + 1}`,
                x: 200,
                y: 300,
                parentId: 1,
            } ) ),
        ] );
        useAppStore.getState().relayoutContainer( 1 );
        useAppStore.setState( {
            panzoom: { x: 40, y: -20, zoom: 2 },
            selection: new Set( [ 2 ] ),
        } );

        const initialPanzoom = useAppStore.getState().panzoom;
        useAppStore.getState().beginCombinedDrag( { x: 600, y: 200 }, new Set( [ 2 ] ), new Set(), new Set() );
        const dropPoint = { x: 200, y: 100 };
        useAppStore.getState().updateCombinedDrag( dropPoint, false );

        const state = useAppStore.getState();
        const dragged = state.nodes.find( node => node.id === 2 )!;
        expect( dragged.parentId ).toBe( 1 );
        expect( state.panzoom ).toEqual( initialPanzoom );
        expect( Math.abs( dragged.x - dropPoint.x ) ).toBeLessThanOrEqual( 8 );
        expect( Math.abs( dragged.y - dropPoint.y ) ).toBeLessThanOrEqual( 8 );

        useAppStore.getState().updateCombinedDrag( dropPoint, false );

        const afterContinuation = useAppStore.getState();
        const draggedAfterContinuation = afterContinuation.nodes.find( node => node.id === 2 )!;
        expect( afterContinuation.panzoom ).toEqual( state.panzoom );
        expect( draggedAfterContinuation.parentId ).toBe( 1 );
        expect( Math.abs( draggedAfterContinuation.x - dragged.x ) ).toBeLessThanOrEqual( 8 );
        expect( Math.abs( draggedAfterContinuation.y - dragged.y ) ).toBeLessThanOrEqual( 8 );
    } );

    it( "does not keep moving the camera while continuing inside the same container", () => {
        setDiagram( [
            { id: 1, displayId: "1", title: "Container", x: 200, y: 200 },
            { id: 2, displayId: "2", title: "Dragged", x: 500, y: 200 },
            { id: 3, displayId: "3", title: "Existing", x: 200, y: 300, parentId: 1 },
        ] );
        useAppStore.setState( {
            panzoom: { x: 40, y: -20, zoom: 2 },
            selection: new Set( [ 2 ] ),
            getDropTargetFor: () => 1,
        } );

        useAppStore.getState().beginCombinedDrag( { x: 500, y: 200 }, new Set( [ 2 ] ), new Set(), new Set() );
        useAppStore.getState().updateCombinedDrag( { x: 200, y: 200 }, false );
        const cameraAfterInsertion = useAppStore.getState().panzoom;

        useAppStore.getState().updateCombinedDrag( { x: 210, y: 200 }, false );

        expect( useAppStore.getState().panzoom ).toEqual( cameraAfterInsertion );
    } );

    it( "preserves the exit position when leaving a provisional nested container", () => {
        setDiagram( [
            { id: 1, displayId: "1", title: "Outer", x: 300, y: 300 },
            { id: 2, displayId: "2", title: "Inner", x: 300, y: 300, parentId: 1 },
            { id: 3, displayId: "3", title: "Dragged", x: 500, y: 300, parentId: 1 },
            { id: 4, displayId: "4", title: "Existing", x: 200, y: 300, parentId: 1 },
            { id: 5, displayId: "5", title: "Inner child", x: 300, y: 300, parentId: 2 },
        ] );
        useAppStore.getState().relayoutContainer( 2 );
        useAppStore.getState().relayoutContainer( 1 );

        let target: number | null = 2;
        useAppStore.setState( {
            selection: new Set( [ 3 ] ),
            getDropTargetFor: () => target,
        } );

        const draggedBefore = useAppStore.getState().nodes.find( node => node.id === 3 )!;
        useAppStore.getState().beginCombinedDrag(
            { x: draggedBefore.x, y: draggedBefore.y },
            new Set( [ 3 ] ),
            new Set(),
            new Set()
        );
        useAppStore.getState().updateCombinedDrag( { x: 320, y: 420 }, false );
        expect( useAppStore.getState().nodes.find( node => node.id === 3 )?.parentId ).toBe( 2 );

        const exitPoint = { x: 417, y: 263 };
        target = 1;
        useAppStore.getState().updateCombinedDrag( exitPoint, false );

        const draggedAfterExit = useAppStore.getState().nodes.find( node => node.id === 3 )!;
        expect( draggedAfterExit.parentId ).toBe( 1 );
        expect( Math.abs( draggedAfterExit.x - exitPoint.x ) ).toBeLessThanOrEqual( 8 );
        expect( Math.abs( draggedAfterExit.y - exitPoint.y ) ).toBeLessThanOrEqual( 8 );
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

    it( "recalculates every affected level when dropping after provisional nesting", () => {
        setDiagram( [
            { id: 1, displayId: "1", title: "Outer", x: 240, y: 240 },
            { id: 2, displayId: "2", title: "Inner", x: 240, y: 240, parentId: 1 },
            { id: 3, displayId: "3", title: "Existing A", x: 220, y: 340, parentId: 2 },
            { id: 4, displayId: "4", title: "Existing B", x: 300, y: 340, parentId: 2 },
            { id: 5, displayId: "5", title: "Dragged", x: 600, y: 240 },
        ] );
        useAppStore.getState().relayoutContainer( 2 );
        useAppStore.getState().relayoutAncestors( 2 );
        useAppStore.setState( {
            selection: new Set( [ 5 ] ),
            getDropTargetFor: () => 2,
        } );

        useAppStore.getState().beginCombinedDrag( { x: 600, y: 240 }, new Set( [ 5 ] ), new Set(), new Set() );
        const dropPoint = { x: 240, y: 200 };
        useAppStore.getState().updateCombinedDrag( dropPoint, false );
        const previewDragged = useAppStore.getState().nodes.find( node => node.id === 5 )!;

        useAppStore.getState().endCombinedDrag();

        const committed = useAppStore.getState();
        const committedDragged = committed.nodes.find( node => node.id === 5 )!;
        expect( committedDragged.parentId ).toBe( 2 );
        expect( committed.nodes.filter( node => node.parentId === 2 ).map( node => node.id ) ).toEqual( [ 3, 4, 5 ] );
        expect( { x: committedDragged.x, y: committedDragged.y } ).not.toEqual( {
            x: previewDragged.x,
            y: previewDragged.y,
        } );
        expect( committed.historyUndo ).toHaveLength( 1 );
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

        const after = useAppStore.getState().nodes.find( node => node.id === 2 )!;
        expect( after.parentId ).toBe( 1 );
        expect( after.x ).not.toBe( dragged.x );
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
