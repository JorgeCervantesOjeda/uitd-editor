// src/components/Canvas/edges.tsx
// Capa de aristas: dibuja todas las líneas y el rubber-banding pendiente.
// Usa <marker> con markerMid para evitar renderizar arrays de elementos por arista.

import { useAppStore } from "../../state/store";
import type { Edge } from "../../model/types";
import { measureNodeSize } from "../../layout/measurement";

// Patrones de trazo
const DASH_SOLID = "";
const DASH_1 = "6 6";  // action/condition → node
const DASH_2 = "2 2";  // action → condition

const STROKE_COLOR = "#334155";
const STROKE_WIDTH = 1.5;

const ARROW_LEN = 8;   // largo de la flecha
const ARROW_HALF = 4;  // medio alto de la flecha

function edgeDash( style: Edge[ "style" ] ): string {
    switch ( style ) {
        case "solid": return DASH_SOLID;
        case "dashed1": return DASH_1;
        case "dashed2": return DASH_2;
        default: return DASH_SOLID;
    }
}

// Centros geométricos
function nodeCenter( n: { x: number; y: number; title: string; wrap?: number } ) {
    const m = measureNodeSize( n.title, n.wrap ?? 22 );
    return { cx: n.x + m.w / 2, cy: n.y + m.h / 2 };
}
function labelCenter( a: { x: number; y: number } ) {
    return { cx: a.x, cy: a.y };
}

export function EdgesLayer( props: { edgesOverride?: Edge[] } = {} ) {
    const nodes = useAppStore( ( s ) => s.nodes );
    const actions = useAppStore( ( s ) => s.actions );
    const conditions = useAppStore( ( s ) => s.conditions );
    const storeEdges = useAppStore( ( s ) => s.edges );
    const edges = props.edgesOverride ?? storeEdges;

    const pending = useAppStore( ( s ) => s.pendingConnect );

    return (
        <g data-layer="edges">
            {/* Definición de flecha (una sola vez por instancia del layer) */ }
            <defs>
                <marker
                    id="edgeArrowMid"
                    viewBox="0 0 10 10"
                    refX="5" refY="5"
                    markerWidth="8" markerHeight="8"
                    orient="auto-start-reverse"
                >
                    {/* Triángulo relleno */ }
                    <path d="M 0 0 L 10 5 L 0 10 z" fill={ STROKE_COLOR } />
                </marker>
            </defs>

            {/* Aristas existentes */ }
            { edges.map( ( e ) => {
                let x1 = 0, y1 = 0, x2 = 0, y2 = 0;

                // FROM
                if ( e.from.kind === "node" ) {
                    const n = nodes.find( ( n0 ) => n0.id === e.from.id );
                    if ( !n ) return null;
                    const c = nodeCenter( n );
                    x1 = c.cx; y1 = c.cy;
                } else if ( e.from.kind === "action" ) {
                    const a = actions.find( ( a0 ) => a0.id === e.from.id );
                    if ( !a ) return null;
                    const c = labelCenter( a );
                    x1 = c.cx; y1 = c.cy;
                } else {
                    const cnd = conditions.find( ( c0 ) => c0.id === e.from.id );
                    if ( !cnd ) return null;
                    const c = labelCenter( cnd );
                    x1 = c.cx; y1 = c.cy;
                }

                // TO
                if ( e.to.kind === "node" ) {
                    const n = nodes.find( ( n0 ) => n0.id === e.to.id );
                    if ( !n ) return null;
                    const c = nodeCenter( n );
                    x2 = c.cx; y2 = c.cy;
                } else if ( e.to.kind === "action" ) {
                    const a = actions.find( ( a0 ) => a0.id === e.to.id );
                    if ( !a ) return null;
                    const c = labelCenter( a );
                    x2 = c.cx; y2 = c.cy;
                } else {
                    const cnd = conditions.find( ( c0 ) => c0.id === e.to.id );
                    if ( !cnd ) return null;
                    const c = labelCenter( cnd );
                    x2 = c.cx; y2 = c.cy;
                }

                const dash = edgeDash( e.style );

                const mx = ( x1 + x2 ) / 2;
                const my = ( y1 + y2 ) / 2;
                const ang = Math.atan2( y2 - y1, x2 - x1 ) * 180 / Math.PI;

                return (
                    <g key={ `edge-${e.id}` }>
                        <line
                            x1={ x1 }
                            y1={ y1 }
                            x2={ x2 }
                            y2={ y2 }
                            stroke={ STROKE_COLOR }
                            strokeWidth={ STROKE_WIDTH }
                            strokeDasharray={ dash }
                        />
                        {/* flecha centrada, orientada de from → to */ }
                        <g transform={ `translate(${mx} ${my}) rotate(${ang})` }>
                            <path
                                d={ `M ${-ARROW_LEN},${-ARROW_HALF} L 0,0 L ${-ARROW_LEN},${ARROW_HALF} Z` }
                                fill={ STROKE_COLOR }
                                stroke="none"
                            />
                        </g>
                    </g>
                );
                  
            } ) }

            {/* Rubber-banding (pendiente) */ }
            { pending && ( () => {
                if ( pending.mode === "action-to-target" ) {
                    const a = actions.find( ( x ) => x.id === pending.fromActionId );
                    if ( !a ) return null;
                    const c = labelCenter( a );
                    return (
                        <line
                            key="pending-line"
                            x1={ c.cx } y1={ c.cy }
                            x2={ pending.mouse.x } y2={ pending.mouse.y }
                            stroke={ STROKE_COLOR }
                            strokeWidth={ STROKE_WIDTH }
                            strokeDasharray={ DASH_1 }
                            markerMid="url(#edgeArrowMid)"
                        />
                    );
                } else if ( pending.mode === "condition-to-target" ) {
                    const cnd = conditions.find( ( x ) => x.id === pending.fromConditionId );
                    if ( !cnd ) return null;
                    const c = labelCenter( cnd );
                    return (
                        <line
                            key="pending-line"
                            x1={ c.cx } y1={ c.cy }
                            x2={ pending.mouse.x } y2={ pending.mouse.y }
                            stroke={ STROKE_COLOR }
                            strokeWidth={ STROKE_WIDTH }
                            strokeDasharray={ DASH_1 }
                            markerMid="url(#edgeArrowMid)"
                        />
                    );
                }
                return null;
            } )() }
        </g>
    );
}
