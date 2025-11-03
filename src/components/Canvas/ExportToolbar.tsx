// src/components/Canvas/ExportToolbar.tsx
import React from "react";
import { useAppStore } from "../../state/store";
import type { NodeBox, ActionLabel, ConditionLabel, Edge } from "../../model/types";
import { getNodeSizeCached, measureActionOval } from "../../layout/measurement";

type Props = {
    svgRef: React.RefObject<SVGSVGElement | null>;
};

type Bounds = { minX: number; minY: number; maxX: number; maxY: number };

const MARGIN = 20; // margen solicitado

function expandBounds( b: Bounds, x: number, y: number ) {
    if ( x < b.minX ) b.minX = x;
    if ( y < b.minY ) b.minY = y;
    if ( x > b.maxX ) b.maxX = x;
    if ( y > b.maxY ) b.maxY = y;
}

function computeDiagramBounds(
    nodes: NodeBox[],
    actions: ActionLabel[],
    conditions: ConditionLabel[],
    edges: Edge[]
): Bounds | null {
    if ( nodes.length === 0 && actions.length === 0 && conditions.length === 0 && edges.length === 0 ) {
        return null;
    }

    const b: Bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };

    // NODES: rectángulos (x, y) con w,h cacheables
    for ( const n of nodes ) {
        const m = getNodeSizeCached( n );
        expandBounds( b, n.x, n.y );
        expandBounds( b, n.x + m.w, n.y + m.h );
    }

    // ACTIONS: óvalo centrado (x,y), usar rx, ry
    for ( const a of actions ) {
        const m = measureActionOval( a.title, a.wrap ?? 22 );
        const rx = m.w / 2, ry = m.h / 2;
        expandBounds( b, a.x - rx, a.y - ry );
        expandBounds( b, a.x + rx, a.y + ry );
    }

    // CONDITIONS: también óvalo (mismo cálculo)
    for ( const c of conditions ) {
        const m = measureActionOval( c.title, c.wrap ?? 22 );
        const rx = m.w / 2, ry = m.h / 2;
        expandBounds( b, c.x - rx, c.y - ry );
        expandBounds( b, c.x + rx, c.y + ry );
    }

    // EDGES: considerar los extremos (from/to) por si sobresalen
    const resolvePoint = ( ep: Edge[ "from" ] ): { x: number; y: number } | null => {
        if ( ep.kind === "node" ) {
            const n = nodes.find( nn => nn.id === ep.id );
            if ( !n ) return null;
            const m = getNodeSizeCached( n );
            return { x: n.x + m.w / 2, y: n.y + m.h / 2 };
        }
        if ( ep.kind === "action" ) {
            const a = actions.find( aa => aa.id === ep.id );
            return a ? { x: a.x, y: a.y } : null;
        }
        const c = conditions.find( cc => cc.id === ep.id );
        return c ? { x: c.x, y: c.y } : null;
    };

    for ( const e of edges ) {
        const p1 = resolvePoint( e.from );
        const p2 = resolvePoint( e.to );
        if ( p1 ) { expandBounds( b, p1.x, p1.y ); }
        if ( p2 ) { expandBounds( b, p2.x, p2.y ); }
    }

    // si nunca expandimos (sólo edges inválidas), devolver null
    if ( !isFinite( b.minX ) || !isFinite( b.minY ) || !isFinite( b.maxX ) || !isFinite( b.maxY ) ) return null;
    return b;
}

function buildCroppedSVGString( svg: SVGSVGElement, bounds: Bounds, margin: number ): string {
    // Clonar el SVG actual
    const clone = svg.cloneNode( true ) as SVGSVGElement;

    // Quitar listeners/event attrs comunes en el clon (opcional)
    clone.removeAttribute( "style" );
    clone.setAttribute( "width", String( ( bounds.maxX - bounds.minX ) + 2 * margin ) );
    clone.setAttribute( "height", String( ( bounds.maxY - bounds.minY ) + 2 * margin ) );
    clone.setAttribute( "viewBox", `0 0 ${( bounds.maxX - bounds.minX ) + 2 * margin} ${( bounds.maxY - bounds.minY ) + 2 * margin}` );

    // Forzar fondo blanco para JPG/PNG (no afecta a SVG si quieres quitarlo)
    // Insertamos un rect de fondo al inicio
    const bg = clone.ownerDocument?.createElementNS( "http://www.w3.org/2000/svg", "rect" );
    bg.setAttribute( "x", "0" );
    bg.setAttribute( "y", "0" );
    bg.setAttribute( "width", "100%" );
    bg.setAttribute( "height", "100%" );
    bg.setAttribute( "fill", "#ffffff" );
    clone.insertBefore( bg, clone.firstChild );

    // Encontrar el <g data-root="root"> y neutralizar pan/zoom
    const rootG = clone.querySelector( 'g[data-root="root"]' ) as SVGGElement | null;
    if ( rootG ) {
        // Queremos que todo se traslade para que bounds.minX/minY queden a `margin`
        // Y quitamos el scale/pan que existía.
        rootG.setAttribute( "transform", `translate(${margin - bounds.minX} ${margin - bounds.minY}) scale(1)` );
    }

    // Serializar
    const xml = new XMLSerializer().serializeToString( clone );
    // Asegurar namespace
    const svgHeader = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>`;
    return `${svgHeader}\n${xml}`;
}

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

export function ExportToolbar( { svgRef }: Props ) {
    const nodes = useAppStore( s => s.nodes );
    const actions = useAppStore( s => s.actions );
    const conditions = useAppStore( s => s.conditions );
    const edges = useAppStore( s => s.edges );

    const handleExportSVG = () => {
        const svg = svgRef.current;
        if ( !svg ) return;
        const b = computeDiagramBounds( nodes, actions, conditions, edges );
        if ( !b ) return;

        const svgStr = buildCroppedSVGString( svg, b, MARGIN );
        const blob = new Blob( [ svgStr ], { type: "image/svg+xml;charset=utf-8" } );
        downloadBlob( "diagram.svg", blob );
    };

    const handleExportJPG = async () => {
        const svg = svgRef.current;
        if ( !svg ) return;
        const b = computeDiagramBounds( nodes, actions, conditions, edges );
        if ( !b ) return;

        const svgStr = buildCroppedSVGString( svg, b, MARGIN );
        const blob = new Blob( [ svgStr ], { type: "image/svg+xml;charset=utf-8" } );
        const url = URL.createObjectURL( blob );

        // Crear imagen a partir del SVG
        const img = new Image();
        // Importante para que cargue correctamente los recursos embebidos
        img.crossOrigin = "anonymous";
        const width = ( b.maxX - b.minX ) + 2 * MARGIN;
        const height = ( b.maxY - b.minY ) + 2 * MARGIN;

        await new Promise<void>( ( resolve, reject ) => {
            img.onload = () => resolve();
            img.onerror = ( e ) => reject( e );
            img.src = url;
        } );

        // Rasterizar en canvas
        const canvas = document.createElement( "canvas" );
        canvas.width = Math.ceil( width );
        canvas.height = Math.ceil( height );
        const ctx = canvas.getContext( "2d" );
        if ( !ctx ) return;

        // Fondo blanco (por si el SVG era transparente)
        ctx.fillStyle = "#ffffff";
        ctx.fillRect( 0, 0, canvas.width, canvas.height );

        ctx.drawImage( img, 0, 0 );
        URL.revokeObjectURL( url );

        // Exportar a JPG
        canvas.toBlob( ( out ) => {
            if ( out ) downloadBlob( "diagram.jpg", out );
        }, "image/jpeg", 0.95 );
    };

    return (
        <div style={ { display: "flex", gap: 8 } }>
            <button
                onClick={ handleExportSVG }
                title="Export as SVG"
                aria-label="Export as SVG"
                style={ {
                    padding: 6,
                    border: "1px solid #cbd5e1",
                    borderRadius: 8,
                    background: "#fff",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 34,
                    height: 34,
                    color: "#374151",
                } }
            >
                {/* Icono: file-type SVG (documento con <> ) */ }
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <path d="M14 2v6h6" />
                    <polyline points="10 14 8 16 10 18" />
                    <polyline points="14 14 16 16 14 18" />
                    <line x1="12" y1="14" x2="12" y2="18" />
                </svg>
            </button>

            <button
                onClick={ handleExportJPG }
                title="Export as JPG"
                aria-label="Export as JPG"
                style={ {
                    padding: 6,
                    border: "1px solid #cbd5e1",
                    borderRadius: 8,
                    background: "#fff",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 34,
                    height: 34,
                    color: "#374151",
                } }
            >
                {/* Icono: image */ }
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <path d="M21 15l-5-5L5 21" />
                </svg>
            </button>
        </div>
    );      
}
