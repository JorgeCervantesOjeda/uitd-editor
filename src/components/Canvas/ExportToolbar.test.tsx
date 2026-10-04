// Verifies that the canvas opens the shared D2 panel with the complete UITDL export.

import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAppStore } from "../../state/store";

vi.mock( "../UITDLTextPanel/D2CodePanel", () => ( {
    D2CodePanel: ( {
        text,
        fragmentSelection,
        onClose,
    }: {
        text: string;
        fragmentSelection: { fragments: Array<{ id: string; title?: string }>; selectedFragmentIds: ReadonlySet<string> };
        onClose: () => void;
    } ) => (
        <section role="dialog" aria-label="D2 source editor">
            <pre aria-label="Complete UITDL source">{ text }</pre>
            <div aria-label="Selected fragments">{ Array.from( fragmentSelection.selectedFragmentIds ).join( "," ) }</div>
            <div aria-label="Available fragments">{ fragmentSelection.fragments.map( fragment => fragment.title ).join( "," ) }</div>
            <button type="button" onClick={ onClose }>Discard</button>
        </section>
    ),
} ) );

import { ExportToolbar } from "./ExportToolbar";

const initialState = useAppStore.getState();

function setSelectionState() {
    useAppStore.setState( {
        nodes: [
            { id: 1, x: 0, y: 0, title: "First start", displayId: "1" },
            { id: 2, x: 200, y: 0, title: "First end", displayId: "2" },
            { id: 3, x: 0, y: 200, title: "Second start", displayId: "3" },
            { id: 4, x: 200, y: 200, title: "Second end", displayId: "4" },
        ],
        actions: [
            { id: 10, originNodeId: 1, x: 100, y: 0, verb: "clicks", complement: "First", title: "clicks First" },
            { id: 20, originNodeId: 3, x: 100, y: 200, verb: "clicks", complement: "Second", title: "clicks Second" },
        ],
        conditions: [],
        edges: [
            { id: 1, from: { kind: "node", id: 1 }, to: { kind: "action", id: 10 }, style: "solid" },
            { id: 2, from: { kind: "action", id: 10 }, to: { kind: "node", id: 2 }, style: "dashed1" },
            { id: 3, from: { kind: "node", id: 3 }, to: { kind: "action", id: 20 }, style: "solid" },
            { id: 4, from: { kind: "action", id: 20 }, to: { kind: "node", id: 4 }, style: "dashed1" },
        ],
        fragmentTitles: {
            "action:10|node:1|node:2": "First fragment",
            "action:20|node:3|node:4": "Second fragment",
        },
        selection: new Set( [ 1, 2 ] ),
        selectionActions: new Set( [ 10 ] ),
        selectionConds: new Set(),
    } );
}

describe( "ExportToolbar D2 export", () => {
    beforeEach( setSelectionState );
    afterEach( () => useAppStore.setState( initialState, true ) );

    it( "opens the shared D2 panel with all source fragments and the canvas selection", () => {
        render( <ExportToolbar svgRef={ { current: null } } /> );

        fireEvent.click( screen.getByRole( "button", { name: "D2" } ) );

        expect( screen.getByRole( "dialog", { name: "D2 source editor" } ) ).toBeTruthy();
        expect( screen.getByLabelText( "Complete UITDL source" ).textContent ).toContain( "Second fragment" );
        expect( screen.getByLabelText( "Available fragments" ).textContent ).toContain( "First fragment,Second fragment" );
        expect( screen.getByLabelText( "Selected fragments" ).textContent ).toBe( "action:10|node:1|node:2" );
    } );

    it( "closes the shared panel when the user discards the preview", () => {
        render( <ExportToolbar svgRef={ { current: null } } /> );

        fireEvent.click( screen.getByRole( "button", { name: "D2" } ) );
        fireEvent.click( screen.getByRole( "button", { name: "Discard" } ) );

        expect( screen.queryByRole( "dialog", { name: "D2 source editor" } ) ).toBeNull();
    } );
} );
