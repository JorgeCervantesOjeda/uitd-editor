import React from "react";
import { useAppStore } from "../../state/store";
import { computeSelectedBBox, boundsToRectWithMargin } from "./selection-bbox";

type Props = { svgRef: React.RefObject<SVGSVGElement | null> };

const EXPORT_MARGIN = 20;

function buildCroppedSVGString(
    svg: SVGSVGElement,
    rect: { x: number; y: number; w: number; h: number }
): string {
    const clone = svg.cloneNode( true ) as SVGSVGElement;

    clone.setAttribute( "viewBox", `0 0 ${rect.w} ${rect.h}` );
    clone.setAttribute( "width", `${rect.w}` );
    clone.setAttribute( "height", `${rect.h}` );
    clone.setAttribute( "preserveAspectRatio", "xMinYMin meet" );
    clone.setAttribute( "overflow", "visible" );
    clone.removeAttribute( "style" );

    clone.querySelectorAll( '[data-debug="bbox-live"]' ).forEach( ( n ) => n.remove() );
    clone.querySelectorAll( '[data-export="ignore"]' ).forEach( ( n ) => n.remove() );

    const g = clone.querySelector( 'g[data-root="root"]' ) as SVGGElement | null;
    if ( g ) g.setAttribute( "transform", `translate(${-rect.x} ${-rect.y})` );

    const ns = "http://www.w3.org/2000/svg";
    const bg = clone.ownerDocument?.createElementNS( ns, "rect" );
    if ( bg ) {
        bg.setAttribute( "x", "0" );
        bg.setAttribute( "y", "0" );
        bg.setAttribute( "width", String( rect.w ) );
        bg.setAttribute( "height", String( rect.h ) );
        bg.setAttribute( "fill", "#ffffff" );
        clone.insertBefore( bg, clone.firstChild );
    }

    if ( !clone.getAttribute( "xmlns" ) ) clone.setAttribute( "xmlns", "http://www.w3.org/2000/svg" );
    if ( !clone.getAttribute( "xmlns:xlink" ) ) clone.setAttribute( "xmlns:xlink", "http://www.w3.org/1999/xlink" );

    const xml = new XMLSerializer().serializeToString( clone );
    return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n${xml}`;
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
    const nodes = useAppStore( ( s ) => s.nodes );
    const actions = useAppStore( ( s ) => s.actions );
    const conds = useAppStore( ( s ) => s.conditions );
    const selection = useAppStore( ( s ) => s.selection );
    const selectionActions = useAppStore( ( s ) => s.selectionActions );
    const selectionConds = useAppStore( ( s ) => s.selectionConds );

    const computeRect = React.useCallback( () => {
        const B = computeSelectedBBox( nodes, actions, conds, selection, selectionActions, selectionConds );
        if ( !B ) return null;
        return boundsToRectWithMargin( B, EXPORT_MARGIN );
    }, [ nodes, actions, conds, selection, selectionActions, selectionConds ] );

    const handleExportSVG = () => {
        const svg = svgRef.current;
        if ( !svg ) return;
        const R = computeRect();
        if ( !R ) return;
        const svgStr = buildCroppedSVGString( svg, R );
        const blob = new Blob( [ svgStr ], { type: "image/svg+xml;charset=utf-8" } );
        downloadBlob( "diagram.svg", blob );
    };

    const handleExportJPG = async () => {
        const svg = svgRef.current;
        if ( !svg ) return;
        const R = computeRect();
        if ( !R ) return;

        const svgStr = buildCroppedSVGString( svg, R );
        const blob = new Blob( [ svgStr ], { type: "image/svg+xml;charset=utf-8" } );
        const url = URL.createObjectURL( blob );

        const img = new Image();
        img.crossOrigin = "anonymous";

        try {
            await new Promise<void>( ( resolve, reject ) => {
                img.onload = () => resolve();
                img.onerror = ( e ) => reject( e );
                img.src = url;
            } );

            const canvas = document.createElement( "canvas" );
            canvas.width = Math.round( R.w );
            canvas.height = Math.round( R.h );
            const ctx = canvas.getContext( "2d" );
            if ( !ctx ) return;

            ctx.fillStyle = "#ffffff";
            ctx.fillRect( 0, 0, canvas.width, canvas.height );
            ctx.drawImage( img, 0, 0, canvas.width, canvas.height );

            canvas.toBlob( ( out ) => {
                if ( out ) downloadBlob( "diagram.jpg", out );
            }, "image/jpeg", 0.95 );
        } finally {
            URL.revokeObjectURL( url );
        }
    };

    // Botón de menú (ocupa ancho, icono + texto, columna en contenedor)
    const btnStyle: React.CSSProperties = {
        padding: "6px 10px",
        border: "1px solid #cbd5e1",
        borderRadius: 8,
        background: "#fff",
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "flex-start",
        gap: 8,
        height: 34,
        color: "#374151",
        width: "100px",        // ← ocupa todo el ancho del submenú
        textAlign: "left",
    };

    return (
        // ← contenedor en COLUMNA
        <div style={ { display: "flex", flexDirection: "column", gap: 8, minWidth: 100 } }>
            <button
                onClick={ handleExportSVG }
                title="Export SVG (selection)"
                aria-label="Export SVG"
                style={ btnStyle }
            >
                <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <path d="M14 2v6h6" />
                    <polyline points="10 14 8 16 10 18" />
                    <polyline points="14 14 16 16 14 18" />
                    <line x1="12" y1="14" x2="12" y2="18" />
                </svg>
                <span>SVG</span>
            </button>

            <button
                onClick={ handleExportJPG }
                title="Export JPG (selection)"
                aria-label="Export JPG"
                style={ btnStyle }
            >
                <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                >
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <path d="M21 15l-5-5L5 21" />
                </svg>
                <span>JPG</span>
            </button>
        </div>
    );
}

export default ExportToolbar;
