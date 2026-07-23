// src/components/UITDLTextPanel/UITDLTextPanel.test.tsx
// Verifies that applying text starts the same post-import layout simulation as canvas import.

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

type TestFragmentLocation = {
    id: string;
    nodeIds: number[];
    actionIds: number[];
    conditionIds: number[];
    lineNumber: number;
    column: number;
    endColumn: number;
};

const mocks = vi.hoisted( () => ( {
    exportToUITDL: vi.fn( ( state: { nodes: unknown[] } ) => `diagram ${state.nodes.length}` ),
    exportToUITDLWithLocations: vi.fn( ( state: { nodes: unknown[] } ) => ( {
        text: `diagram ${state.nodes.length}`,
        locations: {
            nodes: new Map(),
            actions: new Map(),
            conditions: new Map(),
            fragments: [] as TestFragmentLocation[],
        },
    } ) ),
    importUITDL: vi.fn(),
    reconcileUITDLTextIncrementally: vi.fn(),
    callOfficialUITDLValidator: vi.fn( ( text: string ) => text.includes( "BROKEN" )
        ? [ { kind: "error" as const, code: "test-error", message: "Broken text", source: "uitdl-text" as const } ]
        : []
    ),
    relayoutImportedContainers: vi.fn(),
    runSimulation: vi.fn(),
    runSimulationForCurrentSelection: vi.fn(),
    stopSimulation: vi.fn(),
    editorSetSelection: vi.fn(),
    editorSetPosition: vi.fn(),
    editorRevealLineInCenter: vi.fn(),
    editorRevealRangeInCenterIfOutsideViewport: vi.fn(),
    editorAddAction: vi.fn( () => ( { dispose: vi.fn() } ) ),
    editorTrigger: vi.fn(),
    editorDecorationSet: vi.fn(),
    editorDecorationClear: vi.fn(),
    editorSetModelMarkers: vi.fn(),
    editorPosition: { lineNumber: 1, column: 1 },
    editorModelValue: null as null | string,
    modelChangeText: null as null | ( ( event: { changes: Array<{ text: string }> } ) => void ),
    cursorPositionText: null as null | ( ( event: { position: { lineNumber: number; column: number } } ) => void ),
    focusEditorText: null as null | ( () => void ),
    blurEditorText: null as null | ( () => void ),
    keyDownEditorText: null as null | ( ( event: {
        keyCode: number;
        shiftKey: boolean;
        altKey: boolean;
        ctrlKey: boolean;
        metaKey: boolean;
        altGraphKey: boolean;
        preventDefault: () => void;
        stopPropagation: () => void;
    } ) => void ),
    importedSimulationProgress: null as null | {
        iterations: number;
        totalIterations: number | null;
        maxDisp: number;
        convergenceThreshold: number;
        stableFrames: number;
        stableFramesRequired: number;
        stopWhenConverged: boolean;
    },
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
    isCanvasLockedByUITDLLiveSync: false,
    setCanvasLockedByUITDLLiveSync: vi.fn( ( locked: boolean ) => {
        state.isCanvasLockedByUITDLLiveSync = locked;
    } ),
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
                getModel: () => ( {
                    getValue: () => mocks.editorModelValue ?? props.value,
                    getLineContent: ( lineNumber: number ) =>
                        ( mocks.editorModelValue ?? props.value ).split( "\n" )[ lineNumber - 1 ] ?? "",
                } ),
                getPosition: () => mocks.editorPosition,
                getSelection: () => ( {
                    getStartPosition: () => mocks.editorPosition,
                    getEndPosition: () => mocks.editorPosition,
                } ),
                onDidChangeModelContent: ( listener: typeof mocks.modelChangeText ) => {
                    mocks.modelChangeText = listener;
                    return { dispose: vi.fn() };
                },
                onDidChangeCursorPosition: ( listener: ( event: { position: { lineNumber: number; column: number } } ) => void ) => {
                    mocks.cursorPositionText = listener;
                    return { dispose: vi.fn() };
                },
                onDidFocusEditorText: ( listener: () => void ) => {
                    mocks.focusEditorText = listener;
                    return { dispose: vi.fn() };
                },
                onDidBlurEditorText: ( listener: () => void ) => {
                    mocks.blurEditorText = listener;
                    return { dispose: vi.fn() };
                },
                onKeyDown: ( listener: typeof mocks.keyDownEditorText ) => {
                    mocks.keyDownEditorText = listener;
                    return { dispose: vi.fn() };
                },
                trigger: mocks.editorTrigger,
                setSelection: mocks.editorSetSelection,
                setPosition: mocks.editorSetPosition,
                revealLineInCenter: mocks.editorRevealLineInCenter,
                revealRangeInCenterIfOutsideViewport: mocks.editorRevealRangeInCenterIfOutsideViewport,
                addAction: mocks.editorAddAction,
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
                KeyCode: { Tab: 2 },
                KeyMod: { Shift: 1024 },
                editor: {
                    setModelLanguage: vi.fn(),
                    setModelMarkers: mocks.editorSetModelMarkers,
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
vi.mock( "../../import/uitdl/officialValidatorCaller", () => ( {
    callOfficialUITDLValidator: mocks.callOfficialUITDLValidator,
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
        progress: mocks.importedSimulationProgress,
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
        state.isCanvasLockedByUITDLLiveSync = false;
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
                fragments: [] as TestFragmentLocation[],
            },
        } ) );
        mocks.importUITDL.mockClear();
        mocks.reconcileUITDLTextIncrementally.mockClear();
        mocks.callOfficialUITDLValidator.mockClear();
        mocks.callOfficialUITDLValidator.mockImplementation( ( text: string ) => text.includes( "BROKEN" )
            ? [ { kind: "error" as const, code: "test-error", message: "Broken text", source: "uitdl-text" as const } ]
            : []
        );
        mocks.relayoutImportedContainers.mockClear();
        mocks.runSimulation.mockClear();
        mocks.runSimulationForCurrentSelection.mockClear();
        mocks.stopSimulation.mockClear();
        mocks.editorSetSelection.mockClear();
        mocks.editorSetPosition.mockClear();
        mocks.editorRevealLineInCenter.mockClear();
        mocks.editorDecorationSet.mockClear();
        mocks.editorDecorationClear.mockClear();
        mocks.editorSetModelMarkers.mockClear();
        mocks.editorAddAction.mockClear();
        mocks.editorTrigger.mockClear();
        mocks.editorPosition = { lineNumber: 99, column: 1 };
        mocks.editorModelValue = null;
        mocks.modelChangeText = null;
        mocks.cursorPositionText = null;
        mocks.focusEditorText = null;
        mocks.blurEditorText = null;
        mocks.keyDownEditorText = null;
        mocks.importedSimulationProgress = null;
        mocks.storeListeners.length = 0;
        state.requestCanvasFitToWidth.mockClear();
        state.setCanvasLockedByUITDLLiveSync.mockClear();
    } );

    it( "relayouts containers and starts simulation after applying UITDL", async () => {
        render( <UITDLTextPanel onCollapse={ vi.fn() } /> );

        fireEvent.click( screen.getByRole( "button", { name: "Apply to diagram" } ) );

        await waitFor( () => expect( mocks.runSimulation ).toHaveBeenCalledTimes( 1 ) );
        expect( mocks.importUITDL ).toHaveBeenCalledTimes( 1 );
        expect( mocks.relayoutImportedContainers ).toHaveBeenCalledTimes( 1 );
        expect( screen.getByText( "UITDL applied. Layout simulation is running." ) ).toBeTruthy();
    } );

    it( "registers tab navigation while Monaco suggestions are visible", () => {
        render( <UITDLTextPanel onCollapse={ vi.fn() } /> );

        expect( mocks.editorAddAction ).toHaveBeenCalledWith(
            expect.objectContaining( {
                id: "uitdl.jumpToNextEditableField",
                keybindingContext: "!suggestWidgetVisible",
                precondition: "editorTextFocus",
            } )
        );
        expect( mocks.editorAddAction ).toHaveBeenCalledWith(
            expect.objectContaining( {
                id: "uitdl.jumpToNextEditableFieldWithSuggestions",
                keybindingContext: "suggestWidgetVisible",
                precondition: "editorTextFocus",
            } )
        );
        expect( mocks.editorAddAction ).toHaveBeenCalledWith(
            expect.objectContaining( {
                id: "uitdl.jumpToPreviousEditableFieldWithSuggestions",
                keybindingContext: "suggestWidgetVisible",
            } )
        );
    } );

    it( "moves from a typed transition origin to the destination when tab is pressed", () => {
        localStorage.setItem(
            "uitd-editor/uitdl-text-draft",
            'TRANSITION from 2 to 0 if user clicks "target";'
        );
        mocks.editorPosition = { lineNumber: 1, column: 18 };

        render( <UITDLTextPanel onCollapse={ vi.fn() } /> );

        const preventDefault = vi.fn();
        const stopPropagation = vi.fn();
        mocks.keyDownEditorText?.( {
            keyCode: 2,
            shiftKey: false,
            altKey: false,
            ctrlKey: false,
            metaKey: false,
            altGraphKey: false,
            preventDefault,
            stopPropagation,
        } );

        expect( preventDefault ).toHaveBeenCalledTimes( 1 );
        expect( stopPropagation ).toHaveBeenCalledTimes( 1 );
        expect( mocks.editorSetSelection ).toHaveBeenCalledWith( {
            startLineNumber: 1,
            startColumn: 22,
            endLineNumber: 1,
            endColumn: 23,
        } );
    } );

    it( "opens suggestions when the cursor enters an editable UITDL field", async () => {
        localStorage.setItem(
            "uitd-editor/uitdl-text-draft",
            'TRANSITION from 2 to 0 if user clicks "target";'
        );

        render( <UITDLTextPanel onCollapse={ vi.fn() } /> );

        mocks.focusEditorText?.();
        mocks.editorPosition = { lineNumber: 1, column: 22 };
        mocks.cursorPositionText?.( { position: mocks.editorPosition } );

        await waitFor( () => expect( mocks.editorTrigger ).toHaveBeenCalledWith(
            "uitdl-field-completion",
            "editor.action.triggerSuggest",
            {}
        ) );
    } );

    it( "does not request duplicate suggestions when typing moves the cursor into the same UITDL field", async () => {
        localStorage.setItem(
            "uitd-editor/uitdl-text-draft",
            'TRANSITION from 2 to 0 if user clicks "target";'
        );

        render( <UITDLTextPanel onCollapse={ vi.fn() } /> );

        mocks.focusEditorText?.();
        mocks.editorPosition = { lineNumber: 1, column: 18 };
        mocks.modelChangeText?.( { changes: [ { text: "2" } ] } );
        mocks.cursorPositionText?.( { position: mocks.editorPosition } );

        await waitFor( () => expect( mocks.editorTrigger ).toHaveBeenCalledTimes( 1 ) );
        expect( mocks.editorTrigger ).toHaveBeenCalledWith(
            "uitdl-uiid-completion",
            "editor.action.triggerSuggest",
            {}
        );
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
        expect( screen.getByText( "Turn off Live from canvas to edit text or use find and replace." ) ).toBeTruthy();
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
                fragments: [] as TestFragmentLocation[],
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
            expect.objectContaining( {
                range: {
                    startLineNumber: 9,
                    startColumn: 9,
                    endLineNumber: 9,
                    endColumn: 25,
                },
                options: expect.objectContaining( {
                    className: "uitdlTextPanel__canvasSyncReference",
                } ),
            } ),
        ] );
    } );

    it( "reveals a selected canvas UI at its DRAW reference column without live sync toggles", async () => {
        const drawText = [
            'FRAGMENT "Main" {',
            "    DRAW { 3[1] };",
            "}",
        ].join( "\n" );
        mocks.exportToUITDL.mockReturnValue( drawText );
        mocks.exportToUITDLWithLocations.mockReturnValue( {
            text: drawText,
            locations: {
                nodes: new Map( [ [ 1, [ { lineNumber: 2, column: 14, endColumn: 15 } ] ] ] ),
                actions: new Map(),
                conditions: new Map(),
                fragments: [] as TestFragmentLocation[],
            },
        } );
        localStorage.setItem( "uitd-editor/uitdl-text-draft", drawText );

        render( <UITDLTextPanel onCollapse={ vi.fn() } /> );

        state.selection = new Set<number>( [ 1 ] );
        for ( const listener of mocks.storeListeners ) listener();

        await waitFor( () => expect( mocks.editorSetPosition ).toHaveBeenCalledWith( {
            lineNumber: 2,
            column: 14,
        } ) );
        expect( mocks.editorSetSelection ).toHaveBeenCalledWith( {
            startLineNumber: 2,
            startColumn: 14,
            endLineNumber: 2,
            endColumn: 15,
        } );
        expect( mocks.editorRevealLineInCenter ).toHaveBeenCalledWith( 2 );
        expect( mocks.editorDecorationSet ).toHaveBeenCalledWith( [
            expect.objectContaining( {
                range: {
                    startLineNumber: 2,
                    startColumn: 1,
                    endLineNumber: 2,
                    endColumn: 1,
                },
            } ),
            expect.objectContaining( {
                range: {
                    startLineNumber: 2,
                    startColumn: 14,
                    endLineNumber: 2,
                    endColumn: 15,
                },
                options: expect.objectContaining( {
                    className: "uitdlTextPanel__canvasSyncReference",
                } ),
            } ),
        ] );
    } );

    it( "reveals a selected canvas action at its action phrase without bouncing back to canvas", async () => {
        localStorage.setItem( "uitd-editor/canvas-live-uitdl-sync", "true" );
        const transitionText = 'TRANSITION from 1 to 2 if user clicks "Renamed";';
        const actionColumn = transitionText.indexOf( 'clicks "Renamed"' ) + 1;
        mocks.exportToUITDL.mockReturnValue( transitionText );
        mocks.exportToUITDLWithLocations.mockReturnValue( {
            text: transitionText,
            locations: {
                nodes: new Map(),
                actions: new Map( [ [ 9, [ {
                    lineNumber: 1,
                    column: actionColumn,
                    endColumn: actionColumn + 'clicks "Renamed"'.length,
                } ] ] ] ),
                conditions: new Map(),
                fragments: [] as TestFragmentLocation[],
            },
        } );

        render( <UITDLTextPanel onCollapse={ vi.fn() } /> );

        state.selection = new Set<number>();
        state.selectionActions = new Set<number>( [ 9 ] );
        state.selectionConds = new Set<number>();
        for ( const listener of mocks.storeListeners ) listener();

        await waitFor( () => expect( mocks.editorSetSelection ).toHaveBeenCalledWith( {
            startLineNumber: 1,
            startColumn: actionColumn,
            endLineNumber: 1,
            endColumn: actionColumn + 'clicks "Renamed"'.length,
        } ) );

        mocks.cursorPositionText?.( { position: { lineNumber: 1, column: actionColumn } } );

        await new Promise( resolve => window.setTimeout( resolve, 0 ) );
        expect( state.selection ).toEqual( new Set<number>() );
        expect( state.selectionActions ).toEqual( new Set<number>( [ 9 ] ) );
        expect( state.selectionConds ).toEqual( new Set<number>() );
    } );

    it( "does not let a stale text cursor select UI 1 after editing a UI 2 canvas action", async () => {
        localStorage.setItem( "uitd-editor/canvas-live-uitdl-sync", "true" );
        const text = [
            'UITD "UITD Diagram" {',
            '    UI 1 "Node 1" actions {',
            '        clicks "submit";',
            "    }",
            '    UI 2 "Creación de cuenta" actions {',
            '        clicks "cancel";',
            '        clicks "crear cuenta";',
            "    }",
            '    UI 3 "Home" actions {',
            '        clicks "logout";',
            "    }",
            '    FRAGMENT "Fragment 1" {',
            "        DRAW { 1, 2, 3 };",
            '        TRANSITION from 1 to 1 if user clicks "submit" AND "not ok";',
            '        TRANSITION from 1 to 3 if user clicks "submit" AND "ok";',
            '        TRANSITION from 2 to 1 if user clicks "cancel";',
            '        TRANSITION from 2 to 1 if user clicks "crear cuenta";',
            '        TRANSITION from 3 to 1 if user clicks "logout";',
            "    }",
            "}",
        ].join( "\n" );
        const actionColumn = text.split( "\n" )[ 15 ].indexOf( 'clicks "cancel"' ) + 1;
        mocks.editorPosition = { lineNumber: 14, column: 45 };
        mocks.exportToUITDL.mockReturnValue( text );
        mocks.exportToUITDLWithLocations.mockReturnValue( {
            text,
            locations: {
                nodes: new Map(),
                actions: new Map( [ [ 20, [ {
                    lineNumber: 16,
                    column: actionColumn,
                    endColumn: actionColumn + 'clicks "cancel"'.length,
                } ] ] ] ),
                conditions: new Map(),
                fragments: [] as TestFragmentLocation[],
            },
        } );
        state.nodes = [
            { id: 1, displayId: "1", title: "Node 1", x: 100, y: 100, w: 120, h: 80, parentId: null },
            { id: 2, displayId: "2", title: "Creación de cuenta", x: 300, y: 100, w: 120, h: 80, parentId: null },
            { id: 3, displayId: "3", title: "Home", x: 500, y: 100, w: 120, h: 80, parentId: null },
        ];
        state.actions = [
            { id: 10, originNodeId: 1, x: 120, y: 160, verb: "clicks", complement: "submit", title: 'clicks "submit"' },
            { id: 20, originNodeId: 2, x: 320, y: 160, verb: "clicks", complement: "cancel", title: 'clicks "cancel"' },
            { id: 21, originNodeId: 2, x: 320, y: 220, verb: "clicks", complement: "crear cuenta", title: 'clicks "crear cuenta"' },
            { id: 30, originNodeId: 3, x: 520, y: 160, verb: "clicks", complement: "logout", title: 'clicks "logout"' },
        ];
        state.conditions = [];
        state.edges = [
            { id: 1, from: { kind: "node", id: 1 }, to: { kind: "action", id: 10 }, style: "solid" },
            { id: 2, from: { kind: "action", id: 10 }, to: { kind: "node", id: 1 }, style: "dashed1" },
            { id: 3, from: { kind: "node", id: 2 }, to: { kind: "action", id: 20 }, style: "solid" },
            { id: 4, from: { kind: "action", id: 20 }, to: { kind: "node", id: 1 }, style: "dashed1" },
        ];

        render( <UITDLTextPanel onCollapse={ vi.fn() } /> );

        state.selection = new Set<number>();
        state.selectionActions = new Set<number>( [ 20 ] );
        state.selectionConds = new Set<number>();
        for ( const listener of mocks.storeListeners ) listener();

        await waitFor( () => expect( mocks.editorSetSelection ).toHaveBeenCalledWith( {
            startLineNumber: 16,
            startColumn: actionColumn,
            endLineNumber: 16,
            endColumn: actionColumn + 'clicks "cancel"'.length,
        } ) );

        mocks.cursorPositionText?.( { position: { lineNumber: 14, column: 45 } } );

        await new Promise( resolve => window.setTimeout( resolve, 0 ) );
        expect( state.selection ).toEqual( new Set<number>() );
        expect( state.selectionActions ).toEqual( new Set<number>( [ 20 ] ) );
        expect( state.selectionConds ).toEqual( new Set<number>() );
    } );

    it( "does not re-run text reveal when only the canvas camera changes", async () => {
        const drawText = [
            'FRAGMENT "Main" {',
            "    DRAW { 3[1] };",
            "}",
        ].join( "\n" );
        mocks.exportToUITDL.mockReturnValue( drawText );
        mocks.exportToUITDLWithLocations.mockReturnValue( {
            text: drawText,
            locations: {
                nodes: new Map( [ [ 1, [ { lineNumber: 2, column: 14, endColumn: 15 } ] ] ] ),
                actions: new Map(),
                conditions: new Map(),
                fragments: [] as TestFragmentLocation[],
            },
        } );
        localStorage.setItem( "uitd-editor/uitdl-text-draft", drawText );

        render( <UITDLTextPanel onCollapse={ vi.fn() } /> );

        state.selection = new Set<number>( [ 1 ] );
        for ( const listener of mocks.storeListeners ) listener();

        await waitFor( () => expect( mocks.editorSetPosition ).toHaveBeenCalledTimes( 1 ) );

        state.panzoom = { x: 20, y: -15, zoom: 1.15 };
        for ( const listener of mocks.storeListeners ) listener();

        await new Promise( resolve => window.setTimeout( resolve, 0 ) );
        expect( mocks.editorSetPosition ).toHaveBeenCalledTimes( 1 );
    } );

    it( "keeps a multi-node canvas selection after the text cursor is moved by reveal", async () => {
        const drawText = [
            'FRAGMENT "Main" {',
            "    DRAW { 1, 2 };",
            "}",
        ].join( "\n" );
        mocks.exportToUITDL.mockReturnValue( drawText );
        mocks.exportToUITDLWithLocations.mockReturnValue( {
            text: drawText,
            locations: {
                nodes: new Map( [
                    [ 101, [ { lineNumber: 2, column: 12, endColumn: 13 } ] ],
                    [ 102, [ { lineNumber: 2, column: 15, endColumn: 16 } ] ],
                ] ),
                actions: new Map(),
                conditions: new Map(),
                fragments: [] as TestFragmentLocation[],
            },
        } );
        localStorage.setItem( "uitd-editor/uitdl-text-draft", drawText );
        state.nodes = [
            { id: 101, displayId: "1", title: "First", x: 100, y: 100, w: 120, h: 80, parentId: null },
            { id: 102, displayId: "2", title: "Second", x: 300, y: 100, w: 120, h: 80, parentId: null },
        ];
        state.panzoom = { x: 40, y: 30, zoom: 1 };

        render( <UITDLTextPanel onCollapse={ vi.fn() } /> );

        state.selection = new Set<number>( [ 101, 102 ] );
        for ( const listener of mocks.storeListeners ) listener();

        await waitFor( () => expect( mocks.editorSetPosition ).toHaveBeenCalledWith( {
            lineNumber: 2,
            column: 12,
        } ) );
        mocks.cursorPositionText?.( { position: { lineNumber: 2, column: 16 } } );
        mocks.cursorPositionText?.( { position: { lineNumber: 2, column: 12 } } );

        await new Promise( resolve => window.setTimeout( resolve, 0 ) );
        expect( state.selection ).toEqual( new Set<number>( [ 101, 102 ] ) );
        expect( state.selectionActions ).toEqual( new Set<number>() );
        expect( state.selectionConds ).toEqual( new Set<number>() );
        expect( state.panzoom ).toEqual( { x: 40, y: 30, zoom: 1 } );
    } );

    it( "does not move the text cursor back after selecting from the text cursor", async () => {
        const drawText = [
            'FRAGMENT "First" {',
            "    DRAW { 2[1] };",
            "}",
            'FRAGMENT "Second" {',
            "    DRAW { 3[1] };",
            "}",
        ].join( "\n" );
        localStorage.setItem( "uitd-editor/uitdl-text-draft", drawText );
        mocks.exportToUITDL.mockReturnValue( drawText );
        state.nodes = [
            { id: 201, displayId: "2", title: "First container", x: 100, y: 100, w: 120, h: 80, parentId: null },
            { id: 301, displayId: "3", title: "Second container", x: 500, y: 100, w: 120, h: 80, parentId: null },
            { id: 102, displayId: "1", title: "Second child", x: 520, y: 120, w: 80, h: 40, parentId: 301 },
            { id: 101, displayId: "1", title: "First child", x: 120, y: 120, w: 80, h: 40, parentId: 201 },
        ];
        mocks.editorPosition = { lineNumber: 5, column: 14 };

        render( <UITDLTextPanel onCollapse={ vi.fn() } /> );
        mocks.focusEditorText?.();
        mocks.cursorPositionText?.( { position: { lineNumber: 5, column: 14 } } );

        await waitFor( () => expect( state.selection ).toEqual( new Set<number>( [ 102 ] ) ) );
        await new Promise( resolve => window.setTimeout( resolve, 0 ) );
        expect( mocks.editorSetSelection ).not.toHaveBeenCalled();
        expect( mocks.editorSetPosition ).not.toHaveBeenCalled();
        expect( mocks.editorRevealLineInCenter ).not.toHaveBeenCalled();
    } );

    it( "does not reveal a selected DRAW reference again while typing in the focused editor", async () => {
        const drawText = [
            'FRAGMENT "First" {',
            "    DRAW { 2[1] };",
            "}",
            'FRAGMENT "Second" {',
            "    DRAW { 3[1] };",
            "}",
        ].join( "\n" );
        localStorage.setItem( "uitd-editor/uitdl-text-draft", drawText );
        mocks.exportToUITDL.mockReturnValue( drawText );
        state.nodes = [
            { id: 201, displayId: "2", title: "First container", x: 100, y: 100, w: 120, h: 80, parentId: null },
            { id: 301, displayId: "3", title: "Second container", x: 500, y: 100, w: 120, h: 80, parentId: null },
            { id: 102, displayId: "1", title: "Second child", x: 520, y: 120, w: 80, h: 40, parentId: 301 },
            { id: 101, displayId: "1", title: "First child", x: 120, y: 120, w: 80, h: 40, parentId: 201 },
        ];
        mocks.editorPosition = { lineNumber: 5, column: 14 };

        render( <UITDLTextPanel onCollapse={ vi.fn() } /> );
        mocks.focusEditorText?.();
        mocks.cursorPositionText?.( { position: { lineNumber: 5, column: 14 } } );

        await waitFor( () => expect( state.selection ).toEqual( new Set<number>( [ 102 ] ) ) );
        mocks.editorSetSelection.mockClear();
        mocks.editorSetPosition.mockClear();
        mocks.editorRevealLineInCenter.mockClear();

        const editor = screen.getByLabelText( "Mock UITDL editor" ) as HTMLTextAreaElement;
        fireEvent.change( editor, { target: { value: drawText.replace( "3[1]", "30[1]" ) } } );

        await new Promise( resolve => window.setTimeout( resolve, 0 ) );
        expect( mocks.editorSetSelection ).not.toHaveBeenCalled();
        expect( mocks.editorSetPosition ).not.toHaveBeenCalled();
        expect( mocks.editorRevealLineInCenter ).not.toHaveBeenCalled();
    } );

    it( "does not select from stale text while Monaco has a newer DRAW edit", async () => {
        const drawText = [
            'FRAGMENT "First" {',
            "    DRAW { 2[1] };",
            "}",
            'FRAGMENT "Second" {',
            "    DRAW { 3[1] };",
            "}",
        ].join( "\n" );
        localStorage.setItem( "uitd-editor/uitdl-text-draft", drawText );
        mocks.exportToUITDL.mockReturnValue( drawText );
        state.nodes = [
            { id: 201, displayId: "2", title: "First container", x: 100, y: 100, w: 120, h: 80, parentId: null },
            { id: 301, displayId: "3", title: "Second container", x: 500, y: 100, w: 120, h: 80, parentId: null },
            { id: 102, displayId: "1", title: "Second child", x: 520, y: 120, w: 80, h: 40, parentId: 301 },
            { id: 101, displayId: "1", title: "First child", x: 120, y: 120, w: 80, h: 40, parentId: 201 },
        ];
        mocks.editorPosition = { lineNumber: 99, column: 1 };

        render( <UITDLTextPanel onCollapse={ vi.fn() } /> );
        state.selection = new Set<number>();
        state.selectionActions = new Set<number>();
        state.selectionConds = new Set<number>();
        mocks.editorModelValue = drawText.replace( "3[1]", "30[1]" );
        mocks.editorPosition = { lineNumber: 5, column: 15 };
        mocks.cursorPositionText?.( { position: { lineNumber: 5, column: 15 } } );

        await new Promise( resolve => window.setTimeout( resolve, 0 ) );
        expect( state.selection ).toEqual( new Set<number>() );
        expect( state.selectionActions ).toEqual( new Set<number>() );
        expect( state.selectionConds ).toEqual( new Set<number>() );
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
                fragments: [] as TestFragmentLocation[],
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
        expect( mocks.editorDecorationSet ).toHaveBeenCalledWith( expect.arrayContaining( [
            expect.objectContaining( { range: expect.objectContaining( { startLineNumber: 8 } ) } ),
            expect.objectContaining( { range: expect.objectContaining( { startLineNumber: 14 } ) } ),
            expect.objectContaining( { range: expect.objectContaining( { startLineNumber: 20 } ) } ),
        ] ) );
    } );

    it( "round-trips a nested DRAW UI selection between canvas and text", async () => {
        const drawText = [
            'FRAGMENT "First" {',
            "    DRAW { 2[1] };",
            "}",
            'FRAGMENT "Second" {',
            "    DRAW { 3[1] };",
            "}",
        ].join( "\n" );
        const project = {
            nodes: [
                { id: 201, displayId: "2", title: "First container", x: 100, y: 100, w: 120, h: 80, parentId: null },
                { id: 301, displayId: "3", title: "Second container", x: 500, y: 100, w: 120, h: 80, parentId: null },
                { id: 102, displayId: "1", title: "Second child", x: 520, y: 120, w: 80, h: 40, parentId: 301 },
                { id: 101, displayId: "1", title: "First child", x: 120, y: 120, w: 80, h: 40, parentId: 201 },
            ],
            actions: [],
            conditions: [],
            edges: [],
        };
        localStorage.setItem( "uitd-editor/canvas-live-uitdl-sync", "true" );
        mocks.exportToUITDL.mockReturnValue( drawText );
        mocks.exportToUITDLWithLocations.mockReturnValue( {
            text: drawText,
            locations: {
                nodes: new Map( [ [ 102, [ { lineNumber: 5, column: 14, endColumn: 15 } ] ] ] ),
                actions: new Map(),
                conditions: new Map(),
                fragments: [] as TestFragmentLocation[],
            },
        } );

        const { unmount } = render( <UITDLTextPanel onCollapse={ vi.fn() } /> );

        state.nodes = project.nodes;
        state.selection = new Set<number>( [ 102 ] );
        for ( const listener of mocks.storeListeners ) listener();

        await waitFor( () => expect( mocks.editorSetPosition ).toHaveBeenCalledWith( {
            lineNumber: 5,
            column: 14,
        } ) );
        unmount();

        localStorage.setItem( "uitd-editor/canvas-live-uitdl-sync", "false" );
        localStorage.setItem( "uitd-editor/uitdl-live-canvas-sync", "true" );
        mocks.storeListeners.length = 0;
        mocks.editorPosition = { lineNumber: 5, column: 14 };
        mocks.reconcileUITDLTextIncrementally.mockReturnValue( {
            ...project,
            fragmentTitles: {},
            nextId: 302,
            nextActionId: 1,
            nextEdgeId: 1,
            beforeSelection: { nodes: new Set<number>(), actions: new Set<number>(), conditions: new Set<number>() },
            afterSelection: { nodes: new Set<number>(), actions: new Set<number>(), conditions: new Set<number>() },
            changedCount: 0,
        } );

        render( <UITDLTextPanel onCollapse={ vi.fn() } /> );
        const editor = screen.getByLabelText( "Mock UITDL editor" ) as HTMLTextAreaElement;
        fireEvent.change( editor, { target: { value: drawText } } );

        await waitFor( () => expect( state.selection ).toEqual( new Set<number>( [ 102 ] ) ) );
        expect( state.selection ).toEqual( new Set<number>( [ 102 ] ) );
        expect( state.selectionActions ).toEqual( new Set<number>() );
        expect( state.selectionConds ).toEqual( new Set<number>() );
    } );

    it( "round-trips a fragment selection between canvas and text", async () => {
        const drawText = [
            'FRAGMENT "First" {',
            "    DRAW { 2[1] };",
            "}",
            'FRAGMENT "Second" {',
            "    DRAW { 3[1] };",
            "}",
        ].join( "\n" );
        const project = {
            nodes: [
                { id: 201, displayId: "2", title: "First container", x: 100, y: 100, w: 120, h: 80, parentId: null },
                { id: 301, displayId: "3", title: "Second container", x: 500, y: 100, w: 120, h: 80, parentId: null },
                { id: 102, displayId: "1", title: "Second child", x: 520, y: 120, w: 80, h: 40, parentId: 301 },
                { id: 101, displayId: "1", title: "First child", x: 120, y: 120, w: 80, h: 40, parentId: 201 },
            ],
            actions: [],
            conditions: [],
            edges: [],
        };
        localStorage.setItem( "uitd-editor/canvas-live-uitdl-sync", "true" );
        mocks.exportToUITDL.mockReturnValue( drawText );
        mocks.exportToUITDLWithLocations.mockReturnValue( {
            text: drawText,
            locations: {
                nodes: new Map(),
                actions: new Map(),
                conditions: new Map(),
                fragments: [
                    {
                        id: "node:102|node:301",
                        nodeIds: [ 102, 301 ],
                        actionIds: [],
                        conditionIds: [],
                        lineNumber: 4,
                        column: 5,
                        endColumn: 24,
                    },
                ],
            },
        } );

        const { unmount } = render( <UITDLTextPanel onCollapse={ vi.fn() } /> );

        state.nodes = project.nodes;
        state.selection = new Set<number>( [ 301, 102 ] );
        for ( const listener of mocks.storeListeners ) listener();

        await waitFor( () => expect( mocks.editorSetPosition ).toHaveBeenCalledWith( {
            lineNumber: 4,
            column: 5,
        } ) );
        unmount();

        localStorage.setItem( "uitd-editor/canvas-live-uitdl-sync", "false" );
        localStorage.setItem( "uitd-editor/uitdl-live-canvas-sync", "true" );
        mocks.storeListeners.length = 0;
        mocks.editorPosition = { lineNumber: 4, column: 5 };
        mocks.reconcileUITDLTextIncrementally.mockReturnValue( {
            ...project,
            fragmentTitles: {},
            nextId: 302,
            nextActionId: 1,
            nextEdgeId: 1,
            beforeSelection: { nodes: new Set<number>(), actions: new Set<number>(), conditions: new Set<number>() },
            afterSelection: { nodes: new Set<number>(), actions: new Set<number>(), conditions: new Set<number>() },
            changedCount: 0,
        } );

        render( <UITDLTextPanel onCollapse={ vi.fn() } /> );
        const editor = screen.getByLabelText( "Mock UITDL editor" ) as HTMLTextAreaElement;
        fireEvent.change( editor, { target: { value: drawText } } );

        await waitFor( () => expect( state.selection ).toEqual( new Set<number>( [ 102, 301 ] ) ) );
        expect( state.selection ).toEqual( new Set<number>( [ 102, 301 ] ) );
        expect( state.selectionActions ).toEqual( new Set<number>() );
        expect( state.selectionConds ).toEqual( new Set<number>() );
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
                fragments: [] as TestFragmentLocation[],
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
            expect( screen.getByText( "Broken text" ) ).toBeTruthy();
        } );
        expect( editor.value ).toBe( "BROKEN UITDL" );
        expect( mocks.editorSetModelMarkers ).toHaveBeenCalledWith(
            expect.anything(),
            "uitdl",
            expect.arrayContaining( [
                expect.objectContaining( {
                    message: "Broken text",
                    startLineNumber: 1,
                    startColumn: 1,
                    endLineNumber: 1,
                    endColumn: 2,
                } ),
            ] )
        );

        await waitFor( () => {
            expect( screen.getByText( "Canvas kept the last valid UITDL because the text has errors." ) ).toBeTruthy();
        } );
        expect( mocks.reconcileUITDLTextIncrementally ).not.toHaveBeenCalled();
        expect( mocks.stopSimulation ).toHaveBeenCalledTimes( 1 );
    } );

    it( "prevalidates live UITDL immediately before changing the canvas", async () => {
        localStorage.setItem( "uitd-editor/uitdl-live-canvas-sync", "true" );
        let shouldBlockPreflight = false;
        mocks.callOfficialUITDLValidator.mockImplementation( ( text: string ) =>
            text === "DUPLICATE DRAW" && shouldBlockPreflight
                ? [ {
                    kind: "error" as const,
                    code: "duplicate-draw-reference",
                    message: 'Duplicate DRAW reference "1" in fragment "Fragment 1". Remove the repeated reference.',
                    line: 13,
                    col: 25,
                    source: "uitdl-text" as const,
                } ]
                : []
        );

        render( <UITDLTextPanel onCollapse={ vi.fn() } /> );

        const editor = screen.getByLabelText( "Mock UITDL editor" ) as HTMLTextAreaElement;
        fireEvent.change( editor, { target: { value: "DUPLICATE DRAW" } } );
        shouldBlockPreflight = true;

        await waitFor( () => {
            expect( screen.getByText( "Canvas kept the last valid UITDL because the text has errors." ) ).toBeTruthy();
        } );
        expect( mocks.reconcileUITDLTextIncrementally ).not.toHaveBeenCalled();
        expect( mocks.stopSimulation ).toHaveBeenCalledTimes( 1 );
        expect( state.nodes ).toEqual( [] );
    } );

    it( "stops live simulation progress when incremental UITDL reconciliation fails", async () => {
        localStorage.setItem( "uitd-editor/uitdl-live-canvas-sync", "true" );
        mocks.reconcileUITDLTextIncrementally.mockImplementation( () => {
            throw new Error( "Live UITDL sync requires parseable text." );
        } );

        render( <UITDLTextPanel onCollapse={ vi.fn() } /> );

        const editor = screen.getByLabelText( "Mock UITDL editor" ) as HTMLTextAreaElement;
        fireEvent.change( editor, { target: { value: "VALID UITDL AFTER TRANSIENT ERROR" } } );

        await waitFor( () => {
            expect( screen.getByText( "Live UITDL sync requires parseable text." ) ).toBeTruthy();
        } );
        expect( mocks.stopSimulation ).toHaveBeenCalledTimes( 1 );
        expect( mocks.runSimulationForCurrentSelection ).not.toHaveBeenCalled();
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

    it( "centers selected live UITDL elements after simulation without changing zoom", async () => {
        localStorage.setItem( "uitd-editor/uitdl-live-canvas-sync", "true" );
        state.panzoom = { x: 12, y: -18, zoom: 1.75 };

        const { rerender } = render( <UITDLTextPanel onCollapse={ vi.fn() } /> );

        const editor = screen.getByLabelText( "Mock UITDL editor" ) as HTMLTextAreaElement;
        fireEvent.change( editor, { target: { value: "valid live UITDL" } } );

        await waitFor( () => expect( mocks.runSimulationForCurrentSelection ).toHaveBeenCalledTimes( 1 ) );

        mocks.importedSimulationProgress = {
            iterations: 1,
            totalIterations: null,
            maxDisp: 10,
            convergenceThreshold: 20,
            stableFrames: 1,
            stableFramesRequired: 8,
            stopWhenConverged: true,
        };
        rerender( <UITDLTextPanel onCollapse={ vi.fn() } /> );

        mocks.importedSimulationProgress = null;
        rerender( <UITDLTextPanel onCollapse={ vi.fn() } /> );

        expect( state.requestCanvasFitToWidth ).not.toHaveBeenCalled();
        expect( state.panzoom.zoom ).toBe( 1.75 );
        expect( state.panzoom.x ).toBe( 325 );
        expect( state.panzoom.y ).toBe( 225 );
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
                fragments: [] as TestFragmentLocation[],
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
            edges: [
                { id: 1, from: { kind: "node", id: 1 }, to: { kind: "action", id: 9 }, style: "solid" },
                { id: 2, from: { kind: "action", id: 9 }, to: { kind: "node", id: 2 }, style: "solid" },
            ],
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
        expect( state.selection ).toEqual( new Set<number>( [ 1, 2 ] ) );
        expect( state.selectionConds ).toEqual( new Set<number>() );
        expect( state.focusTarget ).toBeNull();
        expect( mocks.editorSetSelection ).not.toHaveBeenCalled();
        expect( mocks.editorSetPosition ).not.toHaveBeenCalled();
        expect( state.panzoom.zoom ).toBe( 1 );
    } );

    it( "keeps all reconciled changes selected after a live bulk text edit", async () => {
        localStorage.setItem( "uitd-editor/uitdl-live-canvas-sync", "true" );
        const text = "UI 2 \"Start\"";
        mocks.editorPosition = { lineNumber: 1, column: 4 };
        mocks.exportToUITDLWithLocations.mockReturnValue( {
            text,
            locations: {
                nodes: new Map( [ [ 1, [ { lineNumber: 1, column: 1, endColumn: text.length + 1 } ] ] ] ),
                actions: new Map(),
                conditions: new Map(),
                fragments: [] as TestFragmentLocation[],
            },
        } );
        mocks.reconcileUITDLTextIncrementally.mockReturnValue( {
            nodes: [
                { id: 1, displayId: "2", title: "Start", x: 100, y: 100, w: 120, h: 80, parentId: null },
                { id: 2, displayId: "3", title: "Next", x: 360, y: 100, w: 120, h: 80, parentId: null },
            ],
            actions: [],
            conditions: [],
            edges: [],
            fragmentTitles: {},
            nextId: 3,
            nextActionId: 1,
            nextEdgeId: 1,
            beforeSelection: { nodes: new Set<number>(), actions: new Set<number>(), conditions: new Set<number>() },
            afterSelection: {
                nodes: new Set<number>( [ 1, 2 ] ),
                actions: new Set<number>(),
                conditions: new Set<number>(),
            },
            changedCount: 2,
        } );

        render( <UITDLTextPanel onCollapse={ vi.fn() } /> );

        const editor = screen.getByLabelText( "Mock UITDL editor" ) as HTMLTextAreaElement;
        fireEvent.change( editor, { target: { value: text } } );

        await waitFor( () => expect( mocks.runSimulationForCurrentSelection ).toHaveBeenCalledTimes( 1 ) );
        expect( state.selection ).toEqual( new Set<number>( [ 1, 2 ] ) );
        expect( state.selectionActions ).toEqual( new Set<number>() );
        expect( state.selectionConds ).toEqual( new Set<number>() );
    } );

    it( "reveals canvas selections after a live transition update when exported text differs", async () => {
        localStorage.setItem( "uitd-editor/uitdl-live-canvas-sync", "true" );
        const transitionText = [
            'UITD "Example" {',
            '    UI 1 "Start" actions { clicks "Save"; }',
            '    UI 2 "End" actions {}',
            "",
            '    FRAGMENT "Flow" {',
            "        DRAW { 1, 2 };",
            '        TRANSITION from 1 to 2 if user clicks "Save";',
            "    }",
            "}",
        ].join( "\n" );
        mocks.editorPosition = { lineNumber: 7, column: 42 };
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
            edges: [
                { id: 1, from: { kind: "node", id: 1 }, to: { kind: "action", id: 9 }, style: "solid" },
                { id: 2, from: { kind: "action", id: 9 }, to: { kind: "node", id: 2 }, style: "solid" },
            ],
            fragmentTitles: {},
            nextId: 3,
            nextActionId: 10,
            nextEdgeId: 3,
            beforeSelection: { nodes: new Set<number>(), actions: new Set<number>(), conditions: new Set<number>() },
            afterSelection: {
                nodes: new Set<number>( [ 1, 2 ] ),
                actions: new Set<number>( [ 9 ] ),
                conditions: new Set<number>(),
            },
            changedCount: 1,
        } );
        mocks.exportToUITDLWithLocations.mockReturnValue( {
            text: "canonical text that does not match the visible editor text",
            locations: {
                nodes: new Map(),
                actions: new Map(),
                conditions: new Map(),
                fragments: [] as TestFragmentLocation[],
            },
        } );

        render( <UITDLTextPanel onCollapse={ vi.fn() } /> );

        const editor = screen.getByLabelText( "Mock UITDL editor" ) as HTMLTextAreaElement;
        fireEvent.change( editor, { target: { value: transitionText } } );

        await waitFor( () => expect( mocks.runSimulationForCurrentSelection ).toHaveBeenCalledTimes( 1 ) );
        mocks.editorSetSelection.mockClear();
        mocks.editorSetPosition.mockClear();
        mocks.editorRevealLineInCenter.mockClear();

        state.selection = new Set<number>( [ 2 ] );
        state.selectionActions = new Set<number>();
        state.selectionConds = new Set<number>();
        for ( const listener of mocks.storeListeners ) listener();

        await waitFor( () => expect( mocks.editorSetSelection ).toHaveBeenCalledWith( {
            startLineNumber: 6,
            startColumn: 19,
            endLineNumber: 6,
            endColumn: 20,
        } ) );
        expect( mocks.editorSetPosition ).toHaveBeenCalledWith( {
            lineNumber: 6,
            column: 19,
        } );
        expect( mocks.editorRevealLineInCenter ).toHaveBeenCalledWith( 6 );
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
            edges: [
                { id: 1, from: { kind: "node", id: 1 }, to: { kind: "action", id: 9 }, style: "solid" },
                { id: 2, from: { kind: "action", id: 9 }, to: { kind: "condition", id: 12 }, style: "solid" },
                { id: 3, from: { kind: "condition", id: 12 }, to: { kind: "node", id: 2 }, style: "solid" },
            ],
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
        expect( state.selectionActions ).toEqual( new Set<number>( [ 9 ] ) );
        expect( state.selection ).toEqual( new Set<number>( [ 2 ] ) );
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
        mocks.editorPosition = { lineNumber: 5, column: 10 };
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

    it( "selects nested DRAW children only under the current fragment container", async () => {
        localStorage.setItem( "uitd-editor/uitdl-live-canvas-sync", "true" );
        const drawText = [
            'FRAGMENT "First" {',
            "    DRAW { 2[1] };",
            "}",
            'FRAGMENT "Second" {',
            "    DRAW { 3[1] };",
            "}",
        ].join( "\n" );
        mocks.editorPosition = { lineNumber: 5, column: 10 };
        mocks.reconcileUITDLTextIncrementally.mockReturnValue( {
            nodes: [
                { id: 201, displayId: "2", title: "First container", x: 100, y: 100, w: 120, h: 80, parentId: null },
                { id: 301, displayId: "3", title: "Second container", x: 500, y: 100, w: 120, h: 80, parentId: null },
                { id: 102, displayId: "1", title: "Second child", x: 520, y: 120, w: 80, h: 40, parentId: 301 },
                { id: 101, displayId: "1", title: "First child", x: 120, y: 120, w: 80, h: 40, parentId: 201 },
            ],
            actions: [],
            conditions: [],
            edges: [],
            fragmentTitles: {},
            nextId: 302,
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
        expect( state.selection ).toEqual( new Set<number>( [ 301, 102 ] ) );
        expect( state.selectionActions ).toEqual( new Set<number>() );
        expect( state.selectionConds ).toEqual( new Set<number>() );
    } );

    it( "selects only the nested DRAW container under the cursor", async () => {
        localStorage.setItem( "uitd-editor/uitdl-live-canvas-sync", "true" );
        const drawText = [
            'FRAGMENT "First" {',
            "    DRAW { 2[1] };",
            "}",
            'FRAGMENT "Second" {',
            "    DRAW { 3[1] };",
            "}",
        ].join( "\n" );
        mocks.editorPosition = { lineNumber: 5, column: 12 };
        mocks.reconcileUITDLTextIncrementally.mockReturnValue( {
            nodes: [
                { id: 201, displayId: "2", title: "First container", x: 100, y: 100, w: 120, h: 80, parentId: null },
                { id: 301, displayId: "3", title: "Second container", x: 500, y: 100, w: 120, h: 80, parentId: null },
                { id: 102, displayId: "1", title: "Second child", x: 520, y: 120, w: 80, h: 40, parentId: 301 },
                { id: 101, displayId: "1", title: "First child", x: 120, y: 120, w: 80, h: 40, parentId: 201 },
            ],
            actions: [],
            conditions: [],
            edges: [],
            fragmentTitles: {},
            nextId: 302,
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
        expect( state.selection ).toEqual( new Set<number>( [ 301 ] ) );
        expect( state.selectionActions ).toEqual( new Set<number>() );
        expect( state.selectionConds ).toEqual( new Set<number>() );
    } );

    it( "selects only the nested DRAW child under the cursor", async () => {
        localStorage.setItem( "uitd-editor/uitdl-live-canvas-sync", "true" );
        const drawText = [
            'FRAGMENT "First" {',
            "    DRAW { 2[1] };",
            "}",
            'FRAGMENT "Second" {',
            "    DRAW { 3[1] };",
            "}",
        ].join( "\n" );
        mocks.editorPosition = { lineNumber: 5, column: 14 };
        mocks.reconcileUITDLTextIncrementally.mockReturnValue( {
            nodes: [
                { id: 201, displayId: "2", title: "First container", x: 100, y: 100, w: 120, h: 80, parentId: null },
                { id: 301, displayId: "3", title: "Second container", x: 500, y: 100, w: 120, h: 80, parentId: null },
                { id: 102, displayId: "1", title: "Second child", x: 520, y: 120, w: 80, h: 40, parentId: 301 },
                { id: 101, displayId: "1", title: "First child", x: 120, y: 120, w: 80, h: 40, parentId: 201 },
            ],
            actions: [],
            conditions: [],
            edges: [],
            fragmentTitles: {},
            nextId: 302,
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
        expect( state.selection ).toEqual( new Set<number>( [ 102 ] ) );
        expect( state.selectionActions ).toEqual( new Set<number>() );
        expect( state.selectionConds ).toEqual( new Set<number>() );
    } );

    it( "selects the DRAW UI under the text cursor without live sync toggles", async () => {
        const drawText = [
            'FRAGMENT "First" {',
            "    DRAW { 2[1] };",
            "}",
            'FRAGMENT "Second" {',
            "    DRAW { 3[1] };",
            "}",
        ].join( "\n" );
        localStorage.setItem( "uitd-editor/uitdl-text-draft", drawText );
        mocks.exportToUITDL.mockReturnValue( drawText );
        state.nodes = [
            { id: 201, displayId: "2", title: "First container", x: 100, y: 100, w: 120, h: 80, parentId: null },
            { id: 301, displayId: "3", title: "Second container", x: 500, y: 100, w: 120, h: 80, parentId: null },
            { id: 102, displayId: "1", title: "Second child", x: 520, y: 120, w: 80, h: 40, parentId: 301 },
            { id: 101, displayId: "1", title: "First child", x: 120, y: 120, w: 80, h: 40, parentId: 201 },
        ];
        mocks.editorPosition = { lineNumber: 5, column: 14 };

        render( <UITDLTextPanel onCollapse={ vi.fn() } /> );
        mocks.focusEditorText?.();
        mocks.cursorPositionText?.( { position: { lineNumber: 5, column: 14 } } );

        await waitFor( () => expect( state.selection ).toEqual( new Set<number>( [ 102 ] ) ) );
        expect( state.selectionActions ).toEqual( new Set<number>() );
        expect( state.selectionConds ).toEqual( new Set<number>() );
    } );

    it( "centers the DRAW UI under the text cursor while live from canvas is enabled", async () => {
        const drawText = [
            'FRAGMENT "First" {',
            "    DRAW { 2[1] };",
            "}",
            'FRAGMENT "Second" {',
            "    DRAW { 3[1] };",
            "}",
        ].join( "\n" );
        localStorage.setItem( "uitd-editor/canvas-live-uitdl-sync", "true" );
        mocks.exportToUITDL.mockReturnValue( drawText );
        state.nodes = [
            { id: 201, displayId: "2", title: "First container", x: 100, y: 100, w: 120, h: 80, parentId: null },
            { id: 301, displayId: "3", title: "Second container", x: 500, y: 100, w: 120, h: 80, parentId: null },
            { id: 102, displayId: "1", title: "Second child", x: 520, y: 120, w: 80, h: 40, parentId: 301 },
            { id: 101, displayId: "1", title: "First child", x: 120, y: 120, w: 80, h: 40, parentId: 201 },
        ];
        state.panzoom = { x: 40, y: 30, zoom: 1 };
        mocks.editorPosition = { lineNumber: 5, column: 14 };

        render( <UITDLTextPanel onCollapse={ vi.fn() } /> );
        mocks.focusEditorText?.();
        mocks.cursorPositionText?.( { position: { lineNumber: 5, column: 14 } } );

        await waitFor( () => expect( state.selection ).toEqual( new Set<number>( [ 102 ] ) ) );
        expect( state.panzoom ).toEqual( {
            x: -20,
            y: 280,
            zoom: 1,
        } );
        expect( state.selectionActions ).toEqual( new Set<number>() );
        expect( state.selectionConds ).toEqual( new Set<number>() );
    } );
} );
