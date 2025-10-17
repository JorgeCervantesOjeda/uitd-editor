// src/components/Canvas/FileToolbar.tsx
import React, { useRef } from "react";
import { useAppStore } from "../../state/store";
import { makeProjectSnapshot, validateProjectData, computeNextCounters, type ProjectData } from "../../io/serialization";

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

            // aplica al store
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

        } catch ( err: any ) {
            alert( `Failed to open project: ${err?.message ?? String( err )}` );
        } finally {
            // permite volver a seleccionar el mismo archivo
            if ( fileInputRef.current ) fileInputRef.current.value = "";
        }
    }

    return (
        <div
            style={ {
                position: "fixed",
                left: 12,
                top: 12,
                zIndex: 5,
                display: "flex",
                gap: 8,
                pointerEvents: "none",
            } }
        >
            <button
                style={ {
                    pointerEvents: "auto",
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
                    background: "#fff",
                    boxShadow: "0 4px 16px rgba(2,6,23,.12)",
                    cursor: "pointer",
                    fontWeight: 600,
                } }
                onClick={ onSave }
                title="Download current diagram as JSON"
            >
                Save
            </button>

            <button
                style={ {
                    pointerEvents: "auto",
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
                    background: "#fff",
                    boxShadow: "0 4px 16px rgba(2,6,23,.12)",
                    cursor: "pointer",
                    fontWeight: 600,
                } }
                onClick={ onOpenClick }
                title="Load a JSON diagram file"
            >
                Open…
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
