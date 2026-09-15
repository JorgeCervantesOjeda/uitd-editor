// src/components/Canvas/FileToolbar.test.tsx
// Verifies that the canvas file menu is limited to visual project files.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { state, useAppStore } = vi.hoisted( () => {
    const state = {
        nodes: [],
        actions: [],
        conditions: [],
        edges: [],
        fragmentTitles: {},
        nextId: 1,
        nextActionId: 1,
        nextEdgeId: 1,
        panzoom: { x: 0, y: 0, zoom: 1 },
        canvasFitAppliedRequest: 0,
        viewBox: { w: 800, h: 600 },
        selection: new Set<number>(),
        selectionActions: new Set<number>(),
        selectionConds: new Set<number>(),
        focusTarget: null,
        keyboardMarquee: null,
        marqueeSeed: null,
        drag: {
            active: false,
            anchor: { x: 0, y: 0 },
            startNodes: new Map(),
            startActions: new Map(),
            startConds: new Map(),
        },
        pendingConnect: null,
        dragHoverParent: null,
        dragGuides: { enabled: false },
        dragHistoryBefore: null,
        historyUndo: [],
        historyRedo: [],
        historyBytes: 0,
        editingSession: null,
        _clipboard: null,
        resetProjectToBlank: vi.fn(),
        clearSavedProject: vi.fn(),
        requestCanvasFitToWidth: vi.fn( () => 1 ),
    };

    const useAppStore = ( ( selector?: ( value: typeof state ) => unknown ) =>
        selector ? selector( state ) : state ) as unknown as {
            ( selector?: ( value: typeof state ) => unknown ): unknown;
            getState: () => typeof state;
            setState: ( update: Partial<typeof state> | ( ( value: typeof state ) => Partial<typeof state> ) ) => void;
        };

    useAppStore.getState = () => state;
    useAppStore.setState = ( update ) => {
        const patch = typeof update === "function" ? update( state ) : update;
        Object.assign( state, patch );
    };

    return { state, useAppStore };
} );

vi.mock( "../../state/store", () => ( { useAppStore } ) );

import { FileToolbar } from "./FileToolbar";

describe( "FileToolbar", () => {
    beforeEach( () => {
        localStorage.clear();
        state.nodes = [];
        state.actions = [];
        state.conditions = [];
        state.edges = [];
        state.resetProjectToBlank.mockClear();
        state.clearSavedProject.mockClear();
        vi.restoreAllMocks();
    } );

    it( "does not expose UITDL import from the canvas file menu", () => {
        const { container } = render( <FileToolbar /> );

        expect( screen.getByRole( "button", { name: "New project" } ) ).toBeTruthy();
        expect( screen.getByRole( "button", { name: "Open project" } ) ).toBeTruthy();
        expect( screen.getByRole( "button", { name: "Save project" } ) ).toBeTruthy();
        expect( screen.queryByRole( "button", { name: "Import UITDL" } ) ).toBeNull();
        expect( container.querySelector( 'input[accept=".uitd,.uitdl,.txt,text/plain"]' ) ).toBeNull();
    } );

    it( "rejects project JSON files with leading-zero UI IDs", async () => {
        const alertSpy = vi.spyOn( window, "alert" ).mockImplementation( () => undefined );
        const errorSpy = vi.spyOn( console, "error" ).mockImplementation( () => undefined );
        const { container } = render( <FileToolbar /> );
        const input = container.querySelector( 'input[type="file"]' ) as HTMLInputElement;
        const project = {
            nodes: [ { id: 1, displayId: "01", title: "Invalid", x: 0, y: 0 } ],
            actions: [],
            conditions: [],
            edges: [],
        };
        const file = new File( [ JSON.stringify( project ) ], "project.json", { type: "application/json" } );
        Object.defineProperty( file, "text", {
            value: vi.fn( async () => JSON.stringify( project ) ),
        } );

        fireEvent.change( input, { target: { files: [ file ] } } );

        await waitFor( () => {
            expect( alertSpy ).toHaveBeenCalledWith(
                "Failed to open file. Invalid UIID \"01\": UI IDs must not contain leading zeros."
            );
        } );
        expect( state.nodes ).toEqual( [] );
        expect( errorSpy ).toHaveBeenCalled();
    } );
} );
