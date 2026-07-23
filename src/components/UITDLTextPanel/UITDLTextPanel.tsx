// src/components/UITDLTextPanel/UITDLTextPanel.tsx
// Provides validated textual UITDL editing and explicit application to the visual model.
import Editor, { type Monaco, type OnMount } from "@monaco-editor/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import type { editor, IKeyboardEvent } from "monaco-editor";
import { buildFragmentGroups } from "../../fragments/fragmentModel";
import {
    exportToUITDL,
    exportToUITDLWithLocations,
    type UITDLFragmentSourceLocation,
    type UITDLSourceLocation,
    type UITDLSourceMap,
} from "../../export/uitdl";
import { importUITDL } from "../../import/uitdl";
import {
    reconcileUITDLTextIncrementally,
    type IncrementalUITDLResult,
    type LiveSyncSelection,
} from "../../import/uitdl/incremental";
import { callOfficialUITDLValidator } from "../../import/uitdl/officialValidatorCaller";
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
import { formatUITDLTextWithDiagnosticsForClipboard } from "./textDiagnosticsClipboard";
import {
    registerUITDLLanguage,
    shouldTriggerUITDLFieldCompletion,
    shouldTriggerUIIDCompletion,
    UITDL_LANGUAGE_ID,
} from "./uitdlLanguage";
import { findNextUITDLEditableField } from "./uitdlTabNavigation";
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

type LiveSyncProject = Pick<IncrementalUITDLResult, "nodes" | "actions" | "conditions" | "edges">;

type TextPosition = {
    lineNumber: number;
    column: number;
};

function textPositionKeyOf( position: TextPosition | null ): string {
    return position ? `${position.lineNumber}:${position.column}` : "";
}

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

function applyLiveSelection( selection: LiveSyncSelection, shouldFocusDiagram = true ) {
    const state = useAppStore.getState();
    const focusTarget = shouldFocusDiagram
        ? getFirstTargetInSelection(
            state.nodes,
            state.actions,
            state.conditions,
            selection.nodes,
            selection.actions,
            selection.conditions
        )
        : null;
    useAppStore.setState( {
        selection: new Set( selection.nodes ),
        selectionActions: new Set( selection.actions ),
        selectionConds: new Set( selection.conditions ),
        focusTarget,
        keyboardMarquee: null,
        marqueeSeed: null,
    } );
}

function centerCanvasOnSelection( selection: LiveSyncSelection, options: { preserveZoom?: boolean } = {} ) {
    const rect = selectionRectOf( selection );
    if ( !rect ) return;

    const state = useAppStore.getState();
    const viewWidth = state.viewBox.w || 800;
    const viewHeight = state.viewBox.h || 600;
    const safeZoom = options.preserveZoom
        ? state.panzoom.zoom
        : ( () => {
            const padding = 260;
            const zoom = Math.min(
                viewWidth / Math.max( 1, rect.w + padding ),
                viewHeight / Math.max( 1, rect.h + padding )
            );
            return Number.isFinite( zoom ) && zoom > 0 ? Math.min( 1.15, Math.max( 0.08, zoom ) ) : 1;
        } )();
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

function hasSameNumberSet( left: Set<number>, right: Set<number> ): boolean {
    if ( left.size !== right.size ) return false;
    for ( const value of left ) {
        if ( !right.has( value ) ) return false;
    }
    return true;
}

function isCurrentLiveSelection( selection: LiveSyncSelection ): boolean {
    const state = useAppStore.getState();
    return hasSameNumberSet( state.selection, selection.nodes ) &&
        hasSameNumberSet( state.selectionActions, selection.actions ) &&
        hasSameNumberSet( state.selectionConds, selection.conditions );
}

function emptyLiveSelection(): LiveSyncSelection {
    return {
        nodes: new Set<number>(),
        actions: new Set<number>(),
        conditions: new Set<number>(),
    };
}

function unescapeQuotedUITDLText( value: string ): string {
    return value.replace( /\\(["\\])/g, "$1" );
}

function leafUiKeyOf( reference: string ): string | null {
    const keys = reference.match( /[A-Za-z_][A-Za-z0-9_]*|\d+/g ) ?? [];
    return keys.length > 0 ? keys[ keys.length - 1 ] : null;
}

type DrawReference = {
    key: string;
    startColumn: number;
    endColumn: number;
    children: DrawReference[];
};

function nodeIdsByUiKey( project: LiveSyncProject, key: string ): number[] {
    return project.nodes
        .filter( node => ( node.displayId ?? String( node.id ) ).trim() === key )
        .map( node => node.id );
}

function skipDrawWhitespace( source: string, cursor: number ): number {
    let nextCursor = cursor;
    while ( /\s/.test( source[ nextCursor ] ?? "" ) ) nextCursor++;
    return nextCursor;
}

function parseDrawIdentifierAt( source: string, cursor: number ): { key: string; cursor: number } | null {
    const match = source.slice( cursor ).match( /^[A-Za-z_][A-Za-z0-9_]*|\d+/ );
    if ( !match ) return null;
    return {
        key: match[ 0 ],
        cursor: cursor + match[ 0 ].length,
    };
}

function parseDrawReferenceList(
    source: string,
    cursor: number,
    columnOffset: number,
    terminator: string | null
): { references: DrawReference[]; cursor: number } | null {
    const references: DrawReference[] = [];
    let nextCursor = skipDrawWhitespace( source, cursor );

    while ( nextCursor < source.length ) {
        if ( terminator != null && source[ nextCursor ] === terminator ) {
            return { references, cursor: nextCursor + 1 };
        }

        const identifier = parseDrawIdentifierAt( source, nextCursor );
        if ( !identifier ) return null;

        const startColumn = columnOffset + nextCursor + 1;
        const endColumn = columnOffset + identifier.cursor + 1;
        nextCursor = skipDrawWhitespace( source, identifier.cursor );
        let children: DrawReference[] = [];
        if ( source[ nextCursor ] === "[" ) {
            const parsedChildren = parseDrawReferenceList( source, nextCursor + 1, columnOffset, "]" );
            if ( !parsedChildren ) return null;
            children = parsedChildren.references;
            nextCursor = skipDrawWhitespace( source, parsedChildren.cursor );
        }

        references.push( { key: identifier.key, startColumn, endColumn, children } );

        if ( source[ nextCursor ] === "," ) {
            nextCursor = skipDrawWhitespace( source, nextCursor + 1 );
            continue;
        }

        if ( terminator != null && source[ nextCursor ] === terminator ) {
            return { references, cursor: nextCursor + 1 };
        }

        if ( terminator == null && nextCursor >= source.length ) {
            return { references, cursor: nextCursor };
        }

        return null;
    }

    return terminator == null ? { references, cursor: nextCursor } : null;
}

function drawReferencesOf( line: string ): DrawReference[] | null {
    const drawMatch = line.match( /\bDRAW\s*\{(?<body>.*)\}\s*;/ );
    const body = drawMatch?.groups?.body;
    if ( body == null ) return null;

    const bodyStartColumn = line.indexOf( "{" ) + 2;
    const parsed = parseDrawReferenceList( body, 0, bodyStartColumn - 1, null );
    if ( !parsed ) return null;
    return skipDrawWhitespace( body, parsed.cursor ) === body.length ? parsed.references : null;
}

function countTopLevelDrawReferencesBeforeLine( lines: string[], lineNumber: number ): Map<string, number> {
    const counts = new Map<string, number>();
    for ( let index = 0; index < lineNumber - 1; index++ ) {
        const references = drawReferencesOf( lines[ index ] ) ?? [];
        for ( const reference of references ) counts.set( reference.key, ( counts.get( reference.key ) ?? 0 ) + 1 );
    }
    return counts;
}

function nodeIdByUiKeyOccurrenceWithParent(
    project: LiveSyncProject,
    key: string,
    parentId: number | null,
    occurrenceIndex: number
): number | null {
    let countOfSeen = 0;
    for ( const node of project.nodes ) {
        if ( ( node.displayId ?? String( node.id ) ).trim() !== key ) continue;
        if ( ( node.parentId ?? null ) !== parentId ) continue;
        if ( countOfSeen === occurrenceIndex ) return node.id;
        countOfSeen++;
    }
    return null;
}

function addDrawReferenceSelection(
    selection: LiveSyncSelection,
    project: LiveSyncProject,
    reference: DrawReference,
    parentId: number | null,
    occurrenceIndex: number
) {
    const nodeId = nodeIdByUiKeyOccurrenceWithParent( project, reference.key, parentId, occurrenceIndex );
    if ( nodeId == null ) return;

    selection.nodes.add( nodeId );
    const childCountByKey = new Map<string, number>();
    for ( const child of reference.children ) {
        const childOccurrenceIndex = childCountByKey.get( child.key ) ?? 0;
        addDrawReferenceSelection( selection, project, child, nodeId, childOccurrenceIndex );
        childCountByKey.set( child.key, childOccurrenceIndex + 1 );
    }
}

function addDrawReferenceTextLocations(
    locations: UITDLSourceLocation[],
    selection: LiveSyncSelection,
    project: LiveSyncProject,
    reference: DrawReference,
    lineNumber: number,
    parentId: number | null,
    occurrenceIndex: number
) {
    const nodeId = nodeIdByUiKeyOccurrenceWithParent( project, reference.key, parentId, occurrenceIndex );
    if ( nodeId == null ) return;

    if ( selection.nodes.has( nodeId ) ) {
        locations.push( {
            lineNumber,
            column: reference.startColumn,
            endColumn: reference.endColumn,
        } );
    }

    const childCountByKey = new Map<string, number>();
    for ( const child of reference.children ) {
        const childOccurrenceIndex = childCountByKey.get( child.key ) ?? 0;
        addDrawReferenceTextLocations(
            locations,
            selection,
            project,
            child,
            lineNumber,
            nodeId,
            childOccurrenceIndex
        );
        childCountByKey.set( child.key, childOccurrenceIndex + 1 );
    }
}

function findDrawReferenceAtColumn( references: DrawReference[], column: number ): DrawReference | null {
    for ( const reference of references ) {
        if ( column >= reference.startColumn && column <= reference.endColumn ) return reference;
        const childReference = findDrawReferenceAtColumn( reference.children, column );
        if ( childReference ) return childReference;
    }

    return null;
}

function addTargetDrawReferenceSelection(
    selection: LiveSyncSelection,
    project: LiveSyncProject,
    reference: DrawReference,
    target: DrawReference,
    parentId: number | null,
    occurrenceIndex: number
): boolean {
    const nodeId = nodeIdByUiKeyOccurrenceWithParent( project, reference.key, parentId, occurrenceIndex );
    if ( nodeId == null ) return false;

    if ( reference === target ) {
        selection.nodes.add( nodeId );
        return true;
    }

    const childCountByKey = new Map<string, number>();
    for ( const child of reference.children ) {
        const childOccurrenceIndex = childCountByKey.get( child.key ) ?? 0;
        const found = addTargetDrawReferenceSelection(
            selection,
            project,
            child,
            target,
            nodeId,
            childOccurrenceIndex
        );
        if ( found ) return true;
        childCountByKey.set( child.key, childOccurrenceIndex + 1 );
    }

    return false;
}

function selectionForDrawLine(
    line: string,
    lineNumber: number,
    column: number,
    lines: string[],
    project: LiveSyncProject
): LiveSyncSelection | null {
    const references = drawReferencesOf( line );
    if ( references == null || references.length === 0 ) return null;

    const selection = emptyLiveSelection();
    const countByKey = countTopLevelDrawReferencesBeforeLine( lines, lineNumber );
    const targetReference = findDrawReferenceAtColumn( references, column );
    for ( const reference of references ) {
        const occurrenceIndex = countByKey.get( reference.key ) ?? 0;
        if ( targetReference ) {
            addTargetDrawReferenceSelection( selection, project, reference, targetReference, null, occurrenceIndex );
        } else {
            addDrawReferenceSelection( selection, project, reference, null, occurrenceIndex );
        }
        countByKey.set( reference.key, occurrenceIndex + 1 );
    }

    return hasLiveSelection( selection ) ? selection : null;
}

function selectionForFragmentLine(
    line: string,
    lineNumber: number,
    lines: string[],
    project: LiveSyncProject
): LiveSyncSelection | null {
    if ( !/^\s*FRAGMENT\b/.test( line ) ) return null;

    let indexOfFragment = 0;
    for ( let index = 0; index < lineNumber - 1; index++ ) {
        if ( /^\s*FRAGMENT\b/.test( lines[ index ] ) ) indexOfFragment++;
    }

    const fragment = buildFragmentGroups( {
        nodes: project.nodes,
        actions: project.actions,
        conditions: project.conditions,
        edges: project.edges,
    } )[ indexOfFragment ];
    if ( !fragment ) return null;

    return {
        nodes: new Set( fragment.nodeIds ),
        actions: new Set( fragment.actionIds ),
        conditions: new Set( fragment.conditionIds ),
    };
}

function selectionForUiDeclarationLine( line: string, project: LiveSyncProject ): LiveSyncSelection | null {
    const uiMatch = line.match( /^\s*UI\s+([A-Za-z_][A-Za-z0-9_]*|\d+)\b/ );
    if ( !uiMatch ) return null;

    const selection = emptyLiveSelection();
    for ( const nodeId of nodeIdsByUiKey( project, uiMatch[ 1 ] ) ) selection.nodes.add( nodeId );
    return hasLiveSelection( selection ) ? selection : null;
}

function selectionForActionDeclarationLine(
    line: string,
    lineNumber: number,
    lines: string[],
    project: LiveSyncProject
): LiveSyncSelection | null {
    const actionMatch = line.match( /^\s*([A-Za-z_][A-Za-z0-9_]*)\s+"((?:\\.|[^"])*)"\s*;/ );
    if ( !actionMatch ) return null;

    let originKey: string | null = null;
    for ( let index = lineNumber - 2; index >= 0; index-- ) {
        const uiMatch = lines[ index ].match( /^\s*UI\s+([A-Za-z_][A-Za-z0-9_]*|\d+)\b/ );
        if ( uiMatch ) {
            originKey = uiMatch[ 1 ];
            break;
        }
    }
    if ( !originKey ) return null;

    const originNodeIds = new Set( nodeIdsByUiKey( project, originKey ) );
    const verb = actionMatch[ 1 ];
    const complement = unescapeQuotedUITDLText( actionMatch[ 2 ] );
    const selection = emptyLiveSelection();
    for ( const action of project.actions ) {
        if (
            action.verb === verb &&
            action.complement === complement &&
            originNodeIds.has( action.originNodeId )
        ) {
            selection.actions.add( action.id );
        }
    }

    return hasLiveSelection( selection ) ? selection : null;
}

function addTransitionEndpointNodes( selection: LiveSyncSelection, project: LiveSyncProject ) {
    const actionIds = new Set( selection.actions );

    for ( const condition of project.conditions ) {
        if ( selection.conditions.has( condition.id ) ) actionIds.add( condition.originActionId );
    }

    for ( const action of project.actions ) {
        if ( actionIds.has( action.id ) ) selection.nodes.add( action.originNodeId );
    }

    for ( const edge of project.edges ) {
        if ( edge.to.kind !== "node" ) continue;
        if ( edge.from.kind === "action" && actionIds.has( edge.from.id ) ) {
            selection.nodes.add( edge.to.id );
        }
        if ( edge.from.kind === "condition" && selection.conditions.has( edge.from.id ) ) {
            selection.nodes.add( edge.to.id );
        }
    }
}

function addConditionTransitionSelection( selection: LiveSyncSelection, project: LiveSyncProject ) {
    for ( const condition of project.conditions ) {
        if ( selection.conditions.has( condition.id ) ) selection.actions.add( condition.originActionId );
    }

    for ( const edge of project.edges ) {
        if ( edge.from.kind !== "condition" || edge.to.kind !== "node" ) continue;
        if ( selection.conditions.has( edge.from.id ) ) selection.nodes.add( edge.to.id );
    }
}

function selectionForTransitionLine(
    line: string,
    column: number,
    project: LiveSyncProject
): LiveSyncSelection | null {
    if ( !/\bTRANSITION\b/.test( line ) ) return null;

    const fromMatch = line.match( /\bfrom\s+(?<fromRef>\S+)\s+to\s+/ );
    const actionMatch = line.match( /\bif\s+user\s+(?<verb>[A-Za-z_][A-Za-z0-9_]*)\s+"(?<complement>(?:\\.|[^"])*)"/ );
    if ( !actionMatch?.groups ) return null;

    const originKey = fromMatch?.groups?.fromRef ? leafUiKeyOf( fromMatch.groups.fromRef ) : null;
    const originNodeIds = originKey ? new Set( nodeIdsByUiKey( project, originKey ) ) : null;
    const verb = actionMatch.groups.verb;
    const complement = unescapeQuotedUITDLText( actionMatch.groups.complement );
    const matchingActions = project.actions.filter( action =>
        action.verb === verb &&
        action.complement === complement &&
        ( !originNodeIds || originNodeIds.has( action.originNodeId ) )
    );
    const actions = matchingActions.length > 0
        ? matchingActions
        : project.actions.filter( action => action.verb === verb && action.complement === complement );

    const andIndexOf = line.indexOf( " AND " );
    const shouldPreferCondition = andIndexOf >= 0 && column > andIndexOf + 1;
    if ( shouldPreferCondition ) {
        const conditionMatch = line.match( /\bAND\s+"(?<condition>(?:\\.|[^"])*)"/ );
        const conditionTitle = conditionMatch?.groups?.condition
            ? unescapeQuotedUITDLText( conditionMatch.groups.condition )
            : "";
        const actionIds = new Set( actions.map( action => action.id ) );
        const matchingConditions = project.conditions.filter( condition =>
            condition.title === conditionTitle &&
            ( actionIds.size === 0 || actionIds.has( condition.originActionId ) )
        );

        const conditionSelection = emptyLiveSelection();
        for ( const condition of matchingConditions ) conditionSelection.conditions.add( condition.id );
        if ( hasLiveSelection( conditionSelection ) ) {
            addConditionTransitionSelection( conditionSelection, project );
            return conditionSelection;
        }
    }

    const actionSelection = emptyLiveSelection();
    for ( const action of actions ) actionSelection.actions.add( action.id );
    addTransitionEndpointNodes( actionSelection, project );
    return hasLiveSelection( actionSelection ) ? actionSelection : null;
}

function hasSelectedActionOverlap( left: LiveSyncSelection, right: LiveSyncSelection ): boolean {
    for ( const actionId of left.actions ) {
        if ( right.actions.has( actionId ) ) return true;
    }
    return false;
}

function hasSelectedConditionOverlap( left: LiveSyncSelection, right: LiveSyncSelection ): boolean {
    for ( const conditionId of left.conditions ) {
        if ( right.conditions.has( conditionId ) ) return true;
    }
    return false;
}

function collectCurrentTextLocations(
    text: string,
    selection: LiveSyncSelection,
    project: LiveSyncProject
): UITDLSourceLocation[] {
    const locations: UITDLSourceLocation[] = [];
    const lines = text.split( /\r?\n/ );
    const countByKey = new Map<string, number>();

    lines.forEach( ( line, index ) => {
        const lineNumber = index + 1;
        const references = drawReferencesOf( line );
        if ( references ) {
            for ( const reference of references ) {
                const occurrenceIndex = countByKey.get( reference.key ) ?? 0;
                addDrawReferenceTextLocations(
                    locations,
                    selection,
                    project,
                    reference,
                    lineNumber,
                    null,
                    occurrenceIndex
                );
                countByKey.set( reference.key, occurrenceIndex + 1 );
            }
        }

        if ( !/\bTRANSITION\b/.test( line ) ) return;
        const transitionColumn = line.indexOf( "TRANSITION" ) + 1;
        const actionSelection = selectionForTransitionLine( line, transitionColumn, project );
        if ( actionSelection && hasSelectedActionOverlap( selection, actionSelection ) ) {
            const actionMatch = line.match( /\bif\s+user\s+(?<action>[A-Za-z_][A-Za-z0-9_]*\s+"(?:\\.|[^"])*")/ );
            const actionText = actionMatch?.groups?.action;
            const actionColumn = actionText ? line.indexOf( actionText ) + 1 : transitionColumn;
            locations.push( {
                lineNumber,
                column: actionColumn,
                endColumn: actionText ? actionColumn + actionText.length : line.length + 1,
            } );
        }

        const andIndexOf = line.indexOf( " AND " );
        if ( andIndexOf < 0 ) return;
        const conditionSelection = selectionForTransitionLine( line, andIndexOf + 6, project );
        if ( conditionSelection && hasSelectedConditionOverlap( selection, conditionSelection ) ) {
            locations.push( {
                lineNumber,
                column: andIndexOf + 2,
                endColumn: line.length + 1,
            } );
        }
    } );

    return locations;
}

function selectionForEditorPosition(
    position: TextPosition | null,
    text: string,
    project: LiveSyncProject
): LiveSyncSelection | null {
    if ( !position ) return null;

    const lines = text.split( /\r?\n/ );
    const line = lines[ position.lineNumber - 1 ] ?? "";
    return selectionForTransitionLine( line, position.column, project )
        ?? selectionForFragmentLine( line, position.lineNumber, lines, project )
        ?? selectionForDrawLine( line, position.lineNumber, position.column, lines, project )
        ?? selectionForUiDeclarationLine( line, project )
        ?? selectionForActionDeclarationLine( line, position.lineNumber, lines, project );
}

function hasSameSelectionMembers(
    selection: LiveSyncSelection,
    fragment: UITDLFragmentSourceLocation
): boolean {
    return hasSameNumberSet( selection.nodes, new Set( fragment.nodeIds ) ) &&
        hasSameNumberSet( selection.actions, new Set( fragment.actionIds ) ) &&
        hasSameNumberSet( selection.conditions, new Set( fragment.conditionIds ) );
}

function collectSelectedTextLocations(
    locations: UITDLSourceMap,
    selection: LiveSyncSelection
): UITDLSourceLocation[] {
    const fragmentLocation = ( locations.fragments ?? [] ).find( fragment =>
        hasSameSelectionMembers( selection, fragment )
    );
    if ( fragmentLocation ) return [ fragmentLocation ];

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

    const lineDecorations = lineNumbers.map( lineNumber => ( {
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

    const referenceDecorations = locations.map( location => ( {
        range: {
            startLineNumber: location.lineNumber,
            startColumn: location.column,
            endLineNumber: location.lineNumber,
            endColumn: location.endColumn,
        },
        options: {
            className: "uitdlTextPanel__canvasSyncReference",
        },
    } ) );

    return [
        ...lineDecorations,
        ...referenceDecorations,
    ];
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
    const [ editorPositionSignal, setEditorPositionSignal ] = useState( 0 );
    const editorRef = useRef<editor.IStandaloneCodeEditor | null>( null );
    const monacoRef = useRef<Monaco | null>( null );
    const syncedLineDecorationsRef = useRef<TextDecorationCollection | null>( null );
    const completionListenerRef = useRef<{ dispose: () => void } | null>( null );
    const cursorListenerRef = useRef<{ dispose: () => void } | null>( null );
    const focusListenerRef = useRef<{ dispose: () => void } | null>( null );
    const blurListenerRef = useRef<{ dispose: () => void } | null>( null );
    const tabKeyListenerRef = useRef<{ dispose: () => void } | null>( null );
    const tabNavigationActionsRef = useRef<{ dispose: () => void }[]>( [] );
    const fileInputRef = useRef<HTMLInputElement | null>( null );
    const simulationWasRunningRef = useRef( false );
    const shouldFitCanvasAfterSimulationRef = useRef( false );
    const liveSyncRunRef = useRef( 0 );
    const latestEditorPositionRef = useRef<TextPosition | null>( null );
    const isEditorFocusedRef = useRef( false );
    const lastRevealedSelectionRef = useRef( "" );
    const lastObservedSelectionKeyRef = useRef( "" );
    const lastTriggeredCompletionFieldRef = useRef( "" );
    const ignoredTextRevealSelectionKeyRef = useRef( "" );
    const ignoredCursorSelectionKeyRef = useRef( "" );
    const ignoredEditorPositionKeysRef = useRef( new Set<string>() );
    const { progress, runSimulation, runSimulationForCurrentSelection, stopSimulation } = useImportedDiagramSimulation();

    const issues = useMemo( () => callOfficialUITDLValidator( text ), [ text ] );
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
        const locked = isUITDLLiveSyncEnabled && !isCanvasLiveSyncEnabled;
        useAppStore.getState().setCanvasLockedByUITDLLiveSync( locked );
        return () => useAppStore.getState().setCanvasLockedByUITDLLiveSync( false );
    }, [ isCanvasLiveSyncEnabled, isUITDLLiveSyncEnabled ] );

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

    useEffect( () => {
        const keyOfCurrentStoreSelection = () => {
            const state = useAppStore.getState();
            return selectionKeyOf( {
                nodes: state.selection,
                actions: state.selectionActions,
                conditions: state.selectionConds,
            } );
        };

        lastObservedSelectionKeyRef.current = keyOfCurrentStoreSelection();
        return useAppStore.subscribe( () => {
            const nextSelectionKey = keyOfCurrentStoreSelection();
            if ( nextSelectionKey === lastObservedSelectionKeyRef.current ) return;
            lastObservedSelectionKeyRef.current = nextSelectionKey;
            setSelectionSignal( current => current + 1 );
        } );
    }, [] );

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

        if ( isEditorFocusedRef.current ) {
            syncedLineDecorationsRef.current?.clear();
            return;
        }

        const selectionKey = selectionKeyOf( currentSelection );
        if ( ignoredTextRevealSelectionKeyRef.current === selectionKey ) {
            ignoredTextRevealSelectionKeyRef.current = "";
            return;
        }

        const exported = exportToUITDLWithLocations( state );
        const locations = exported.text === text
            ? collectSelectedTextLocations( exported.locations, currentSelection )
            : collectCurrentTextLocations( text, currentSelection, state );
        const range = textSelectionOf( locations );
        const middleLine = middleLineOf( locations );
        if ( !range || middleLine == null ) {
            syncedLineDecorationsRef.current?.clear();
            return;
        }

        syncedLineDecorationsRef.current?.set( lineDecorationsOf( locations ) );

        const revealKey = `${selectionKey}|${textRangeKeyOf( locations )}|${text.length}`;
        if ( lastRevealedSelectionRef.current === revealKey ) return;
        lastRevealedSelectionRef.current = revealKey;

        const nextEditorPosition = {
            lineNumber: middleLine,
            column: range.startColumn,
        };
        ignoredEditorPositionKeysRef.current = new Set( [
            textPositionKeyOf( nextEditorPosition ),
            textPositionKeyOf( {
                lineNumber: range.startLineNumber,
                column: range.startColumn,
            } ),
            textPositionKeyOf( {
                lineNumber: range.endLineNumber,
                column: range.endColumn,
            } ),
        ] );
        mountedEditor.setSelection( range );
        mountedEditor.setPosition( nextEditorPosition );
        mountedEditor.revealLineInCenter( middleLine );
    }, [ isUITDLLiveSyncEnabled, selectionSignal, text ] );

    useEffect( () => {
        if ( !isUITDLLiveSyncEnabled || isCanvasLiveSyncEnabled ) return;

        const applySelectionFromTextEditor = ( selection: LiveSyncSelection ) => {
            ignoredTextRevealSelectionKeyRef.current = selectionKeyOf( selection );
            applyLiveSelection( selection, false );
            centerCanvasOnSelection( selection, { preserveZoom: true } );
        };

        const runId = ++liveSyncRunRef.current;
        const timer = window.setTimeout( async () => {
            if ( runId !== liveSyncRunRef.current ) return;
            const liveSyncIssues = callOfficialUITDLValidator( text );
            const liveSyncErrors = liveSyncIssues.filter( issue => issue.kind === "error" );
            if ( liveSyncErrors.length > 0 ) {
                setStatus( { kind: "error", message: "Canvas kept the last valid UITDL because the text has errors." } );
                return;
            }
            if ( text === appliedText ) {
                setStatus( { kind: "success", message: "Canvas is synchronized from UITDL." } );
                return;
            }

            try {
                const result = reconcileUITDLTextIncrementally( text, useAppStore.getState() );
                const editorSelection = selectionForEditorPosition( latestEditorPositionRef.current, text, result );
                if ( result.changedCount === 0 ) {
                    if ( editorSelection && hasLiveSelection( editorSelection ) ) {
                        applySelectionFromTextEditor( editorSelection );
                    }
                    setAppliedText( text );
                    setStatus( { kind: "success", message: "Canvas is synchronized from UITDL." } );
                    return;
                }

                if ( hasLiveSelection( result.beforeSelection ) ) {
                    applySelectionFromTextEditor( result.beforeSelection );
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
                const afterSelection = hasLiveSelection( result.afterSelection )
                    ? result.afterSelection
                    : editorSelection && hasLiveSelection( editorSelection )
                        ? editorSelection
                        : result.afterSelection;
                if (
                    editorSelection &&
                    hasLiveSelection( editorSelection ) &&
                    selectionKeyOf( editorSelection ) !== selectionKeyOf( afterSelection )
                ) {
                    ignoredCursorSelectionKeyRef.current = selectionKeyOf( editorSelection );
                }
                applySelectionFromTextEditor( afterSelection );
                shouldFitCanvasAfterSimulationRef.current = false;
                runSimulationForCurrentSelection();
                setAppliedText( text );
                const numOfLiveSyncWarnings = liveSyncIssues.filter( issue => issue.kind === "warning" ).length;
                setStatus( {
                    kind: numOfLiveSyncWarnings > 0 ? "info" : "success",
                    message: numOfLiveSyncWarnings > 0
                        ? `Canvas updated from UITDL with ${numOfLiveSyncWarnings} warning(s).`
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
        isCanvasLiveSyncEnabled,
        isUITDLLiveSyncEnabled,
        runSimulationForCurrentSelection,
        text,
    ] );

    useEffect( () => {
        if ( errors.length > 0 || text !== appliedText ) return;
        const editorModelText = editorRef.current?.getModel()?.getValue();
        if ( editorModelText != null && editorModelText !== text ) return;
        const editorSelection = selectionForEditorPosition(
            latestEditorPositionRef.current,
            text,
            useAppStore.getState()
        );
        if ( !editorSelection || !hasLiveSelection( editorSelection ) ) return;
        if ( isCurrentLiveSelection( editorSelection ) ) return;
        const editorSelectionKey = selectionKeyOf( editorSelection );
        if ( ignoredCursorSelectionKeyRef.current === editorSelectionKey ) {
            ignoredCursorSelectionKeyRef.current = "";
            return;
        }
        ignoredTextRevealSelectionKeyRef.current = editorSelectionKey;
        applyLiveSelection( editorSelection, false );
        centerCanvasOnSelection( editorSelection, { preserveZoom: true } );
    }, [ appliedText, editorPositionSignal, errors.length, text ] );

    useEffect( () => () => {
        completionListenerRef.current?.dispose();
        cursorListenerRef.current?.dispose();
        focusListenerRef.current?.dispose();
        blurListenerRef.current?.dispose();
        tabKeyListenerRef.current?.dispose();
        tabNavigationActionsRef.current.forEach( action => action.dispose() );
        tabNavigationActionsRef.current = [];
    }, [] );

    useEffect( () => {
        if ( progress != null ) {
            simulationWasRunningRef.current = true;
            return;
        }
        if ( !simulationWasRunningRef.current ) return;
        simulationWasRunningRef.current = false;
        if ( shouldFitCanvasAfterSimulationRef.current ) {
            shouldFitCanvasAfterSimulationRef.current = false;
            useAppStore.getState().requestCanvasFitToWidth();
            return;
        }

        const state = useAppStore.getState();
        const currentSelection: LiveSyncSelection = {
            nodes: state.selection,
            actions: state.selectionActions,
            conditions: state.selectionConds,
        };
        if ( hasLiveSelection( currentSelection ) ) {
            centerCanvasOnSelection( currentSelection, { preserveZoom: true } );
        }
    }, [ progress ] );

    const handleMount: OnMount = ( mountedEditor, monaco ) => {
        editorRef.current = mountedEditor;
        monacoRef.current = monaco;
        latestEditorPositionRef.current = mountedEditor.getPosition();
        syncedLineDecorationsRef.current = mountedEditor.createDecorationsCollection();
        registerUITDLLanguage( monaco );
        monaco.editor.setModelLanguage( mountedEditor.getModel()!, UITDL_LANGUAGE_ID );
        completionListenerRef.current?.dispose();
        cursorListenerRef.current?.dispose();
        focusListenerRef.current?.dispose();
        blurListenerRef.current?.dispose();
        tabKeyListenerRef.current?.dispose();
        tabNavigationActionsRef.current.forEach( action => action.dispose() );
        tabNavigationActionsRef.current = [];
        focusListenerRef.current = mountedEditor.onDidFocusEditorText( () => {
            isEditorFocusedRef.current = true;
            syncedLineDecorationsRef.current?.clear();
        } );
        blurListenerRef.current = mountedEditor.onDidBlurEditorText( () => {
            isEditorFocusedRef.current = false;
            setSelectionSignal( current => current + 1 );
        } );
        cursorListenerRef.current = mountedEditor.onDidChangeCursorPosition( event => {
            const nextEditorPosition = {
                lineNumber: event.position.lineNumber,
                column: event.position.column,
            };
            const editorPositionKey = textPositionKeyOf( nextEditorPosition );
            if ( ignoredEditorPositionKeysRef.current.has( editorPositionKey ) ) {
                ignoredEditorPositionKeysRef.current.delete( editorPositionKey );
                return;
            }
            latestEditorPositionRef.current = nextEditorPosition;
            setEditorPositionSignal( current => current + 1 );
            if ( !isEditorFocusedRef.current ) return;
            window.requestAnimationFrame( () => {
                const model = mountedEditor.getModel();
                const position = mountedEditor.getPosition();
                if ( !model || !position ) return;
                const lineContent = model.getLineContent( position.lineNumber );
                if ( !shouldTriggerUITDLFieldCompletion(
                    model.getValue(),
                    lineContent,
                    position.lineNumber,
                    position.column
                ) ) {
                    lastTriggeredCompletionFieldRef.current = "";
                    return;
                }
                const completionFieldKey = `${position.lineNumber}:${position.column}:${lineContent}`;
                if ( completionFieldKey === lastTriggeredCompletionFieldRef.current ) return;
                lastTriggeredCompletionFieldRef.current = completionFieldKey;
                mountedEditor.trigger( "uitdl-field-completion", "editor.action.triggerSuggest", {} );
            } );
        } );
        completionListenerRef.current = mountedEditor.onDidChangeModelContent( event => {
            latestEditorPositionRef.current = mountedEditor.getPosition();
            const typedText = event.changes.length === 1 ? event.changes[ 0 ].text : "";
            if ( !/^\d$/.test( typedText ) ) return;
            window.requestAnimationFrame( () => {
                const model = mountedEditor.getModel();
                const position = mountedEditor.getPosition();
                if ( !model || !position ) return;
                const lineContent = model.getLineContent( position.lineNumber );
                if ( !shouldTriggerUIIDCompletion(
                    model.getValue(),
                    lineContent,
                    position.lineNumber,
                    position.column,
                    typedText
                ) ) return;
                const completionFieldKey = `${position.lineNumber}:${position.column}:${lineContent}`;
                if ( completionFieldKey === lastTriggeredCompletionFieldRef.current ) return;
                lastTriggeredCompletionFieldRef.current = completionFieldKey;
                mountedEditor.trigger( "uitdl-uiid-completion", "editor.action.triggerSuggest", {} );
            } );
        } );
        const jumpToEditableField = ( direction: "next" | "previous" ) => {
            const model = mountedEditor.getModel();
            const selection = mountedEditor.getSelection();
            const position = direction === "next"
                ? selection?.getEndPosition() ?? mountedEditor.getPosition()
                : selection?.getStartPosition() ?? mountedEditor.getPosition();
            if ( !model || !position ) return;
            const field = findNextUITDLEditableField( model.getValue(), position, direction );
            if ( !field ) return;
            mountedEditor.trigger( "uitdl-tab-navigation", "hideSuggestWidget", {} );
            mountedEditor.trigger( "uitdl-tab-navigation", "leaveSnippet", {} );
            mountedEditor.setSelection( field );
            mountedEditor.revealRangeInCenterIfOutsideViewport( field );
        };
        tabKeyListenerRef.current = mountedEditor.onKeyDown( ( event: IKeyboardEvent ) => {
            if ( event.keyCode !== monaco.KeyCode.Tab ) return;
            if ( event.altKey || event.ctrlKey || event.metaKey || event.altGraphKey ) return;
            event.preventDefault();
            event.stopPropagation();
            jumpToEditableField( event.shiftKey ? "previous" : "next" );
        } );
        tabNavigationActionsRef.current = [
            mountedEditor.addAction( {
                id: "uitdl.jumpToNextEditableField",
                label: "Jump to next UITDL editable field",
                keybindings: [ monaco.KeyCode.Tab ],
                precondition: "editorTextFocus",
                keybindingContext: "!suggestWidgetVisible",
                run: () => jumpToEditableField( "next" ),
            } ),
            mountedEditor.addAction( {
                id: "uitdl.jumpToPreviousEditableField",
                label: "Jump to previous UITDL editable field",
                keybindings: [ monaco.KeyMod.Shift | monaco.KeyCode.Tab ],
                precondition: "editorTextFocus",
                keybindingContext: "!suggestWidgetVisible",
                run: () => jumpToEditableField( "previous" ),
            } ),
            mountedEditor.addAction( {
                id: "uitdl.jumpToNextEditableFieldWithSuggestions",
                label: "Jump to next UITDL editable field while suggestions are visible",
                keybindings: [ monaco.KeyCode.Tab ],
                precondition: "editorTextFocus",
                keybindingContext: "suggestWidgetVisible",
                run: () => jumpToEditableField( "next" ),
            } ),
            mountedEditor.addAction( {
                id: "uitdl.jumpToPreviousEditableFieldWithSuggestions",
                label: "Jump to previous UITDL editable field while suggestions are visible",
                keybindings: [ monaco.KeyMod.Shift | monaco.KeyCode.Tab ],
                precondition: "editorTextFocus",
                keybindingContext: "suggestWidgetVisible",
                run: () => jumpToEditableField( "previous" ),
            } ),
        ];
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
            shouldFitCanvasAfterSimulationRef.current = true;
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
        const hasDiagnostics = issues.length > 0;
        flushSync( () => {
            setStatus( {
                kind: "info",
                message: hasDiagnostics
                    ? "Copying the UITDL text and diagnostics…"
                    : "Copying the UITDL text…",
            } );
        } );
        try {
            await copyText( formatUITDLTextWithDiagnosticsForClipboard( text, issues ) );
            setStatus( {
                kind: "success",
                message: hasDiagnostics
                    ? "UITDL text and diagnostics copied to the clipboard."
                    : "UITDL text copied to the clipboard.",
            } );
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

            { isCanvasLiveSyncEnabled && (
                <div className="uitdlTextPanel__readonlyNotice" role="note">
                    Turn off Live from canvas to edit text or use find and replace.
                </div>
            ) }

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
