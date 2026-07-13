// src/components/UITDLTextPanel/UITDLTextPanel.test.tsx
// Verifies that applying text starts the same post-import layout simulation as canvas import.

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted( () => ( {
    exportToUITDL: vi.fn( ( state: { nodes: unknown[] } ) => `diagram ${state.nodes.length}` ),
    importUITDL: vi.fn(),
    relayoutImportedContainers: vi.fn(),
    runSimulation: vi.fn(),
    stopSimulation: vi.fn(),
    storeListeners: [] as Array<() => void>,
} ) );

const state = {
    nodes: [] as unknown[],
    actions: [] as unknown[],
    conditions: [] as unknown[],
    edges: [] as unknown[],
    fragmentTitles: {},
    nextId: 1,
    nextActionId: 1,
    nextEdgeId: 1,
    requestCanvasFitToWidth: vi.fn( () => 1 ),
    commitEditingSession: vi.fn(),
    captureDelta: vi.fn( ( _keys: string[], update: () => void ) => update() ),
};

vi.mock( "@monaco-editor/react", () => ( {
    default: ( props: {
        value: string;
        onChange?: ( value: string ) => void;
        options?: { readOnly?: boolean };
    } ) => (
        <textarea
            aria-label="Mock UITDL editor"
            readOnly={ props.options?.readOnly }
            value={ props.value }
            onChange={ event => props.onChange?.( event.currentTarget.value ) }
        />
    ),
} ) );
vi.mock( "../../export/uitdl", () => ( { exportToUITDL: mocks.exportToUITDL } ) );
vi.mock( "../../import/uitdl", () => ( { importUITDL: mocks.importUITDL } ) );
vi.mock( "../../import/uitdl/officialValidator", () => ( {
    validateWithOfficialValidator: () => [],
} ) );
vi.mock( "../../state/store", () => ( {
    useAppStore: {
        getState: () => state,
        setState: vi.fn( update => {
            if ( typeof update === "function" ) Object.assign( state, update( state ) );
            else Object.assign( state, update );
            for ( const listener of mocks.storeListeners ) listener();
        } ),
        subscribe: vi.fn( ( listener: () => void ) => {
            mocks.storeListeners.push( listener );
            return () => {
                const indexOfListener = mocks.storeListeners.indexOf( listener );
                if ( indexOfListener >= 0 ) mocks.storeListeners.splice( indexOfListener, 1 );
            };
        } ),
    },
} ) );
vi.mock( "../Canvas/importedDiagramSimulation", () => ( {
    relayoutImportedContainers: mocks.relayoutImportedContainers,
    useImportedDiagramSimulation: () => ( {
        progress: null,
        runSimulation: mocks.runSimulation,
        stopSimulation: mocks.stopSimulation,
    } ),
} ) );
vi.mock( "./D2CodePanel", () => ( {
    D2CodePanel: () => <div aria-label="Mock D2 panel" />,
} ) );

import { UITDLTextPanel } from "./UITDLTextPanel";

describe( "UITDLTextPanel apply", () => {
    beforeEach( () => {
        localStorage.clear();
        localStorage.setItem( "uitd-editor/canvas-live-uitdl-sync", "false" );
        localStorage.setItem( "uitd-editor/uitdl-text-draft", "changed UITDL" );
        state.nodes = [];
        state.actions = [];
        state.conditions = [];
        state.edges = [];
        state.fragmentTitles = {};
        mocks.importUITDL.mockReturnValue( {
            ...state,
            nodes: [ { id: 1 } ],
        } );
        mocks.exportToUITDL.mockClear();
        mocks.importUITDL.mockClear();
        mocks.relayoutImportedContainers.mockClear();
        mocks.runSimulation.mockClear();
        mocks.storeListeners.length = 0;
        state.requestCanvasFitToWidth.mockClear();
    } );

    it( "relayouts containers and starts simulation after applying UITDL", async () => {
        render( <UITDLTextPanel onCollapse={ vi.fn() } /> );

        fireEvent.click( screen.getByRole( "button", { name: "Apply to diagram" } ) );

        await waitFor( () => expect( mocks.runSimulation ).toHaveBeenCalledTimes( 1 ) );
        expect( mocks.importUITDL ).toHaveBeenCalledTimes( 1 );
        expect( mocks.relayoutImportedContainers ).toHaveBeenCalledTimes( 1 );
        expect( screen.getByText( "UITDL applied. Layout simulation is running." ) ).toBeTruthy();
    } );

    it( "raises the text panel stacking context while D2 is open", () => {
        render( <UITDLTextPanel onCollapse={ vi.fn() } /> );

        fireEvent.click( screen.getByRole( "button", { name: "Generate D2" } ) );

        const panel = screen.getByRole( "complementary", { name: "UITDL text editor" } );
        expect( panel.classList.contains( "has-d2-modal" ) ).toBe( true );
        expect( screen.getByLabelText( "Mock D2 panel" ) ).toBeTruthy();
    } );

    it( "updates the UITDL text when the canvas changes while live sync is enabled", async () => {
        localStorage.setItem( "uitd-editor/canvas-live-uitdl-sync", "true" );

        render( <UITDLTextPanel onCollapse={ vi.fn() } /> );

        const editor = screen.getByLabelText( "Mock UITDL editor" ) as HTMLTextAreaElement;
        expect( editor.value ).toBe( "diagram 0" );
        expect( editor.readOnly ).toBe( true );

        state.nodes = [ { id: 1 } ];
        for ( const listener of mocks.storeListeners ) listener();

        await waitFor( () => expect( editor.value ).toBe( "diagram 1" ) );
        expect( screen.getByLabelText( "Live from canvas" ) ).toBeTruthy();
    } );

    it( "stops updating the UITDL text after live sync is turned off", async () => {
        localStorage.setItem( "uitd-editor/canvas-live-uitdl-sync", "true" );

        render( <UITDLTextPanel onCollapse={ vi.fn() } /> );

        const editor = screen.getByLabelText( "Mock UITDL editor" ) as HTMLTextAreaElement;
        fireEvent.click( screen.getByLabelText( "Live from canvas" ) );
        await waitFor( () => expect( editor.readOnly ).toBe( false ) );

        state.nodes = [ { id: 1 } ];
        for ( const listener of mocks.storeListeners ) listener();

        expect( editor.value ).toBe( "diagram 0" );
    } );
} );
