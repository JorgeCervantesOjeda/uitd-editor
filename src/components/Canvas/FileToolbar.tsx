import React, { useEffect, useRef } from "react";
import { useAppStore } from "../../state/store";
import type { AppState } from "../../state/types";
import { exportToUITDL } from "../../export/uitdl";
import { importUITDL } from "../../import/uitdl";
import { getNodeSizeCached, measureActionOval, measureConditionOval } from "../../layout/measurement";


// ---------- IconBase (sin spread, fija tipos correctos) ----------
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

function applyLoadedProject( json: any ) {
    if ( !json || typeof json !== "object" ) throw new Error( "Invalid file." );
    const wantArrays = [ "nodes", "actions", "conditions", "edges" ] as const;
    for ( const k of wantArrays ) {
        if ( !Array.isArray( json[ k ] ) ) throw new Error( `Invalid ${k} array.` );
    }
    const wantObjs = [ "panzoom", "viewBox" ] as const;
    for ( const k of wantObjs ) {
        if ( !json[ k ] || typeof json[ k ] !== "object" )
            throw new Error( `Invalid ${k} object.` );
    }

    useAppStore.setState( ( s ) => ( {
        ...s,
        nodes: json.nodes,
        actions: json.actions,
        conditions: json.conditions,
        edges: json.edges,

        nextId: Number.isFinite( json.nextId ) ? json.nextId : s.nextId,
        nextActionId: Number.isFinite( json.nextActionId )
            ? json.nextActionId
            : s.nextActionId,
        nextEdgeId: Number.isFinite( json.nextEdgeId )
            ? json.nextEdgeId
            : s.nextEdgeId,

        panzoom: json.panzoom,
        viewBox: json.viewBox,

        // efímeros
        selection: new Set<number>(),
        selectionActions: new Set<number>(),
        selectionConds: new Set<number>(),
        drag: {
            active: false,
            anchor: { x: 0, y: 0 },
            startNodes: new Map(),
            startActions: new Map(),
            startConds: new Map(),
        },
        pendingConnect: null,
        dragHoverParent: null,
    } ) );
}

// ---- Unsaved changes tracker (simple hash por contenido) ----
function hashString( s: string ): string {
    let h = 0;
    for ( let i = 0; i < s.length; i++ ) { h = ( h * 31 + s.charCodeAt( i ) ) | 0; }
    return String( h >>> 0 );
}
function getCurrentHash(): string {
    const s = useAppStore.getState();
    return hashString( serializeProject( s ) );
}
function getSavedHash(): string | null {
    try { return localStorage.getItem( "uitdl-last-saved-hash" ); } catch { return null; }
}
function setSavedHash( h: string ) {
    try { localStorage.setItem( "uitdl-last-saved-hash", h ); } catch { }
}

function centerDiagramInView() {
    const s = useAppStore.getState();
    const { nodes, actions, conditions, viewBox } = s;

    type Item = { x: number; y: number; w: number; h: number };
    const items: Item[] = [];

    // Nodos (usamos getNodeSizeCached para respetar wrap/layout actual)
    for ( const n of nodes ) {
        const m = getNodeSizeCached( n as any );
        items.push( {
            x: n.x,
            y: n.y,
            w: m.w,
            h: m.h,
        } );
    }

    // Acciones
    for ( const a of actions ) {
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
    for ( const c of conditions ) {
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
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

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

    const contentW = ( maxX - minX ) || 1;
    const contentH = ( maxY - minY ) || 1;

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
export function FileToolbar() {
    const inputOpenRef = useRef<HTMLInputElement | null>( null );
    const inputImportUITDLRef = useRef<HTMLInputElement | null>( null );

    const textBtnStyle: React.CSSProperties = {
        padding: "6px 10px",
        height: 34,
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

    const iconBtnStyle: React.CSSProperties = {
        ...textBtnStyle,
        width: 34,
        padding: 6,
        gap: 0,
        justifyContent: "center",
    };

    const confirmIfUnsaved = (): boolean => {
        const cur = getCurrentHash();
        const saved = getSavedHash();
        if ( saved && saved !== cur ) {
            return confirm( "There are changes not saved. If you continue, they will be lost. Do you want to continue?" );
        }
        return true;
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
        const inputEl = e.currentTarget;                // ← guarda referencia
        const f = inputEl.files?.[ 0 ];
        if ( !f ) return;
        try {
            const text = await f.text();               // tras await, no uses e.currentTarget
            const json = JSON.parse( text );
            applyLoadedProject( json );
            centerDiagramInView();
            setSavedHash( getCurrentHash() );
        } catch ( err ) {
            console.error( "[Open] Failed to load file:", err );
            alert( "Failed to open file. Is it a valid project JSON?" );
        } finally {
            inputEl.value = "";                        // ← usa la referencia guardada
        }
    };

    const handleSaveClick = () => {
        const s = useAppStore.getState();
        const blob = new Blob( [ serializeProject( s ) ], {
            type: "application/json;charset=utf-8",
        } );
        downloadBlob( "project.json", blob );
        setSavedHash( getCurrentHash() );  // ← marcar como guardado
    };

    // dentro de FileToolbar (o donde tengas el import de UITDL):

    const handleImportUITDLFile: React.ChangeEventHandler<HTMLInputElement> = async ( e ) => {
        const inputEl = e.currentTarget;
        const f = inputEl.files?.[ 0 ];
        if ( !f ) return;

        try {
            const txt = await f.text();

            const base = useAppStore.getState();
            const projectJson = importUITDL( txt, base );

            // 👇 Import UITDL como una sola entrada de undo
            const { captureDelta } = useAppStore.getState();
            captureDelta( [ "nodes", "actions", "conditions", "edges" ], () => {
                applyLoadedProject( projectJson );

                const sAfter = useAppStore.getState();
                const parentsWithChildren = new Set<number>();
                for ( const n of sAfter.nodes ) {
                    if ( n.parentId != null ) {
                        sAfter.setParent( n.id, n.parentId );
                        parentsWithChildren.add( n.parentId );
                    }
                }
                parentsWithChildren.forEach( ( parentId ) => {
                    sAfter.relayoutAncestors( parentId );
                } );
            } );
            centerDiagramInView();
            setSavedHash( getCurrentHash() );
        } catch ( err ) {
            console.error( "[Import UITDL] Error:", err );
            alert( "Failed to import UITDL." );
        } finally {
            inputEl.value = "";
        }
    };

    const handleExportUITDL = () => {
        try {
            const s = useAppStore.getState();
            const txt = exportToUITDL( s, {
                title: "UITD Export",
                fragmentBaseName: "Fragment",
            } );
            const blob = new Blob( [ txt ], { type: "text/plain;charset=utf-8" } );
            downloadBlob( "diagram.uitd", blob );

        } catch ( err ) {
            console.error( "[Export UITDL] Error:", err );
            alert( "Failed to export UITDL." );
        }
    };

    useEffect( () => {
        if ( getSavedHash() == null ) {
            setSavedHash( getCurrentHash() );
        }
    }, [] );

    return (
        <div style={ { display: "flex", gap: 8 } }>
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

            {/* Import UITDL (en inglés) */ }
            <button
                type="button"
                onClick={ handleImportUITDLClick }
                title="Import UITDL"
                aria-label="Import UITDL"
                style={ { ...iconBtnStyle, border: "1px solid #64748b", background: "#eef2ff" } }
            >
                <IconBase>
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                </IconBase>
            </button>

            {/* Export UITDL (en inglés) */ }
            <button
                type="button"
                onClick={ handleExportUITDL }
                title="Export UITDL"
                aria-label="Export UITDL"
                style={ { ...iconBtnStyle, border: "1px solid #334155", background: "#f1f5f9" } }
            >
                <IconBase>
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                </IconBase>
            </button>
        </div>
    );
}

export default FileToolbar;
