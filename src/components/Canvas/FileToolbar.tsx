// src/components/Canvas/FileToolbar.tsx
import React, { useRef } from "react";
import { useAppStore } from "../../state/store";
import {
    makeProjectSnapshot,
    validateProjectData,
    computeNextCounters,
    type ProjectData,
} from "../../io/serialization";

export function FileToolbar() {
    const fileInputRef = useRef<HTMLInputElement | null>( null );

    function onSave() {
        const s = useAppStore.getState();
        const data = makeProjectSnapshot( s );
        const blob = new Blob( [ JSON.stringify( data, null, 2 ) ], { type: "application/json" } );
        const url = URL.createObjectURL( blob );
        const a = document.createElement( "a" );
        const ts = new Date();
        const pad = ( n: number ) => n.toString().padStart( 2, "0" );
        const name = `uitd-project-${ts.getFullYear()}${pad( ts.getMonth() + 1 )}${pad( ts.getDate() )}-${pad( ts.getHours() )}${pad( ts.getMinutes() )}${pad( ts.getSeconds() )}.json`;
        a.href = url;
        a.download = name;
        document.body.appendChild( a );
        a.click();
        a.remove();
        URL.revokeObjectURL( url );
    }

    function onOpenClick() {
        fileInputRef.current?.click();
    }

    async function onFilePicked( e: React.ChangeEvent<HTMLInputElement> ) {
        const f = e.target.files?.[ 0 ];
        if ( !f ) return;
        try {
            const text = await f.text();
            const raw = JSON.parse( text );
            const data: ProjectData = validateProjectData( raw );
            const { nextId, nextActionId, nextEdgeId } = computeNextCounters( data );

            useAppStore.setState( {
                nodes: data.nodes,
                actions: data.actions,
                conditions: data.conditions,
                edges: data.edges,
                panzoom: data.panzoom ?? useAppStore.getState().panzoom,
                viewBox: data.viewBox ?? useAppStore.getState().viewBox,
                nextId,
                nextActionId,
                nextEdgeId,
                selection: new Set<number>(),
                selectionActions: new Set<number>(),
                selectionConds: new Set<number>(),
            } );
        } catch ( err: unknown ) {
            const msg = err instanceof Error ? err.message : String( err );
            alert( `Failed to open project: ${msg}` );
        } finally {
            if ( fileInputRef.current ) fileInputRef.current.value = "";
        }
    }

    // ⬇️ Estilos en línea, sin posición fija; listo para usar dentro de TopToolbar
    return (
        <div style={ { display: "flex", gap: 8 } }>
            <button
                onClick={ onSave }
                title="Save project (JSON)"
                aria-label="Save project (JSON)"
                style={ {
                    padding: 6,
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
                    background: "#fff",
                    boxShadow: "0 2px 10px rgba(2,6,23,.1)",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 34,
                    height: 34,
                    color: "#374151",
                } }
            >
                {/* Icono: floppy (save) */ }
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M17 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7z" />
                    <path d="M7 3v6h8V3" />
                    <rect x="7" y="13" width="10" height="6" rx="1" />
                </svg>
            </button>

            <button
                onClick={ onOpenClick }
                title="Open project (JSON)"
                aria-label="Open project (JSON)"
                style={ {
                    padding: 6,
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
                    background: "#fff",
                    boxShadow: "0 2px 10px rgba(2,6,23,.1)",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 34,
                    height: 34,
                    color: "#374151",
                } }
            >
                {/* Icono: folder-open */ }
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M3 7h5l2 2h11v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    <path d="M3 7V5a2 2 0 0 1 2-2h3l2 2h3" />
                </svg>
            </button>

            <input
                ref={ fileInputRef }
                type="file"
                accept="application/json,.json"
                style={ { display: "none" } }
                onChange={ onFilePicked }
            />
        </div>
    );
}
