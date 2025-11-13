// src/components/Canvas/FileToolbar.tsx
import React, { useRef } from "react";
import { useAppStore } from "../../state/store";
import {
    makeProjectSnapshot,
    validateProjectData,
    computeNextCounters,
    type ProjectData,
} from "../../io/serialization";
import { Package, PackageOpen } from "lucide-react";

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
                onClick={ onOpenClick }
                title="Open project (JSON)"
                aria-label="Open project (JSON)"
                style={ {
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
                    background: "#fff",
                    boxShadow: "0 2px 10px rgba(2,6,23,.1)",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    color: "#374151",
                } }
            >
                {/* Carpeta con flecha hacia arriba (abrir) */ }
                <PackageOpen
                    size={ 18 }
                    strokeWidth={ 2 }
                    aria-hidden="true"
                />
                <span>Open</span>
            </button>

            <input
                ref={ fileInputRef }
                type="file"
                accept="application/json,.json"
                style={ { display: "none" } }
                onChange={ onFilePicked }
            />

            <button
                onClick={ onSave }
                title="Save project (JSON)"
                aria-label="Save project (JSON)"
                style={ {
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
                    background: "#fff",
                    boxShadow: "0 2px 10px rgba(2,6,23,.1)",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    color: "#374151",
                } }
            >
                {/* Carpeta con flecha hacia abajo (guardar) */ }
                <Package
                    size={ 18 }
                    strokeWidth={ 2 }
                    aria-hidden="true"
                />
                <span>Save</span>
            </button>

        </div>
    );
}
