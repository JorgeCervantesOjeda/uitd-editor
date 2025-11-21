// src/components/Canvas/FileToolbar.tsx
import React from "react";
import { useAppStore } from "../../state/store";
import type { AppState } from "../../state/types";
import { importUitdToProject } from "../../io/uitdl/import";

/** Descarga un blob con nombre dado */
function downloadBlob( data: BlobPart, filename: string, mime = "application/octet-stream" ) {
    const blob = new Blob( [ data ], { type: mime } );
    const url = URL.createObjectURL( blob );
    const a = document.createElement( "a" );
    a.href = url;
    a.download = filename;
    document.body.appendChild( a );
    a.click();
    a.remove();
    URL.revokeObjectURL( url );
}

/** Extrae el “modelo de proyecto” que ya guardas en persist (sin estado efímero) */
function extractProjectSnapshot( s: AppState ) {
    return {
        // Proyecto (modelo)
        nodes: s.nodes,
        actions: s.actions,
        conditions: s.conditions,
        edges: s.edges,

        // Contadores
        nextId: s.nextId,
        nextActionId: s.nextActionId,
        nextEdgeId: s.nextEdgeId,

        // (Opcionalmente puedes incluir vista si te sirve)
        // panzoom: s.panzoom,
        // viewBox: s.viewBox,
    };
}

export function FileToolbar() {
    const setState = useAppStore.setState;
    const getState = useAppStore.getState;

    // ====== Abrir JSON (.json) ======
    const onOpenJson: React.ChangeEventHandler<HTMLInputElement> = async ( e ) => {
        const f = e.target.files?.[ 0 ];
        if ( !f ) return;
        try {
            const txt = await f.text();
            const data = JSON.parse( txt );

            // Validación ligera y fallback de campos
            const nodes = Array.isArray( data.nodes ) ? data.nodes : [];
            const actions = Array.isArray( data.actions ) ? data.actions : [];
            const conditions = Array.isArray( data.conditions ) ? data.conditions : [];
            const edges = Array.isArray( data.edges ) ? data.edges : [];

            const nextId = Number.isFinite( data.nextId ) ? data.nextId : ( nodes.length ? Math.max( ...nodes.map( ( n: any ) => n.id ) ) + 1 : 1 );
            const nextActionId = Number.isFinite( data.nextActionId ) ? data.nextActionId : ( actions.length ? Math.max( ...actions.map( ( a: any ) => a.id ) ) + 1 : 1 );
            const nextEdgeId = Number.isFinite( data.nextEdgeId ) ? data.nextEdgeId : ( edges.length ? Math.max( ...edges.map( ( ed: any ) => ed.id ) ) + 1 : 1 );

            setState( ( s ) => ( {
                nodes,
                actions,
                conditions,
                edges,
                nextId,
                nextActionId,
                nextEdgeId,

                // Limpia estado efímero
                selection: new Set(),
                selectionActions: new Set(),
                selectionConds: new Set(),
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
        } catch ( err ) {
            console.error( "[Open JSON] error:", err );
            alert( "No se pudo abrir el JSON. Revisa el formato." );
        } finally {
            e.currentTarget.value = "";
        }
    };

    // ====== Guardar JSON ======
    const onSaveJson = () => {
        const snap = extractProjectSnapshot( getState() );
        const pretty = JSON.stringify( snap, null, 2 );
        downloadBlob( pretty, "uitd-project.json", "application/json" );
    };

    // ====== Importar UITDL (.uitd | .txt) ======
    const onImportUITD: React.ChangeEventHandler<HTMLInputElement> = async ( e ) => {
        const f = e.target.files?.[ 0 ];
        if ( !f ) return;
        try {
            const text = await f.text();
            const proj = importUitdToProject( text );

            setState( () => ( {
                nodes: proj.nodes,
                actions: proj.actions,
                conditions: proj.conditions,
                edges: proj.edges,
                nextId: proj.nextId,
                nextActionId: proj.nextActionId,
                nextEdgeId: proj.nextEdgeId,

                // Limpia estado efímero
                selection: new Set(),
                selectionActions: new Set(),
                selectionConds: new Set(),
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
        } catch ( err ) {
            console.error( "[UITDL import] error:", err );
            alert( `Error al importar UITDL:\n${( err as Error ).message}` );
        } finally {
            e.currentTarget.value = "";
        }
    };

    return (
        <div style={ { display: "flex", gap: 8 } }>
            {/* Abrir JSON */ }
            <label
                style={ {
                    border: "1px solid #94a3b8",
                    padding: 6,
                    borderRadius: 6,
                    cursor: "pointer",
                    background: "#f8fafc",
                    userSelect: "none",
                } }
            >
                Abrir JSON
                <input type="file" accept=".json,application/json" onChange={ onOpenJson } style={ { display: "none" } } />
            </label>

            {/* Guardar JSON */ }
            <button
                type="button"
                onClick={ onSaveJson }
                title="Guardar proyecto como JSON"
                aria-label="Guardar proyecto como JSON"
                style={ {
                    padding: 6,
                    borderRadius: 6,
                    border: "1px solid #94a3b8",
                    background: "#f8fafc",
                    color: "#0f172a",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                } }
            >
                Guardar JSON
            </button>

            {/* Importar UITDL */ }
            <label
                style={ {
                    border: "1px solid #94a3b8",
                    padding: 6,
                    borderRadius: 6,
                    cursor: "pointer",
                    background: "#eef2ff",
                    userSelect: "none",
                } }
                title="Importar archivo .uitd y convertirlo a proyecto"
            >
                Importar UITDL
                <input type="file" accept=".uitd,.txt" onChange={ onImportUITD } style={ { display: "none" } } />
            </label>
        </div>
    );
}

export default FileToolbar;
