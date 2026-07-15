// src/components/UITDLTextPanel/UITDLTextPanel.tsx
// Provides validated textual UITDL editing and explicit application to the visual model.
import Editor, { type Monaco, type OnMount } from "@monaco-editor/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import type { editor } from "monaco-editor";
import {
    exportToUITDL,
    exportToUITDLWithLocations,
    type UITDLSourceLocation,
    type UITDLSourceMap,
} from "../../export/uitdl";
import { importUITDL } from "../../import/uitdl";
import {
    reconcileUITDLTextIncrementally,
    type LiveSyncSelection,
} from "../../import/uitdl/incremental";
import { validateWithOfficialValidator } from "../../import/uitdl/officialValidator";
import type { ParseIssue } from "../../import/uitdl/types";
import {
    getActionRect,
    getConditionRect,
    getFirstTargetInSelection,
    getNodeRect,
    type SelectionRect,
} from "../../state/selectionRect";
import { useAppStore } from "../../state/store";
import { SimulationProgressDialog } from "../Canvas/SimulationProgressDialog";
import {
    relayoutImportedContainers,
    useImportedDiagramSimulation,
} from "../Canvas/importedDiagramSimulation";
import { D2CodePanel } from "./D2CodePanel";
import { EXAMPLE_UITDL } from "./exampleUITDL";
import { formatUITDL } from "./formatUITDL";
import { InteractivePreview } from "./InteractivePreview";
import { copyText } from "./textClipboard";
import {
    registerUITDLLanguage,
    shouldTriggerUIIDCompletion,
    UITDL_LANGUAGE_ID,
} from "./uitdlLanguage";
import "./UITDLTextPanel.css";

const DRAFT_STORAGE_KEY = "uitd-editor/uitdl-text-draft";
const THEME_STORAGE_KEY = "uitd-editor/text-theme";
const CANVAS_LIVE_SYNC_STORAGE_KEY = "uitd-editor/canvas-live-uitdl-sync";
const UITDL_LIVE_SYNC_STORAGE_KEY = "uitd-editor/uitdl-live-canvas-sync";
const DEFAULT_FILE_NAME = "diagram.uitd";

type EditorTheme = "light" | "dark";

type Props = {
    onCollapse: () => void;
};

type Status = {
    kind: "info" | "success" | "error";
    message: string;
};

type TextRange = {
    startLineNumber: number;
    startColumn: number;
    endLineNumber: number;
    endColumn: number;
};

type TextDecorationCollection = {
    set: ( decorations: editor.IModelDeltaDecoration[] ) => void;
    clear: () => void;
};

function readStoredDraft(): string | null {
    try {
        return localStorage.getItem( DRAFT_STORAGE_KEY );
    } catch ( error ) {
        console.warn( "[UITDL text] Draft recovery unavailable; using the current diagram.", {
            cause: error,
            fallback: "Export the current visual diagram as the initial text.",
            impact: "An earlier textual draft cannot be restored.",
        } );
        return null;
    }
}

function saveDraft( text: string ) {
    try {
        localStorage.setItem( DRAFT_STORAGE_KEY, text );
    } catch ( error ) {
        console.warn( "[UITDL text] Draft persistence failed.", {
            cause: error,
            fallback: "Keep the draft in component memory.",
            impact: "The draft may be lost when the page closes.",
        } );
    }
}

function readStoredTheme(): EditorTheme {
    try {
        return localStorage.getItem( THEME_STORAGE_KEY ) === "dark" ? "dark" : "light";
    } catch ( error ) {
        console.warn( "[UITDL text] Theme preference recovery unavailable.", {
            cause: error,
            fallback: "Use the light editor theme.",
            impact: "The previous theme cannot be restored.",
        } );
        return "light";
    }
}

function saveTheme( theme: EditorTheme ) {
    try {
        localStorage.setItem( THEME_STORAGE_KEY, theme );
    } catch ( error ) {
        console.warn( "[UITDL text] Theme preference persistence failed.", {
            cause: error,
            fallback: "Keep the selected theme for this open panel only.",
            impact: "The theme may reset when the editor is reopened.",
        } );
    }
}

function readStoredCanvasLiveSync(): boolean {
    try {
        const stored = localStorage.getItem( CANVAS_LIVE_SYNC_STORAGE_KEY );
        return stored == null ? true : stored === "true";
    } catch ( error ) {
        console.warn( "[UITDL text] Canvas live sync preference recovery unavailable.", {
            cause: error,
            fallback: "Enable live UITDL updates from the canvas.",
            impact: "The previous live sync preference cannot be restored.",
        } );
        return true;
    }
}

function saveCanvasLiveSync( enabled: boolean ) {
    try {
        localStorage.setItem( CANVAS_LIVE_SYNC_STORAGE_KEY, String( enabled ) );
    } catch ( error ) {
        console.warn( "[UITDL text] Canvas live sync preference persistence failed.", {
            cause: error,
            fallback: "Keep the live sync choice for this open panel only.",
            impact: "The setting may reset when the editor is reopened.",
        } );
    }
}

function readStoredUITDLLiveSync(): boolean {
    try {
        return localStorage.getItem( UITDL_LIVE_SYNC_STORAGE_KEY ) === "true";
    } catch ( error ) {
        console.warn( "[UITDL text] UITDL live sync preference recovery unavailable.", {
            cause: error,
            fallback: "Disable live canvas updates from UITDL.",
            impact: "The previous live sync preference cannot be restored.",
        } );
        return false;
    }
}

function saveUITDLLiveSync( enabled: boolean ) {
    try {
        localStorage.setItem( UITDL_LIVE_SYNC_STORAGE_KEY, String( enabled ) );
    } catch ( error ) {
        console.warn( "[UITDL text] UITDL live sync preference persistence failed.", {
            cause: error,
            fallback: "Keep the live sync choice for this open panel only.",
            impact: "The setting may reset when the editor is reopened.",
        } );
    }
}

function waitForVisibleFeedback(): Promise<void> {
    return new Promise( resolve => {
        window.requestAnimationFrame( () => {
            window.requestAnimationFrame( () => resolve() );
        } );
    } );
}

function unionRect( rects: SelectionRect[] ): SelectionRect | null {
    if ( rects.length === 0 ) return null;
    const minX = Math.min( ...rects.map( rect => rect.x ) );
    const minY = Math.min( ...rects.map( rect => rect.y ) );
    const maxX = Math.max( ...rects.map( rect => rect.x + rect.w ) );
    const maxY = Math.max( ...rects.map( rect => rect.y + rect.h ) );
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function selectionRectOf( selection: LiveSyncSelection ): SelectionRect | null {
    const state = useAppStore.getState();
    const rects: SelectionRect[] = [];

    for ( const node of state.nodes ) {
        if ( selection.nodes.has( node.id ) ) rects.push( getNodeRect( node ) );
    }
    for ( const action of state.actions ) {
        if ( selection.actions.has( action.id ) ) rects.push( getActionRect( action ) );
    }
    for ( const condition of state.conditions ) {
        if ( selection.conditions.has( condition.id ) ) rects.push( getConditionRect( condition ) );
    }

    return unionRect( rects );
}

function applyLiveSelection( selection: LiveSyncSelection ) {
    const state = useAppStore.getState();
    const focusTarget = getFirstTargetInSelection(
        state.nodes,
        state.actions,
        state.conditions,
        selection.nodes,
        selection.actions,
        selection.conditions
    );
    useAppStore.setState( {
        selection: new Set( selection.nodes ),
        selectionActions: new Set( selection.actions ),
        selectionConds: new Set( selection.conditions ),
        focusTarget,
        keyboardMarquee: null,
        marqueeSeed: null,
    } );
}

function centerCanvasOnSelection( selection: LiveSyncSelection ) {
    const rect = selectionRectOf( selection );
    if ( !rect ) return;

    const state = useAppStore.getState();
    const viewWidth = state.viewBox.w || 800;
    const viewHeight = state.viewBox.h || 600;
    const padding = 120;
    const zoom = Math.min(
        viewWidth / Math.max( 1, rect.w + padding ),
        viewHeight / Math.max( 1, rect.h + padding )
    );
    const safeZoom = Number.isFinite( zoom ) && zoom > 0 ? Math.min( 2, Math.max( 0.08, zoom ) ) : 1;
    const centerX = rect.x + rect.w / 2;
    const centerY = rect.y + rect.h / 2;

    useAppStore.setState( current => ( {
        panzoom: {
            ...current.panzoom,
            x: viewWidth / 2 - safeZoom * centerX,
            y: viewHeight / 2 - safeZoom * centerY,
            zoom: safeZoom,
        },
    } ) );
}

function hasLiveSelection( selection: LiveSyncSelection ): boolean {
    return selection.nodes.size + selection.actions.size + selection.conditions.size > 0;
}

function collectSelectedTextLocations(
    locations: UITDLSourceMap,
    selection: LiveSyncSelection
): UITDLSourceLocation[] {
    const selectedLocations: UITDLSourceLocation[] = [];

    for ( const nodeId of selection.nodes ) {
        selectedLocations.push( ...( locations.nodes.get( nodeId ) ?? [] ) );
    }
    for ( const actionId of selection.actions ) {
        selectedLocations.push( ...( locations.actions.get( actionId ) ?? [] ) );
    }
    for ( const conditionId of selection.conditions ) {
        selectedLocations.push( ...( locations.conditions.get( conditionId ) ?? [] ) );
    }

    return selectedLocations;
}

function selectionKeyOf( selection: LiveSyncSelection ): string {
    const sortedValues = ( values: Set<number> ) => Array.from( values ).sort( ( a, b ) => a - b ).join( "," );
    return [
        `n:${sortedValues( selection.nodes )}`,
        `a:${sortedValues( selection.actions )}`,
        `c:${sortedValues( selection.conditions )}`,
    ].join( "|" );
}

function textRangeKeyOf( locations: UITDLSourceLocation[] ): string {
    return locations
        .map( location => `${location.lineNumber}:${location.column}:${location.endColumn}` )
        .sort()
        .join( "|" );
}

function textSelectionOf( locations: UITDLSourceLocation[] ): TextRange | null {
    if ( locations.length === 0 ) return null;

    const first = locations.reduce( ( best, location ) => {
        if ( location.lineNumber < best.lineNumber ) return location;
        if ( location.lineNumber === best.lineNumber && location.column < best.column ) return location;
        return best;
    } );
    const last = locations.reduce( ( best, location ) => {
        if ( location.lineNumber > best.lineNumber ) return location;
        if ( location.lineNumber === best.lineNumber && location.endColumn > best.endColumn ) return location;
        return best;
    } );

    return {
        startLineNumber: first.lineNumber,
        startColumn: first.column,
        endLineNumber: last.lineNumber,
        endColumn: last.endColumn,
    };
}

function middleLineOf( locations: UITDLSourceLocation[] ): number | null {
    if ( locations.length === 0 ) return null;
    const minLine = Math.min( ...locations.map( location => location.lineNumber ) );
    const maxLine = Math.max( ...locations.map( location => location.lineNumber ) );
    return Math.max( 1, Math.round( ( minLine + maxLine ) / 2 ) );
}

function lineDecorationsOf( locations: UITDLSourceLocation[] ): editor.IModelDeltaDecoration[] {
    const lineNumbers = Array.from(
        new Set( locations.map( location => location.lineNumber ) )
    ).sort( ( a, b ) => a - b );

    return lineNumbers.map( lineNumber => ( {
        range: {
            startLineNumber: lineNumber,
            startColumn: 1,
            endLineNumber: lineNumber,
            endColumn: 1,
        },
        options: {
            isWholeLine: true,
            className: "uitdlTextPanel__canvasSyncLine",
            linesDecorationsClassName: "uitdlTextPanel__canvasSyncMarker",
        },
    } ) );
}

function downloadTextFile( fileName: string, text: string ) {
    const blob = new Blob( [ text ], { type: "text/plain;charset=utf-8" } );
    const url = URL.createObjectURL( blob );
    const anchor = document.createElement( "a" );
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild( anchor );
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL( url );
}

function applyProjectToStore( project: ReturnType<typeof importUITDL> ) {
    const state = useAppStore.getState();
    state.commitEditingSession?.();
    state.captureDelta( [ "nodes", "actions", "conditions", "edges" ], () => {
        useAppStore.setState( current => ( {
            ...current,
            nodes: project.nodes,
            actions: project.actions,
            conditions: project.conditions,
            edges: project.edges,
            fragmentTitles: project.fragmentTitles ?? {},
            nextId: project.nextId,
            nextActionId: project.nextActionId,
            nextEdgeId: project.nextEdgeId,
            selection: new Set<number>(),
            selectionActions: new Set<number>(),
            selectionConds: new Set<number>(),
            focusTarget: null,
            keyboardMarquee: null,
            marqueeSeed: null,
            pendingConnect: null,
            dragHoverParent: null,
            editingSession: null,
        } ) );
    } );
}

function issueLocation( issue: ParseIssue ): string {
    if ( issue.line == null ) return "General";
    return issue.col == null ? `L${issue.line}` : `L${issue.line}:C${issue.col}`;
}

export function UITDLTextPanel( { onCollapse }: Props ) {
    const initialDiagramTextRef = useRef( exportToUITDL( useAppStore.getState() ) );
    const storedDraftRef = useRef( readStoredDraft() );
    const [ isCanvasLiveSyncEnabled, setIsCanvasLiveSyncEnabled ] = useState( readStoredCanvasLiveSync );
    const [ isUITDLLiveSyncEnabled, setIsUITDLLiveSyncEnabled ] = useState( () =>
        !readStoredCanvasLiveSync() && readStoredUITDLLiveSync()
    );
    const [ text, setText ] = useState(
        isCanvasLiveSyncEnabled ? initialDiagramTextRef.current : storedDraftRef.current ?? initialDiagramTextRef.current
    );
    const [ appliedText, setAppliedText ] = useState( initialDiagramTextRef.current );
    const [ status, setStatus ] = useState<Status | null>(
        !isCanvasLiveSyncEnabled && storedDraftRef.current && storedDraftRef.current !== initialDiagramTextRef.current
            ? { kind: "info", message: "Recovered a textual draft. Apply it to update the diagram." }
            : null
    );
    const [ isApplying, setIsApplying ] = useState( false );
    const [ fileName, setFileName ] = useState( DEFAULT_FILE_NAME );
    const [ isPreviewOpen, setIsPreviewOpen ] = useState( false );
    const [ isD2PanelOpen, setIsD2PanelOpen ] = useState( false );
    const [ theme, setTheme ] = useState<EditorTheme>( readStoredTheme );
    const [ selectionSignal, setSelectionSignal ] = useState( 0 );
    const editorRef = useRef<editor.IStandaloneCodeEditor | null>( null );
    const monacoRef = useRef<Monaco | null>( null );
    const syncedLineDecorationsRef = useRef<TextDecorationCollection | null>( null );
    const completionListenerRef = useRef<{ dispose: () => void } | null>( null );
    const fileInputRef = useRef<HTMLInputElement | null>( null );
    const simulationWasRunningRef = useRef( false );
    const liveSyncRunRef = useRef( 0 );
    const lastRevealedSelectionRef = useRef( "" );
    const { progress, runSimulation, runSimulationForCurrentSelection, stopSimulation } = useImportedDiagramSimulation();

    const issues = useMemo( () => validateWithOfficialValidator( text ), [ text ] );
    const errors = useMemo( () => issues.filter( issue => issue.kind === "error" ), [ issues ] );
    const warnings = useMemo( () => issues.filter( issue => issue.kind === "warning" ), [ issues ] );
    const isDirty = !isCanvasLiveSyncEnabled && !isUITDLLiveSyncEnabled && text !== appliedText;

    const updateMarkers = useCallback( () => {
        const monaco = monacoRef.current;
        const model = editorRef.current?.getModel();
        if ( !monaco || !model ) return;
        monaco.editor.setModelMarkers(
            model,
            UITDL_LANGUAGE_ID,
            issues.map( issue => ( {
                severity: issue.kind === "error"
                    ? monaco.MarkerSeverity.Error
                    : monaco.MarkerSeverity.Warning,
                message: issue.message,
                startLineNumber: issue.line ?? 1,
                startColumn: issue.col ?? 1,
                endLineNumber: issue.line ?? 1,
                endColumn: Math.max( 2, ( issue.col ?? 1 ) + 1 ),
            } ) )
        );
    }, [ issues ] );

    useEffect( () => {
        saveDraft( text );
        updateMarkers();
    }, [ text, updateMarkers ] );

    useEffect( () => {
        saveTheme( theme );
    }, [ theme ] );

    useEffect( () => {
        saveCanvasLiveSync( isCanvasLiveSyncEnabled );
    }, [ isCanvasLiveSyncEnabled ] );

    useEffect( () => {
        saveUITDLLiveSync( isUITDLLiveSyncEnabled );
    }, [ isUITDLLiveSyncEnabled ] );

    useEffect( () => {
        if ( !isCanvasLiveSyncEnabled ) return;

        const syncTextFromCanvas = () => {
            const diagramText = exportToUITDL( useAppStore.getState() );
            setText( current => current === diagramText ? current : diagramText );
            setAppliedText( diagramText );
        };

        syncTextFromCanvas();
        return useAppStore.subscribe( syncTextFromCanvas );
    }, [ isCanvasLiveSyncEnabled ] );

    useEffect( () => useAppStore.subscribe( () => {
        setSelectionSignal( current => current + 1 );
    } ), [] );

    useEffect( () => {
        const mountedEditor = editorRef.current;
        if ( !mountedEditor ) return;

        const state = useAppStore.getState();
        const currentSelection: LiveSyncSelection = {
            nodes: state.selection,
            actions: state.selectionActions,
            conditions: state.selectionConds,
        };

        if ( !hasLiveSelection( currentSelection ) ) {
            lastRevealedSelectionRef.current = "";
            syncedLineDecorationsRef.current?.clear();
            return;
        }

        const exported = exportToUITDLWithLocations( state );
        if ( exported.text !== text ) {
            syncedLineDecorationsRef.current?.clear();
            return;
        }

        const locations = collectSelectedTextLocations( exported.locations, currentSelection );
        const range = textSelectionOf( locations );
        const middleLine = middleLineOf( locations );
        if ( !range || middleLine == null ) {
            syncedLineDecorationsRef.current?.clear();
            return;
        }

        syncedLineDecorationsRef.current?.set( lineDecorationsOf( locations ) );

        const revealKey = `${selectionKeyOf( currentSelection )}|${textRangeKeyOf( locations )}|${text.length}`;
        if ( lastRevealedSelectionRef.current === revealKey ) return;
        lastRevealedSelectionRef.current = revealKey;

        mountedEditor.setSelection( range );
        mountedEditor.setPosition( {
            lineNumber: middleLine,
            column: range.startColumn,
        } );
        mountedEditor.revealLineInCenter( middleLine );
    }, [ selectionSignal, text ] );

    useEffect( () => {
        if ( !isUITDLLiveSyncEnabled || isCanvasLiveSyncEnabled ) return;

        const runId = ++liveSyncRunRef.current;
        const timer = window.setTimeout( async () => {
            if ( runId !== liveSyncRunRef.current ) return;
            if ( errors.length > 0 ) {
                setStatus( { kind: "error", message: "Canvas kept the last valid UITDL because the text has errors." } );
                return;
            }
            if ( text === appliedText ) {
                setStatus( { kind: "success", message: "Canvas is synchronized from UITDL." } );
                return;
            }

            try {
                const result = reconcileUITDLTextIncrementally( text, useAppStore.getState() );
                if ( result.changedCount === 0 ) {
                    setAppliedText( text );
                    setStatus( { kind: "success", message: "Canvas is synchronized from UITDL." } );
                    return;
                }

                if ( hasLiveSelection( result.beforeSelection ) ) {
                    applyLiveSelection( result.beforeSelection );
                    centerCanvasOnSelection( result.beforeSelection );
                    await waitForVisibleFeedback();
                }

                if ( runId !== liveSyncRunRef.current ) return;
                const state = useAppStore.getState();
                state.commitEditingSession?.();
                state.captureDelta( [ "nodes", "actions", "conditions", "edges" ], () => {
                    useAppStore.setState( current => ( {
                        ...current,
                        nodes: result.nodes,
                        actions: result.actions,
                        conditions: result.conditions,
                        edges: result.edges,
                        fragmentTitles: result.fragmentTitles,
                        nextId: result.nextId,
                        nextActionId: result.nextActionId,
                        nextEdgeId: result.nextEdgeId,
                        pendingConnect: null,
                        dragHoverParent: null,
                    } ) );
                } );
                relayoutImportedContainers();
                applyLiveSelection( result.afterSelection );
                centerCanvasOnSelection( result.afterSelection );
                runSimulationForCurrentSelection();
                setAppliedText( text );
                setStatus( {
                    kind: warnings.length > 0 ? "info" : "success",
                    message: warnings.length > 0
                        ? `Canvas updated from UITDL with ${warnings.length} warning(s).`
                        : "Canvas updated from UITDL.",
                } );
            } catch ( error ) {
                console.error( "[UITDL live sync] Incremental update failed.", error );
                setStatus( {
                    kind: "error",
                    message: error instanceof Error ? error.message : "Could not update the canvas from UITDL.",
                } );
            }
        }, 650 );

        return () => window.clearTimeout( timer );
    }, [
        appliedText,
        errors,
        isCanvasLiveSyncEnabled,
        isUITDLLiveSyncEnabled,
        runSimulationForCurrentSelection,
        text,
        warnings.length,
    ] );

    useEffect( () => () => completionListenerRef.current?.dispose(), [] );

    useEffect( () => {
        if ( progress != null ) {
            simulationWasRunningRef.current = true;
            return;
        }
        if ( !simulationWasRunningRef.current ) return;
        simulationWasRunningRef.current = false;
        useAppStore.getState().requestCanvasFitToWidth();
    }, [ progress ] );

    const handleMount: OnMount = ( mountedEditor, monaco ) => {
        editorRef.current = mountedEditor;
        monacoRef.current = monaco;
        syncedLineDecorationsRef.current = mountedEditor.createDecorationsCollection();
        registerUITDLLanguage( monaco );
        monaco.editor.setModelLanguage( mountedEditor.getModel()!, UITDL_LANGUAGE_ID );
        completionListenerRef.current?.dispose();
        completionListenerRef.current = mountedEditor.onDidChangeModelContent( event => {
            const typedText = event.changes.length === 1 ? event.changes[ 0 ].text : "";
            if ( !/^\d$/.test( typedText ) ) return;
            window.requestAnimationFrame( () => {
                const model = mountedEditor.getModel();
                const position = mountedEditor.getPosition();
                if ( !model || !position ) return;
                if ( !shouldTriggerUIIDCompletion(
                    model.getValue(),
                    model.getLineContent( position.lineNumber ),
                    position.lineNumber,
                    position.column,
                    typedText
                ) ) return;
                mountedEditor.trigger( "uitdl-uiid-completion", "editor.action.triggerSuggest", {} );
            } );
        } );
        updateMarkers();
    };

    const applyText = async () => {
        if ( errors.length > 0 || isApplying || !isDirty ) return;
        setIsApplying( true );
        setStatus( { kind: "info", message: "Applying validated UITDL to the diagram…" } );
        await waitForVisibleFeedback();

        try {
            const project = importUITDL( text, useAppStore.getState() );
            applyProjectToStore( project );
            relayoutImportedContainers();
            useAppStore.getState().requestCanvasFitToWidth();
            runSimulation();
            setAppliedText( text );
            setStatus( {
                kind: "success",
                message: warnings.length > 0
                    ? `Applied with ${warnings.length} warning(s). Layout simulation is running.`
                    : "UITDL applied. Layout simulation is running.",
            } );
        } catch ( error ) {
            console.error( "[UITDL text] Applying the text failed.", error );
            setStatus( {
                kind: "error",
                message: error instanceof Error ? error.message : "Could not apply the UITDL text.",
            } );
        } finally {
            setIsApplying( false );
        }
    };

    const reloadFromDiagram = () => {
        if ( isDirty && !window.confirm( "Discard the current textual draft and reload the diagram?" ) ) return;
        const diagramText = exportToUITDL( useAppStore.getState() );
        setText( diagramText );
        setAppliedText( diagramText );
        setStatus( { kind: "info", message: "Text reloaded from the current diagram." } );
    };

    const openTextFile = async ( event: React.ChangeEvent<HTMLInputElement> ) => {
        const input = event.currentTarget;
        const file = input.files?.[ 0 ];
        if ( !file ) return;

        if ( isDirty && !window.confirm( "Discard the current textual draft and open another file?" ) ) {
            input.value = "";
            return;
        }

        setStatus( { kind: "info", message: `Opening ${file.name}…` } );
        await waitForVisibleFeedback();
        try {
            const openedText = await file.text();
            setText( openedText );
            setFileName( file.name );
            setStatus( {
                kind: "success",
                message: `${file.name} opened. Apply it to update the diagram.`,
            } );
        } catch ( error ) {
            console.error( "[UITDL text] Opening the selected file failed.", error );
            setStatus( { kind: "error", message: `Could not open ${file.name}.` } );
        } finally {
            input.value = "";
        }
    };

    const saveTextFile = async () => {
        setStatus( { kind: "info", message: `Preparing ${fileName}…` } );
        await waitForVisibleFeedback();
        downloadTextFile( fileName, text );
        setStatus( { kind: "success", message: `${fileName} downloaded.` } );
    };

    const formatText = async () => {
        setStatus( { kind: "info", message: "Formatting UITDL text…" } );
        await waitForVisibleFeedback();
        const formattedText = formatUITDL( text );
        setText( formattedText );
        setStatus( { kind: "success", message: "UITDL text formatted." } );
    };

    const loadExample = async () => {
        if ( isDirty && !window.confirm( "Discard the current textual draft and load the example?" ) ) return;
        setStatus( { kind: "info", message: "Loading the UITDL example…" } );
        await waitForVisibleFeedback();
        setText( EXAMPLE_UITDL );
        setFileName( "reports-portal-example.uitd" );
        setStatus( { kind: "success", message: "Example loaded. Apply it to update the diagram." } );
    };

    const copyAllText = async () => {
        flushSync( () => {
            setStatus( { kind: "info", message: "Copying the UITDL text…" } );
        } );
        try {
            await copyText( text );
            setStatus( { kind: "success", message: "UITDL text copied to the clipboard." } );
        } catch ( error ) {
            console.error( "[UITDL text] Copy failed after all clipboard methods.", error );
            setStatus( { kind: "error", message: "Could not copy the UITDL text." } );
        }
    };

    const focusIssue = ( issue: ParseIssue ) => {
        if ( issue.line == null ) return;
        editorRef.current?.setPosition( { lineNumber: issue.line, column: issue.col ?? 1 } );
        editorRef.current?.revealLineInCenter( issue.line );
        editorRef.current?.focus();
    };

    return (
        <aside
            className={ `uitdlTextPanel is-${theme}${isD2PanelOpen ? " has-d2-modal" : ""}` }
            aria-label="UITDL text editor"
        >
            <header className="uitdlTextPanel__header">
                <div className="uitdlTextPanel__heading">
                    <strong>UITDL text</strong>
                    <span className="uitdlTextPanel__summary">
                        { fileName } · { errors.length } error(s), { warnings.length } warning(s)
                        { isCanvasLiveSyncEnabled
                            ? " · Live from canvas"
                            : isUITDLLiveSyncEnabled
                                ? " · Live to canvas"
                                : isDirty ? " · Pending changes" : " · Synchronized" }
                    </span>
                </div>
                <div className="uitdlTextPanel__headerActions">
                    <button
                        type="button"
                        onClick={ () => setTheme( currentTheme => currentTheme === "light" ? "dark" : "light" ) }
                        aria-label={ theme === "light" ? "Switch to dark theme" : "Switch to light theme" }
                    >
                        { theme === "light" ? "Dark" : "Light" }
                    </button>
                    <button type="button" onClick={ onCollapse } aria-label="Collapse UITDL text editor">‹</button>
                </div>
            </header>

            <div className="uitdlTextPanel__actions">
                <input
                    ref={ fileInputRef }
                    type="file"
                    accept=".uitd,.uitdl,.txt,text/plain"
                    hidden
                    onChange={ openTextFile }
                />
                <button
                    type="button"
                    onClick={ () => fileInputRef.current?.click() }
                    disabled={ isApplying || isCanvasLiveSyncEnabled }
                >
                    Open .uitd
                </button>
                <button type="button" onClick={ saveTextFile } disabled={ isApplying }>
                    Save .uitd
                </button>
                <button
                    type="button"
                    onClick={ formatText }
                    disabled={ isApplying || isCanvasLiveSyncEnabled || !text.trim() }
                >
                    Format
                </button>
                <button type="button" onClick={ loadExample } disabled={ isApplying || isCanvasLiveSyncEnabled }>
                    Load example
                </button>
                <button type="button" onClick={ copyAllText } disabled={ isApplying || !text }>
                    Copy all
                </button>
                <button
                    type="button"
                    onClick={ () => {
                        setStatus( { kind: "success", message: "Interactive preview opened from the validated text." } );
                        setIsPreviewOpen( true );
                    } }
                    disabled={ isApplying || errors.length > 0 || !text.trim() }
                >
                    Preview HTML
                </button>
                <button
                    type="button"
                    onClick={ () => {
                        setStatus( { kind: "success", message: "D2 source generated from the validated text." } );
                        setIsD2PanelOpen( true );
                    } }
                    disabled={ isApplying || errors.length > 0 || !text.trim() }
                >
                    Generate D2
                </button>
                <button type="button" onClick={ reloadFromDiagram } disabled={ isApplying || isCanvasLiveSyncEnabled }>
                    Reload from diagram
                </button>
                <button
                    type="button"
                    className="uitdlTextPanel__apply"
                    onClick={ applyText }
                    disabled={ isCanvasLiveSyncEnabled || errors.length > 0 || isApplying || !isDirty }
                >
                    { isApplying ? "Applying…" : "Apply to diagram" }
                </button>
                <label className="uitdlTextPanel__liveSync">
                    <input
                        type="checkbox"
                        checked={ isCanvasLiveSyncEnabled }
                        onChange={ event => {
                            const checked = event.currentTarget.checked;
                            setIsCanvasLiveSyncEnabled( checked );
                            if ( checked ) setIsUITDLLiveSyncEnabled( false );
                        } }
                    />
                    Live from canvas
                </label>
                <label className="uitdlTextPanel__liveSync">
                    <input
                        type="checkbox"
                        checked={ isUITDLLiveSyncEnabled }
                        onChange={ event => {
                            const checked = event.currentTarget.checked;
                            setIsUITDLLiveSyncEnabled( checked );
                            if ( checked ) setIsCanvasLiveSyncEnabled( false );
                        } }
                    />
                    Live to canvas
                </label>
            </div>

            { status && (
                <div className={ `uitdlTextPanel__status is-${status.kind}` } role="status">
                    <span>{ status.message }</span>
                    <button type="button" onClick={ () => setStatus( null ) } aria-label="Dismiss status">×</button>
                </div>
            ) }

            <div className="uitdlTextPanel__editor">
                <Editor
                    defaultLanguage={ UITDL_LANGUAGE_ID }
                    theme={ theme === "dark" ? "vs-dark" : "vs" }
                    value={ text }
                    onChange={ value => setText( value ?? "" ) }
                    onMount={ handleMount }
                    loading="Loading UITDL editor…"
                    options={ {
                        automaticLayout: true,
                        readOnly: isCanvasLiveSyncEnabled,
                        readOnlyMessage: { value: "Turn off Live from canvas to edit UITDL manually." },
                        minimap: { enabled: true },
                        fontSize: 14,
                        renderLineHighlight: "all",
                        renderLineHighlightOnlyWhenFocus: false,
                        tabSize: 4,
                        insertSpaces: true,
                        wordWrap: "on",
                        folding: true,
                        foldingStrategy: "auto",
                        showFoldingControls: "always",
                        hover: { enabled: true },
                        quickSuggestions: {
                            other: true,
                            comments: false,
                            strings: true,
                        },
                        suggestOnTriggerCharacters: true,
                        scrollBeyondLastLine: false,
                    } }
                />
            </div>

            { issues.length > 0 && (
                <section className="uitdlTextPanel__issues" aria-label="UITDL diagnostics">
                    { issues.map( ( issue, index ) => (
                        <button
                            type="button"
                            key={ `${issue.kind}-${issue.line ?? 0}-${issue.col ?? 0}-${index}` }
                            className={ `uitdlTextPanel__issue is-${issue.kind}` }
                            onClick={ () => focusIssue( issue ) }
                        >
                            <strong>{ issue.kind === "error" ? "Error" : "Warning" } { issueLocation( issue ) }</strong>
                            <span>{ issue.message }</span>
                        </button>
                    ) ) }
                </section>
            ) }
            { isPreviewOpen && <InteractivePreview text={ text } onClose={ () => setIsPreviewOpen( false ) } /> }
            { isD2PanelOpen && (
                <D2CodePanel text={ text } theme={ theme } onClose={ () => setIsD2PanelOpen( false ) } />
            ) }
            <SimulationProgressDialog
                open={ progress != null }
                progress={ progress }
                onStop={ stopSimulation }
            />
        </aside>
    );
}
