// src/components/Canvas/FileToolbar.tsx
import React, { useEffect, useRef } from "react";
import { useAppStore } from "../../state/store";
import type { AppState } from "../../state/types";
import { hasLeadingZeroUIID, leadingZeroUIIDMessage } from "../../import/uitdl/uiIdValidation";

// ---------- IconBase ----------
const IconBase: React.FC<React.SVGProps<SVGSVGElement>> = ( { children, ...props } ) => (
    <svg
        width={ 18 }
        height={ 18 }
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={ 2 }
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        { ...props }
    >
        { children }
    </svg>
);

// ---------- Utils ----------
function downloadBlob( filename: string, blob: Blob ) {
    const url = URL.createObjectURL( blob );
    const a = document.createElement( "a" );
    a.href = url;
    a.download = filename;
    document.body.appendChild( a );
    a.click();
    a.remove();
    URL.revokeObjectURL( url );
}

type ProjectJson = {
    nodes: AppState[ "nodes" ];
    actions: AppState[ "actions" ];
    conditions: AppState[ "conditions" ];
    edges: AppState[ "edges" ];
    fragmentTitles?: AppState[ "fragmentTitles" ];
    nextId?: number;
    nextActionId?: number;
    nextEdgeId?: number;
    panzoom?: AppState[ "panzoom" ];
    viewBox?: AppState[ "viewBox" ];
};

function serializeProject( s: AppState ) {
    return JSON.stringify(
        {
            nodes: s.nodes,
            actions: s.actions,
            conditions: s.conditions,
            edges: s.edges,
            fragmentTitles: s.fragmentTitles,

            nextId: s.nextId,
            nextActionId: s.nextActionId,
            nextEdgeId: s.nextEdgeId,

            panzoom: s.panzoom,
            viewBox: s.viewBox,
        },
        null,
        2
    );
}

function isRecord( x: unknown ): x is Record<string, unknown> {
    return typeof x === "object" && x !== null;
}
function isArrayOf<T = unknown>( x: unknown ): x is T[] {
    return Array.isArray( x );
}
function isPanzoom( v: unknown ): v is AppState[ "panzoom" ] {
    return (
        isRecord( v ) &&
        Number.isFinite( v.x ) &&
        Number.isFinite( v.y ) &&
        Number.isFinite( v.zoom ) &&
        Number( v.zoom ) > 0
    );
}
function isViewBox( v: unknown ): v is AppState[ "viewBox" ] {
    return (
        isRecord( v ) &&
        Number.isFinite( v.w ) &&
        Number.isFinite( v.h ) &&
        Number( v.w ) > 0 &&
        Number( v.h ) > 0
    );
}
function isStringRecord( v: unknown ): v is Record<string, string> {
    return (
        isRecord( v ) &&
        Object.values( v ).every( value => typeof value === "string" )
    );
}
function isProjectJson( x: unknown ): x is ProjectJson {
    if ( !isRecord( x ) ) return false;
    const wantArrays = [ "nodes", "actions", "conditions", "edges" ] as const;

    if ( !wantArrays.every( ( k ) => isArrayOf( x[ k ] ) ) ) return false;
    if ( x.panzoom !== undefined && !isPanzoom( x.panzoom ) ) return false;
    if ( x.viewBox !== undefined && !isViewBox( x.viewBox ) ) return false;
    if ( x.fragmentTitles !== undefined && !isStringRecord( x.fragmentTitles ) ) return false;

    // Validación mínima de shape interna para evitar cargar basura
    const isNode = ( v: unknown ) =>
        isRecord( v ) &&
        Number.isFinite( v.id ) &&
        Number.isFinite( v.x ) &&
        Number.isFinite( v.y ) &&
        typeof v.title === "string";
    const isAction = ( v: unknown ) =>
        isRecord( v ) &&
        Number.isFinite( v.id ) &&
        Number.isFinite( v.originNodeId ) &&
        Number.isFinite( v.x ) &&
        Number.isFinite( v.y ) &&
        typeof v.title === "string" &&
        typeof v.verb === "string";
    const isCondition = ( v: unknown ) =>
        isRecord( v ) &&
        Number.isFinite( v.id ) &&
        Number.isFinite( v.originActionId ) &&
        Number.isFinite( v.x ) &&
        Number.isFinite( v.y ) &&
        typeof v.title === "string";
    const isEndpoint = ( ep: unknown ) =>
        isRecord( ep ) &&
        ( ep.kind === "node" || ep.kind === "action" || ep.kind === "condition" ) &&
        Number.isFinite( ep.id );
    const isEdge = ( v: unknown ) =>
        isRecord( v ) &&
        Number.isFinite( v.id ) &&
        isEndpoint( v.from ) &&
        isEndpoint( v.to );

    if ( !( x.nodes as unknown[] ).every( isNode ) ) return false;
    if ( !( x.actions as unknown[] ).every( isAction ) ) return false;
    if ( !( x.conditions as unknown[] ).every( isCondition ) ) return false;
    if ( !( x.edges as unknown[] ).every( isEdge ) ) return false;

    return true;
}

function applyLoadedProject(
    json: unknown,
    opts: { resetHistory?: boolean; clearClipboard?: boolean } = {}
) {
    if ( !isProjectJson( json ) ) throw new Error( "Invalid file." );
    const invalidNode = json.nodes.find( node => {
        const uiId = ( node.displayId ?? String( node.id ) ).trim();
        return hasLeadingZeroUIID( uiId );
    } );
    if ( invalidNode ) {
        const uiId = ( invalidNode.displayId ?? String( invalidNode.id ) ).trim();
        throw new Error( leadingZeroUIIDMessage( uiId ) );
    }

    const resetHistory = opts.resetHistory ?? true;
    const clearClipboard = opts.clearClipboard ?? true;

    const maxNode = Math.max( 0, ...json.nodes.map( n => n.id ) );
    const maxCond = Math.max( 0, ...json.conditions.map( c => c.id ) );
    const maxAction = Math.max( 0, ...json.actions.map( a => a.id ) );
    const maxEdge = Math.max( 0, ...json.edges.map( e => e.id ) );

    const computedNextId = Math.max( maxNode, maxCond ) + 1;
    const computedNextActionId = maxAction + 1;
    const computedNextEdgeId = maxEdge + 1;

    useAppStore.setState( ( s ) => ( {
        ...s,
        nodes: json.nodes,
        actions: json.actions,
        conditions: json.conditions,
        edges: json.edges,
        fragmentTitles: json.fragmentTitles ?? {},

        nextId: Number.isFinite( ( json as ProjectJson ).nextId )
            ? Math.max( ( json as ProjectJson ).nextId as number, computedNextId )
            : computedNextId,
        nextActionId: Number.isFinite( ( json as ProjectJson ).nextActionId )
            ? Math.max( ( json as ProjectJson ).nextActionId as number, computedNextActionId )
            : computedNextActionId,
        nextEdgeId: Number.isFinite( ( json as ProjectJson ).nextEdgeId )
            ? Math.max( ( json as ProjectJson ).nextEdgeId as number, computedNextEdgeId )
            : computedNextEdgeId,

        panzoom: isPanzoom( json.panzoom ) ? json.panzoom : s.panzoom,
        viewBox: isViewBox( json.viewBox ) ? json.viewBox : s.viewBox,

        // efímeros
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
        _clipboard: clearClipboard ? null : s._clipboard,

        historyUndo: resetHistory ? [] : s.historyUndo,
        historyRedo: resetHistory ? [] : s.historyRedo,
        historyBytes: resetHistory ? 0 : s.historyBytes,
        editingSession: null,
    } ) );
}

// ---- Unsaved changes tracker (simple hash por contenido) ----
function hashString( s: string ): string {
    let h = 0;
    for ( let i = 0; i < s.length; i++ ) {
        h = ( h * 31 + s.charCodeAt( i ) ) | 0;
    }
    return String( h >>> 0 );
}
function getCurrentHash(): string {
    const s = useAppStore.getState();
    return hashString( serializeProject( s ) );
}
function getSavedHash(): string | null {
    try {
        return localStorage.getItem( "uitdl-last-saved-hash" );
    } catch {
        return null;
    }
}
function setSavedHash( h: string ) {
    try {
        localStorage.setItem( "uitdl-last-saved-hash", h );
    } catch {
        /* ignore */
    }
}

// ---------- Componente ----------
type Props = {
    onRequestClose?: () => void;
    readOnly?: boolean;
};

export function FileToolbar( { onRequestClose, readOnly = false }: Props ) {
    const inputOpenRef = useRef<HTMLInputElement | null>( null );
    const pendingSavedFitRequestRef = useRef<number | null>( null );
    const canvasFitAppliedRequest = useAppStore( s => s.canvasFitAppliedRequest );

    const textBtnStyle: React.CSSProperties = {
        padding: "6px 10px",
        height: 34,
        width: "100%",
        borderRadius: 6,
        border: "1px solid #94a3b8",
        background: "#f8fafc",
        color: "#0f172a",
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        whiteSpace: "nowrap",
    };

    const confirmIfUnsaved = (): boolean => {
        const cur = getCurrentHash();
        const saved = getSavedHash();
        if ( saved && saved !== cur ) {
            return confirm(
                "There are changes not saved. If you continue, they will be lost. Do you want to continue?"
            );
        }
        return true;
    };

    const handleOpenClick = () => {
        if ( readOnly ) return;
        if ( !confirmIfUnsaved() ) return;
        inputOpenRef.current?.click();
    };

    const handleOpenFile: React.ChangeEventHandler<HTMLInputElement> = async ( e ) => {
        const inputEl = e.currentTarget; // guarda ref
        if ( readOnly ) {
            inputEl.value = "";
            return;
        }
        const f = inputEl.files?.[ 0 ];
        if ( !f ) return;
        try {
            const text = await f.text();
            const json = JSON.parse( text ) as unknown;
            applyLoadedProject( json, { resetHistory: true, clearClipboard: true } );
            pendingSavedFitRequestRef.current = useAppStore.getState().requestCanvasFitToWidth();
        } catch ( err ) {
            console.error( "[Open] Failed to load file:", err );
            const reason = err instanceof Error ? err.message : "Unknown error.";
            alert( `Failed to open file. ${reason}` );
        } finally {
            inputEl.value = "";
        }
    };

    const handleSaveClick = () => {
        const s = useAppStore.getState();
        const blob = new Blob( [ serializeProject( s ) ], {
            type: "application/json;charset=utf-8",
        } );
        downloadBlob( "project.json", blob );
        setSavedHash( getCurrentHash() ); // marcar como guardado
        onRequestClose?.()
    };

    const handleNewClick = () => {
        if ( readOnly ) return;
        const s = useAppStore.getState();
        s.resetProjectToBlank?.();
        s.clearSavedProject?.();
        onRequestClose?.();
    };

    useEffect( () => {
        const pendingRequest = pendingSavedFitRequestRef.current;
        if ( pendingRequest == null || canvasFitAppliedRequest < pendingRequest ) return;
        pendingSavedFitRequestRef.current = null;
        setSavedHash( getCurrentHash() );
    }, [ canvasFitAppliedRequest ] );

    useEffect( () => {
        if ( getSavedHash() == null ) {
            setSavedHash( getCurrentHash() );
        }
    }, [] );

    return (
        <>
            <div style={ { display: "flex", flexDirection:"column", gap: 8, width: 90 } }>
                {/* Hidden inputs */ }
                <input
                    ref={ inputOpenRef }
                    type="file"
                    accept=".json,application/json"
                    style={ { display: "none" } }
                    onChange={ handleOpenFile }
                />

                {/* New */ }
                <button
                    type="button"
                    onClick={ handleNewClick }
                    disabled={ readOnly }
                    title={ readOnly ? "Turn off Live to canvas to create a new project" : "New project" }
                    aria-label="New project"
                    style={ { ...textBtnStyle, ...( readOnly ? { opacity: 0.6, cursor: "not-allowed" } : {} ) } }
                >
                    <span>New</span>
                    <IconBase>
                        <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                        <path d="M14 3v6h6" />
                        <path d="M12 11v6" />
                        <path d="M9 14h6" />
                    </IconBase>
                </button>

                {/* Open */ }
                <button
                    type="button"
                    onClick={ handleOpenClick }
                    disabled={ readOnly }
                    title={ readOnly ? "Turn off Live to canvas to open a project" : "Open project" }
                    aria-label="Open project"
                    style={ { ...textBtnStyle, ...( readOnly ? { opacity: 0.6, cursor: "not-allowed" } : {} ) } }
                >
                    <span>Open</span>
                    <IconBase>
                        <path d="M3 7h5l2 2h11v9a2 2 0 0 1-2 2H3z" />
                        <path d="M3 7V5a2 2 0 0 1 2-2h3l2 2h4" />
                    </IconBase>
                </button>

                {/* Save */ }
                <button
                    type="button"
                    onClick={ handleSaveClick }
                    title="Save project"
                    aria-label="Save project"
                    style={ textBtnStyle }
                >
                    <span>Save</span>
                    <IconBase>
                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
                        <path d="M17 21V13H7v8" />
                        <path d="M7 3v4h8" />
                    </IconBase>
                </button>
            </div>
        </>
    );
}

export default FileToolbar;

