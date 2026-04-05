// src/components/Canvas/FileToolbar.tsx
import React, { useEffect, useRef, useState } from "react";
import { useAppStore } from "../../state/store";
import type { AppState, NodeBox, ActionLabel, ConditionLabel } from "../../state/types";
import { importUITDL } from "../../import/uitdl";
import { getNodeSizeCached, measureActionOval, measureConditionOval } from "../../layout/measurement";
import { DEFAULT_SIM_PARAMS } from "../../physics/defaults";
import {
    SIM_PARAMS_STORAGE_KEY,
    sanitizeSimParams,
} from "../../physics/simParamsStorage";
import {
    startForcesRun,
    type ForcesRunProgress,
    type ForcesRunFinishReason,
} from "../../physics/runForces";
import type { SimParams } from "./ForcesDialog";
import { SimulationProgressDialog } from "./SimulationProgressDialog";

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
    nextId?: number;
    nextActionId?: number;
    nextEdgeId?: number;
    panzoom?: AppState[ "panzoom" ];
    viewBox?: AppState[ "viewBox" ];
};

function loadSimParams(): SimParams {
    try {
        const raw = localStorage.getItem( SIM_PARAMS_STORAGE_KEY );
        if ( !raw ) return DEFAULT_SIM_PARAMS;
        const parsed = JSON.parse( raw ) as unknown;
        return sanitizeSimParams( parsed, DEFAULT_SIM_PARAMS );
    } catch {
        return DEFAULT_SIM_PARAMS;
    }
}

function serializeProject( s: AppState ) {
    return JSON.stringify(
        {
            nodes: s.nodes,
            actions: s.actions,
            conditions: s.conditions,
            edges: s.edges,

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
function isProjectJson( x: unknown ): x is ProjectJson {
    if ( !isRecord( x ) ) return false;
    const wantArrays = [ "nodes", "actions", "conditions", "edges" ] as const;

    if ( !wantArrays.every( ( k ) => isArrayOf( x[ k ] ) ) ) return false;
    if ( x.panzoom !== undefined && !isPanzoom( x.panzoom ) ) return false;
    if ( x.viewBox !== undefined && !isViewBox( x.viewBox ) ) return false;

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

function centerDiagramInView() {
    const s = useAppStore.getState();
    const { nodes, actions, conditions, viewBox } = s;

    type Item = { x: number; y: number; w: number; h: number };
    const items: Item[] = [];

    // Nodos
    for ( const n of nodes as NodeBox[] ) {
        const m = getNodeSizeCached( n );
        items.push( {
            x: n.x,
            y: n.y,
            w: m.w,
            h: m.h,
        } );
    }

    // Acciones
    for ( const a of actions as ActionLabel[] ) {
        const wrap = a.wrap ?? 22;
        const m = measureActionOval( a.title, wrap );
        items.push( {
            x: a.x,
            y: a.y,
            w: m.w,
            h: m.h,
        } );
    }

    // Condiciones
    for ( const c of conditions as ConditionLabel[] ) {
        const wrap = c.wrap ?? 22;
        const m = measureConditionOval( c.title, wrap );
        items.push( {
            x: c.x,
            y: c.y,
            w: m.w,
            h: m.h,
        } );
    }

    // Nada que centrar
    if ( items.length === 0 ) {
        useAppStore.setState( ( st ) => ( {
            panzoom: { ...st.panzoom, x: 0, y: 0, zoom: 1 },
        } ) );
        return;
    }

    // Bounding box en coords de mundo
    let minX = Infinity,
        maxX = -Infinity;
    let minY = Infinity,
        maxY = -Infinity;

    for ( const it of items ) {
        const left = it.x - it.w / 2;
        const right = it.x + it.w / 2;
        const top = it.y - it.h / 2;
        const bottom = it.y + it.h / 2;

        if ( left < minX ) minX = left;
        if ( right > maxX ) maxX = right;
        if ( top < minY ) minY = top;
        if ( bottom > maxY ) maxY = bottom;
    }

    const contentW = maxX - minX || 1;
    const contentH = maxY - minY || 1;

    const margin = 80; // píxeles de margen alrededor
    const targetW = contentW + margin;
    const targetH = contentH + margin;

    const vw = viewBox.w || 800;
    const vh = viewBox.h || 600;

    const zoomX = vw / targetW;
    const zoomY = vh / targetH;
    let zoom = Math.min( zoomX, zoomY );

    if ( !Number.isFinite( zoom ) || zoom <= 0 ) zoom = 1;

    const cx = ( minX + maxX ) / 2;
    const cy = ( minY + maxY ) / 2;

    // Asumiendo transform="translate(pan.x, pan.y) scale(pan.zoom)"
    const x = vw / 2 - zoom * cx;
    const y = vh / 2 - zoom * cy;

    useAppStore.setState( ( st ) => ( {
        panzoom: {
            ...st.panzoom,
            x,
            y,
            zoom,
        },
    } ) );
}

// ---------- Componente ----------
type Props = {
    onRequestClose?: () => void;
};

export function FileToolbar( { onRequestClose }: Props ) {
    const inputOpenRef = useRef<HTMLInputElement | null>( null );
    const inputImportUITDLRef = useRef<HTMLInputElement | null>( null );
    const importSimulationStopRef = useRef<( () => void ) | null>( null );
    const isMountedRef = useRef( true );
    const [ importSimulationProgress, setImportSimulationProgress ] = useState<ForcesRunProgress | null>( null );

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

    const stopImportSimulation = () => {
        if ( !importSimulationStopRef.current ) return;
        const stop = importSimulationStopRef.current;
        importSimulationStopRef.current = null;
        stop();
    };

    const finishImportSimulation = ( reason: ForcesRunFinishReason ) => {
        importSimulationStopRef.current = null;
        if ( isMountedRef.current ) {
            setImportSimulationProgress( null );
        }
        useAppStore.getState().clearSelection?.();
        centerDiagramInView();
        if ( reason === "max_iterations" ) {
            window.alert( "La simulación se detuvo sin converger completamente." );
        }
        if ( reason === "stalled" ) {
            window.alert( "La simulación se detuvo por estancamiento." );
        }
    };

    const runImportSimulation = () => {
        const state = useAppStore.getState();
        const totalItems = state.nodes.length + state.actions.length + state.conditions.length;
        if ( totalItems === 0 ) {
            centerDiagramInView();
            return;
        }

        const params = loadSimParams();
        const convergenceThreshold = 20;
        const stableFramesRequired = 12;

        useAppStore.setState( {
            selection: new Set<number>( state.nodes.map( n => n.id ) ),
            selectionActions: new Set<number>( state.actions.map( a => a.id ) ),
            selectionConds: new Set<number>( state.conditions.map( c => c.id ) ),
            focusTarget: null,
            keyboardMarquee: null,
            marqueeSeed: null,
        } );

        setImportSimulationProgress( {
            iterations: 0,
            totalIterations: null,
            maxDisp: Number.POSITIVE_INFINITY,
            convergenceThreshold,
            stableFrames: 0,
            stableFramesRequired,
            stopWhenConverged: true,
        } );

        importSimulationStopRef.current = startForcesRun( {
            iterations: Number.POSITIVE_INFINITY,
            stepsPerFrame: params.stepsPerFrame,
            fastForward: params.fastForward,
            physics: {
                springK: params.springK,
                equilibriumDist: params.equilibriumDist,
                coulombC: params.coulombC,
                frictionGamma: params.frictionGamma,
                timeStep: params.timeStep,
                maxDisplacement: params.maxDisplacement,
            },
            stopWhenConverged: true,
            convergenceThreshold,
            stableFramesRequired,
            stopWhenStalled: true,
            stallFramesRequired: 180,
            stallImprovementThreshold: 0.5,
            onProgress: ( progress ) => setImportSimulationProgress( progress ),
            onFinish: ( reason ) => finishImportSimulation( reason ),
        } );
    };

    const handleOpenClick = () => {
        if ( !confirmIfUnsaved() ) return;
        inputOpenRef.current?.click();
    };

    const handleImportUITDLClick = () => {
        if ( !confirmIfUnsaved() ) return;
        inputImportUITDLRef.current?.click();
    };

    const handleOpenFile: React.ChangeEventHandler<HTMLInputElement> = async ( e ) => {
        const inputEl = e.currentTarget; // guarda ref
        const f = inputEl.files?.[ 0 ];
        if ( !f ) return;
        try {
            const text = await f.text();
            const json = JSON.parse( text ) as unknown;
            applyLoadedProject( json, { resetHistory: true, clearClipboard: true } );
            centerDiagramInView();
            setSavedHash( getCurrentHash() );
        } catch ( err ) {
            console.error( "[Open] Failed to load file:", err );
            alert( "Failed to open file. Is it a valid project JSON?" );
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
        const s = useAppStore.getState();
        s.resetProjectToBlank?.();
        s.clearSavedProject?.();
        onRequestClose?.();
    };

    const handleImportUITDLFile: React.ChangeEventHandler<HTMLInputElement> = async ( e ) => {
        const inputEl = e.currentTarget;
        const f = inputEl.files?.[ 0 ];
        if ( !f ) return;

        try {
            const txt = await f.text();

            const base = useAppStore.getState();
            const projectJson = importUITDL( txt, base );
            // Evita que el import quede absorbido por una sesión de edición activa.
            base.commitEditingSession?.();

            // Import UITDL como una sola entrada de undo
            const { captureDelta } = useAppStore.getState();
            captureDelta( [ "nodes", "actions", "conditions", "edges" ], () => {
                applyLoadedProject( projectJson, { resetHistory: false, clearClipboard: true } );

                const sAfter = useAppStore.getState();
                const parentsWithChildren = new Set<number>();
                for ( const n of sAfter.nodes as NodeBox[] ) {
                    if ( n.parentId != null ) {
                        parentsWithChildren.add( n.parentId );
                    }
                }
                parentsWithChildren.forEach( ( parentId ) => {
                    sAfter.relayoutContainer( parentId );
                    sAfter.relayoutAncestors( parentId );
                } );
            } );

            const importedState = useAppStore.getState();
            const totalItems =
                importedState.nodes.length + importedState.actions.length + importedState.conditions.length;

            if ( totalItems > 0 ) {
                runImportSimulation();
            } else {
                centerDiagramInView();
            }
        } catch ( err ) {
            console.error( "[Import UITDL] Error:", err );
            alert( "Failed to import UITDL." );
        } finally {
            inputEl.value = "";
        }
    };

    useEffect( () => {
        isMountedRef.current = true;
        if ( getSavedHash() == null ) {
            setSavedHash( getCurrentHash() );
        }
        return () => {
            isMountedRef.current = false;
        };
    }, [] );

    useEffect( () => {
        return () => {
            if ( importSimulationStopRef.current ) {
                const stop = importSimulationStopRef.current;
                importSimulationStopRef.current = null;
                stop();
            }
        };
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
                <input
                    ref={ inputImportUITDLRef }
                    type="file"
                    accept=".uitd,.txt,text/plain"
                    style={ { display: "none" } }
                    onChange={ handleImportUITDLFile }
                />

                {/* New */ }
                <button
                    type="button"
                    onClick={ handleNewClick }
                    title="New project"
                    aria-label="New project"
                    style={ textBtnStyle }
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
                    title="Open project"
                    aria-label="Open project"
                    style={ textBtnStyle }
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

                {/* Import UITDL */ }
                <button
                    type="button"
                    onClick={ handleImportUITDLClick }
                    title="Import UITDL"
                    aria-label="Import UITDL"
                    style={ textBtnStyle }
                >
                    <span>UITDL</span>
                    <IconBase>
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                    </IconBase>
                </button>
            </div>

            <SimulationProgressDialog
                open={ importSimulationProgress != null }
                progress={ importSimulationProgress }
                onStop={ stopImportSimulation }
            />
        </>
    );
}

export default FileToolbar;




