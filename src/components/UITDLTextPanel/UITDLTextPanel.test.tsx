// src/components/UITDLTextPanel/UITDLTextPanel.test.tsx
// Verifies that applying text starts the same post-import layout simulation as canvas import.

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted( () => ( {
    exportToUITDL: vi.fn( ( state: { nodes: unknown[] } ) => `diagram ${state.nodes.length}` ),
    exportToUITDLWithLocations: vi.fn( ( state: { nodes: unknown[] } ) => ( {
        text: `diagram ${state.nodes.length}`,
        locations: {
            nodes: new Map(),
            actions: new Map(),
            conditions: new Map(),
        },
    } ) ),
    importUITDL: vi.fn(),
    reconcileUITDLTextIncrementally: vi.fn(),
    relayoutImportedContainers: vi.fn(),
    runSimulation: vi.fn(),
    runSimulationForCurrentSelection: vi.fn(),
    stopSimulation: vi.fn(),
    editorSetSelection: vi.fn(),
    editorSetPosition: vi.fn(),
    editorRevealLineInCenter: vi.fn(),
    editorDecorationSet: vi.fn(),
    editorDecorationClear: vi.fn(),
    editorPosition: { lineNumber: 1, column: 1 },
    focusEditorText: null as null | ( () => void ),
    blurEditorText: null as null | ( () => void ),
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
    viewBox: { w: 1000, h: 800 },
    panzoom: { x: 0, y: 0, zoom: 1 },
    selection: new Set<number>(),
    selectionActions: new Set<number>(),
    selectionConds: new Set<number>(),
    focusTarget: null as null | { kind: "node" | "action" | "condition"; id: number },
    requestCanvasFitToWidth: vi.fn( () => 1 ),
    commitEditingSession: vi.fn(),
    captureDelta: vi.fn( ( _keys: string[], update: () => void ) => update() ),
};

vi.mock( "@monaco-editor/react", () => ( {
    default: ( props: {
        value: string;
        onChange?: ( value: string ) => void;
        options?: { readOnly?: boolean };
        onMount?: ( editor: unknown, monaco: unknown ) => void;
    } ) => (
        props.onMount?.(
            {
                getModel: () => ( {} ),
                getPosition: () => mocks.editorPosition,
                onDidChangeModelContent: () => ( { dispose: vi.fn() } ),
                onDidChangeCursorPosition: () => ( { dispose: vi.fn() } ),
                onDidFocusEditorText: ( listener: () => void ) => {
                    mocks.focusEditorText = listener;
                    return { dispose: vi.fn() };
                },
                onDidBlurEditorText: ( listener: () => void ) => {
                    mocks.blurEditorText = listener;
                    return { dispose: vi.fn() };
                },
                trigger: vi.fn(),
                setSelection: mocks.editorSetSelection,
                setPosition: mocks.editorSetPosition,
                revealLineInCenter: mocks.editorRevealLineInCenter,
                createDecorationsCollection: () => ( {
                    set: mocks.editorDecorationSet,
                    clear: mocks.editorDecorationClear,
                } ),
                focus: vi.fn(),
            },
            {
                MarkerSeverity: { Error: 8, Warning: 4 },
                languages: {
                    register: vi.fn(),
                    setMonarchTokensProvider: vi.fn(),
                    setLanguageConfiguration: vi.fn(),
                    registerCompletionItemProvider: vi.fn( () => ( { dispose: vi.fn() } ) ),
                    registerHoverProvider: vi.fn( () => ( { dispose: vi.fn() } ) ),
                    registerFoldingRangeProvider: vi.fn( () => ( { dispose: vi.fn() } ) ),
                    registerDocumentFormattingEditProvider: vi.fn( () => ( { dispose: vi.fn() } ) ),
                    CompletionItemKind: {
                        Snippet: 1,
                        Keyword: 2,
                        Field: 3,
                    },
                    CompletionItemInsertTextRule: {
                        InsertAsSnippet: 4,
                    },
                },
                editor: {
                    setModelLanguage: vi.fn(),
                    setModelMarkers: vi.fn(),
                },
            }
        ),
        <textarea
            aria-label="Mock UITDL editor"
            readOnly={ props.options?.readOnly }
            value={ props.value }
            onChange={ event => props.onChange?.( event.currentTarget.value ) }
        />
    ),
} ) );
vi.mock( "../../export/uitdl", () => ( {
    exportToUITDL: mocks.exportToUITDL,
    exportToUITDLWithLocations: mocks.exportToUITDLWithLocations,
} ) );
vi.mock( "../../import/uitdl", () => ( { importUITDL: mocks.importUITDL } ) );
vi.mock( "../../import/uitdl/incremental", () => ( {
    reconcileUITDLTextIncrementally: mocks.reconcileUITDLTextIncrementally,
} ) );
vi.mock( "../../import/uitdl/officialValidator", () => ( {
    validateWithOfficialValidator: ( text: string ) => text.includes( "BROKEN" )
        ? [ { kind: "error", message: "Broken text" } ]
        : [],
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
        runSimulationForCurrentSelection: mocks.runSimulationForCurrentSelection,
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
        state.selection = new Set<number>();
        state.selectionActions = new Set<number>();
        state.selectionConds = new Set<number>();
        state.focusTarget = null;
        state.panzoom = { x: 0, y: 0, zoom: 1 };
        state.viewBox = { w: 1000, h: 800 };
        mocks.importUITDL.mockReturnValue( {
            ...state,
            nodes: [ { id: 1 } ],
        } );
        mocks.reconcileUITDLTextIncrementally.mockReturnValue( {
            nodes: [ {
                id: 4,
                displayId: "4",
                title: "Live",
                x: 100,
                y: 100,
                w: 120,
                h: 80,
                parentId: null,
            } ],
            actions: [],
            conditions: [],
            edges: [],
            fragmentTitles: {},
            nextId: 5,
            nextActionId: 1,
            nextEdgeId: 1,
            beforeSelection: { nodes: new Set<number>(), actions: new Set<number>(), conditions: new Set<number>() },
            afterSelection: { nodes: new Set<number>( [ 4 ] ), actions: new Set<number>(), conditions: new Set<number>() },
            changedCount: 1,
        } );
        mocks.exportToUITDL.mockClear();
        mocks.exportToUITDLWithLocations.mockClear();
        mocks.exportToUITDL.mockImplementation( ( currentState: { nodes: unknown[] } ) =>
            `diagram ${currentState.nodes.length}`
        );
        mocks.exportToUITDLWithLocations.mockImplementation( ( currentState: { nodes: unknown[] } ) => ( {
            text: `diagram ${currentState.nodes.length}`,
            locations: {
                nodes: new Map(),
                actions: new Map(),
                conditions: new Map(),
            },
        } ) );
        mocks.importUITDL.mockClear();
        mocks.reconcileUITDLTextIncrementally.mockClear();
        mocks.relayoutImportedContainers.mockClear();
        mocks.runSimulation.mockClear();
        mocks.runSimulationForCurrentSelection.mockClear();
        mocks.editorSetSelection.mockClear();
        mocks.editorSetPosition.mockClear();
        mocks.editorRevealLineInCenter.mockClear();
        mocks.editorDecorationSet.mockClear();
        mocks.editorDecorationClear.mockClear();
        mocks.editorPosition = { lineNumber: 1, column: 1 };
        mocks.focusEditorText = null;
        mocks.blurEditorText = null;
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

    it( "reveals a selected canvas node at the corresponding DRAW line", async () => {
        localStorage.setItem( "uitd-editor/canvas-live-uitdl-sync", "true" );
        mocks.exportToUITDL.mockReturnValue( "diagram text" );
        mocks.exportToUITDLWithLocations.mockReturnValue( {
            text: "diagram text",
            locations: {
                nodes: new Map( [ [ 7, [ { lineNumber: 9, column: 9, endColumn: 25 } ] ] ] ),
                actions: new Map(),
                conditions: new Map(),
            },
        } );

        render( <UITDLTextPanel onCollapse={ vi.fn() } /> );

        state.selection = new Set<number>( [ 7 ] );
        for ( const listener of mocks.storeListeners ) listener();

        await waitFor( () => expect( mocks.editorRevealLineInCenter ).toHaveBeenCalledWith( 9 ) );
        expect( mocks.editorSetSelection ).toHaveBeenCalledWith( {
            startLineNumber: 9,
            startColumn: 9,
            endLineNumber: 9,
            endColumn: 25,
        } );
        expect( mocks.editorDecorationSet ).toHaveBeenCalledWith( [
            expect.objectContaining( {
                range: {
                    startLineNumber: 9,
                    startColumn: 1,
                    endLineNumber: 9,
                    endColumn: 1,
                },
                options: expect.objectContaining( {
                    isWholeLine: true,
                    className: "uitdlTextPanel__canvasSyncLine",
                    linesDecorationsClassName: "uitdlTextPanel__canvasSyncMarker",
                } ),
            } ),
        ] );
    } );

    it( "centers the middle text line when multiple canvas items are selected", async () => {
        localStorage.setItem( "uitd-editor/canvas-live-uitdl-sync", "true" );
        mocks.exportToUITDL.mockReturnValue( "diagram text" );
        mocks.exportToUITDLWithLocations.mockReturnValue( {
            text: "diagram text",
            locations: {
                nodes: new Map( [ [ 1, [ { lineNumber: 8, column: 9, endColumn: 24 } ] ] ] ),
                actions: new Map( [ [ 2, [ { lineNumber: 14, column: 9, endColumn: 61 } ] ] ] ),
                conditions: new Map( [ [ 3, [ { lineNumber: 20, column: 9, endColumn: 78 } ] ] ] ),
            },
        } );

        render( <UITDLTextPanel onCollapse={ vi.fn() } /> );

        state.selection = new Set<number>( [ 1 ] );
        state.selectionActions = new Set<number>( [ 2 ] );
        state.selectionConds = new Set<number>( [ 3 ] );
        for ( const listener of mocks.storeListeners ) listener();

        await waitFor( () => expect( mocks.editorRevealLineInCenter ).toHaveBeenCalledWith( 14 ) );
        expect( mocks.editorSetSelection ).toHaveBeenCalledWith( {
            startLineNumber: 8,
            startColumn: 9,
            endLineNumber: 20,
            endColumn: 78,
        } );
        expect( mocks.editorDecorationSet ).toHaveBeenCalledWith( [
            expect.objectContaining( { range: expect.objectContaining( { startLineNumber: 8 } ) } ),
            expect.objectContaining( { range: expect.objectContaining( { startLineNumber: 14 } ) } ),
            expect.objectContaining( { range: expect.objectContaining( { startLineNumber: 20 } ) } ),
        ] );
    } );

    it( "does not move the text cursor from canvas selection while live UITDL sync has editor focus", async () => {
        localStorage.setItem( "uitd-editor/uitdl-live-canvas-sync", "true" );
        mocks.exportToUITDL.mockReturnValue( "diagram text" );
        mocks.exportToUITDLWithLocations.mockReturnValue( {
            text: "diagram text",
            locations: {
                nodes: new Map( [ [ 7, [ { lineNumber: 9, column: 9, endColumn: 25 } ] ] ] ),
                actions: new Map(),
                conditions: new Map(),
            },
        } );

        render( <UITDLTextPanel onCollapse={ vi.fn() } /> );
        mocks.focusEditorText?.();

        state.selection = new Set<number>( [ 7 ] );
        for ( const listener of mocks.storeListeners ) listener();

        await waitFor( () => expect( mocks.editorDecorationClear ).toHaveBeenCalled() );
        expect( mocks.editorSetSelection ).not.toHaveBeenCalled();
        expect( mocks.editorSetPosition ).not.toHaveBeenCalled();
        expect( mocks.editorRevealLineInCenter ).not.toHaveBeenCalled();
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

    it( "does not update the canvas from live UITDL while the text has errors", async () => {
        localStorage.setItem( "uitd-editor/uitdl-live-canvas-sync", "true" );

        render( <UITDLTextPanel onCollapse={ vi.fn() } /> );

        const editor = screen.getByLabelText( "Mock UITDL editor" ) as HTMLTextAreaElement;
        fireEvent.change( editor, { target: { value: "BROKEN UITDL" } } );

        await waitFor( () => {
            expect( screen.getByText( "Canvas kept the last valid UITDL because the text has errors." ) ).toBeTruthy();
        } );
        expect( mocks.reconcileUITDLTextIncrementally ).not.toHaveBeenCalled();
    } );

    it( "applies valid live UITDL incrementally and runs limited simulation", async () => {
        localStorage.setItem( "uitd-editor/uitdl-live-canvas-sync", "true" );

        render( <UITDLTextPanel onCollapse={ vi.fn() } /> );

        const editor = screen.getByLabelText( "Mock UITDL editor" ) as HTMLTextAreaElement;
        fireEvent.change( editor, { target: { value: "valid live UITDL" } } );

        await waitFor( () => expect( mocks.reconcileUITDLTextIncrementally ).toHaveBeenCalledTimes( 1 ) );
        await waitFor( () => expect( mocks.runSimulationForCurrentSelection ).toHaveBeenCalledTimes( 1 ) );
        expect( state.nodes ).toEqual( [ {
            id: 4,
            displayId: "4",
            title: "Live",
            x: 100,
            y: 100,
            w: 120,
            h: 80,
            parentId: null,
        } ] );
        expect( screen.getByText( "Canvas updated from UITDL." ) ).toBeTruthy();
    } );

    it( "selects and centers the edited transition action while live UITDL sync is enabled", async () => {
        localStorage.setItem( "uitd-editor/uitdl-live-canvas-sync", "true" );
        const transitionText = 'TRANSITION from 1 to 2 if user clicks "Save";';
        mocks.editorPosition = { lineNumber: 1, column: 42 };
        mocks.exportToUITDLWithLocations.mockReturnValue( {
            text: transitionText,
            locations: {
                nodes: new Map(),
                actions: new Map( [ [ 9, [ { lineNumber: 1, column: 1, endColumn: transitionText.length + 1 } ] ] ] ),
                conditions: new Map(),
            },
        } );
        mocks.reconcileUITDLTextIncrementally.mockReturnValue( {
            nodes: [
                { id: 1, displayId: "1", title: "Start", x: 100, y: 100, w: 120, h: 80, parentId: null },
                { id: 2, displayId: "2", title: "End", x: 360, y: 100, w: 120, h: 80, parentId: null },
            ],
            actions: [
                {
                    id: 9,
                    originNodeId: 1,
                    x: 210,
                    y: 120,
                    verb: "clicks",
                    complement: "Save",
                    title: 'clicks "Save"',
                },
            ],
            conditions: [],
            edges: [],
            fragmentTitles: {},
            nextId: 3,
            nextActionId: 10,
            nextEdgeId: 1,
            beforeSelection: { nodes: new Set<number>(), actions: new Set<number>(), conditions: new Set<number>() },
            afterSelection: { nodes: new Set<number>(), actions: new Set<number>(), conditions: new Set<number>() },
            changedCount: 1,
        } );

        render( <UITDLTextPanel onCollapse={ vi.fn() } /> );

        const editor = screen.getByLabelText( "Mock UITDL editor" ) as HTMLTextAreaElement;
        fireEvent.change( editor, { target: { value: transitionText } } );

        await waitFor( () => expect( mocks.runSimulationForCurrentSelection ).toHaveBeenCalledTimes( 1 ) );
        expect( state.selectionActions ).toEqual( new Set<number>( [ 9 ] ) );
        expect( state.selection ).toEqual( new Set<number>() );
        expect( state.selectionConds ).toEqual( new Set<number>() );
        expect( state.focusTarget ).toBeNull();
        expect( mocks.editorSetSelection ).not.toHaveBeenCalled();
        expect( mocks.editorSetPosition ).not.toHaveBeenCalled();
        expect( state.panzoom.zoom ).toBe( 1 );
    } );

    it( "selects and centers the edited transition condition when the cursor is on AND", async () => {
        localStorage.setItem( "uitd-editor/uitdl-live-canvas-sync", "true" );
        const transitionText = 'TRANSITION from 1 to 2 if user clicks "Save" AND "valid data";';
        mocks.editorPosition = { lineNumber: 1, column: 58 };
        mocks.reconcileUITDLTextIncrementally.mockReturnValue( {
            nodes: [
                { id: 1, displayId: "1", title: "Start", x: 100, y: 100, w: 120, h: 80, parentId: null },
                { id: 2, displayId: "2", title: "End", x: 360, y: 100, w: 120, h: 80, parentId: null },
            ],
            actions: [
                {
                    id: 9,
                    originNodeId: 1,
                    x: 210,
                    y: 120,
                    verb: "clicks",
                    complement: "Save",
                    title: 'clicks "Save"',
                },
            ],
            conditions: [
                {
                    id: 12,
                    originActionId: 9,
                    x: 260,
                    y: 180,
                    title: "valid data",
                },
            ],
            edges: [],
            fragmentTitles: {},
            nextId: 13,
            nextActionId: 10,
            nextEdgeId: 1,
            beforeSelection: { nodes: new Set<number>(), actions: new Set<number>(), conditions: new Set<number>() },
            afterSelection: { nodes: new Set<number>(), actions: new Set<number>(), conditions: new Set<number>() },
            changedCount: 1,
        } );

        render( <UITDLTextPanel onCollapse={ vi.fn() } /> );

        const editor = screen.getByLabelText( "Mock UITDL editor" ) as HTMLTextAreaElement;
        fireEvent.change( editor, { target: { value: transitionText } } );

        await waitFor( () => expect( mocks.runSimulationForCurrentSelection ).toHaveBeenCalledTimes( 1 ) );
        expect( state.selectionConds ).toEqual( new Set<number>( [ 12 ] ) );
        expect( state.selection ).toEqual( new Set<number>() );
        expect( state.selectionActions ).toEqual( new Set<number>() );
    } );

    it( "selects and centers the edited action declaration while live UITDL sync is enabled", async () => {
        localStorage.setItem( "uitd-editor/uitdl-live-canvas-sync", "true" );
        const actionText = [
            'UI 1 "Start" actions {',
            '    clicks "Save";',
            "}",
        ].join( "\n" );
        mocks.editorPosition = { lineNumber: 2, column: 12 };
        mocks.reconcileUITDLTextIncrementally.mockReturnValue( {
            nodes: [
                { id: 1, displayId: "1", title: "Start", x: 100, y: 100, w: 120, h: 80, parentId: null },
            ],
            actions: [
                {
                    id: 9,
                    originNodeId: 1,
                    x: 210,
                    y: 120,
                    verb: "clicks",
                    complement: "Save",
                    title: 'clicks "Save"',
                },
            ],
            conditions: [],
            edges: [],
            fragmentTitles: {},
            nextId: 2,
            nextActionId: 10,
            nextEdgeId: 1,
            beforeSelection: { nodes: new Set<number>(), actions: new Set<number>(), conditions: new Set<number>() },
            afterSelection: { nodes: new Set<number>(), actions: new Set<number>(), conditions: new Set<number>() },
            changedCount: 1,
        } );

        render( <UITDLTextPanel onCollapse={ vi.fn() } /> );

        const editor = screen.getByLabelText( "Mock UITDL editor" ) as HTMLTextAreaElement;
        fireEvent.change( editor, { target: { value: actionText } } );

        await waitFor( () => expect( mocks.runSimulationForCurrentSelection ).toHaveBeenCalledTimes( 1 ) );
        expect( state.selectionActions ).toEqual( new Set<number>( [ 9 ] ) );
        expect( state.selection ).toEqual( new Set<number>() );
        expect( state.selectionConds ).toEqual( new Set<number>() );
    } );

    it( "selects only the current fragment instances for an edited DRAW line", async () => {
        localStorage.setItem( "uitd-editor/uitdl-live-canvas-sync", "true" );
        const drawText = [
            'FRAGMENT "First" {',
            "    DRAW { 1 };",
            "}",
            'FRAGMENT "Second" {',
            "    DRAW { 1 };",
            "}",
        ].join( "\n" );
        mocks.editorPosition = { lineNumber: 5, column: 12 };
        mocks.reconcileUITDLTextIncrementally.mockReturnValue( {
            nodes: [
                { id: 101, displayId: "1", title: "First instance", x: 100, y: 100, w: 120, h: 80, parentId: null },
                { id: 202, displayId: "1", title: "Second instance", x: 500, y: 100, w: 120, h: 80, parentId: null },
            ],
            actions: [],
            conditions: [],
            edges: [],
            fragmentTitles: {},
            nextId: 203,
            nextActionId: 1,
            nextEdgeId: 1,
            beforeSelection: { nodes: new Set<number>(), actions: new Set<number>(), conditions: new Set<number>() },
            afterSelection: { nodes: new Set<number>(), actions: new Set<number>(), conditions: new Set<number>() },
            changedCount: 1,
        } );

        render( <UITDLTextPanel onCollapse={ vi.fn() } /> );

        const editor = screen.getByLabelText( "Mock UITDL editor" ) as HTMLTextAreaElement;
        fireEvent.change( editor, { target: { value: drawText } } );

        await waitFor( () => expect( mocks.runSimulationForCurrentSelection ).toHaveBeenCalledTimes( 1 ) );
        expect( state.selection ).toEqual( new Set<number>( [ 202 ] ) );
        expect( state.selectionActions ).toEqual( new Set<number>() );
        expect( state.selectionConds ).toEqual( new Set<number>() );
    } );
} );
