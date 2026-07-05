// src/components/UITDLTextPanel/UITDLTextPanel.test.tsx
// Verifies that applying text starts the same post-import layout simulation as canvas import.

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted( () => ( {
    importUITDL: vi.fn(),
    relayoutImportedContainers: vi.fn(),
    runSimulation: vi.fn(),
    stopSimulation: vi.fn(),
} ) );

const state = {
    nodes: [],
    actions: [],
    conditions: [],
    edges: [],
    fragmentTitles: {},
    nextId: 1,
    nextActionId: 1,
    nextEdgeId: 1,
    requestCanvasFitToWidth: vi.fn( () => 1 ),
    commitEditingSession: vi.fn(),
    captureDelta: vi.fn( ( _keys: string[], update: () => void ) => update() ),
};

vi.mock( "@monaco-editor/react", () => ( {
    default: () => <div aria-label="Mock UITDL editor" />,
} ) );
vi.mock( "../../export/uitdl", () => ( { exportToUITDL: () => "initial diagram" } ) );
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
        localStorage.setItem( "uitd-editor/uitdl-text-draft", "changed UITDL" );
        mocks.importUITDL.mockReturnValue( {
            ...state,
            nodes: [ { id: 1 } ],
        } );
        mocks.importUITDL.mockClear();
        mocks.relayoutImportedContainers.mockClear();
        mocks.runSimulation.mockClear();
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
} );
