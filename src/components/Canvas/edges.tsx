// src/components/Canvas/edges.tsx

// Capa de aristas (presentacional)
// - Sin <defs> (vive en Canvas)
// - Sin constantes re-declaradas dentro del map
// - pointerEvents="none" para no bloquear clics

import { useAppStore } from "../../state/store";
import type { Edge } from "../../model/types";
import React from "react";

// Si prefieres, mueve estas a layout/constants.ts
const EDGE_STROKE_LIGHT = "#334155";
const EDGE_STROKE_DARK = "#e2e8f0";
const EDGE_DASH_SOLID = "";
const EDGE_DASH_1 = "4 4"; // action/condition â†’ node
const EDGE_DASH_2 = "2 2"; // action â†” condition

function edgeDash( style: Edge[ "style" ] ) {
    switch ( style ) {
        case "solid": return EDGE_DASH_SOLID;
        case "dashed1": return EDGE_DASH_1;
        case "dashed2": return EDGE_DASH_2;
        default: return EDGE_DASH_SOLID;
    }
}

function markerFor() {
    return "url(#edgeArrowMid)";
}

export function EdgesLayer(
    props: { edgesOverride?: Edge[]; level?: number } = {}
) {
    const { edgesOverride, level } = props;
    // âœ… cada selector devuelve una referencia estable si no cambia
    const nodes = useAppStore( s => s.nodes );
    const actions = useAppStore( s => s.actions );
    const conditions = useAppStore( s => s.conditions );
    const storeEdges = useAppStore( s => s.edges );
    const pending = useAppStore( s => s.pendingConnect );

    const edges = edgesOverride ?? storeEdges;
    const canvasDark = useAppStore( s => s.canvasDark );
    const edgeStroke = canvasDark ? EDGE_STROKE_DARK : EDGE_STROKE_LIGHT;

    const nodeById = React.useMemo( () => new Map( nodes.map( n => [ n.id, n ] ) ), [ nodes ] );
    const actionById = React.useMemo( () => new Map( actions.map( a => [ a.id, a ] ) ), [ actions ] );
    const condById = React.useMemo( () => new Map( conditions.map( c => [ c.id, c ] ) ), [ conditions ] );

    return (
        <g data-layer="edges"
            data-level={ level ?? null }
            id={ level != null ? `edges-L${level}` : undefined }>
            { edges.map( e => {
                let x1 = 0, y1 = 0, x2 = 0, y2 = 0;

                // FROM
                if ( e.from.kind === "node" ) {
                    const n = nodeById.get( e.from.id ); if ( !n ) return null;
                    x1 = n.x; y1 = n.y;
                } else if ( e.from.kind === "action" ) {
                    const a = actionById.get( e.from.id ); if ( !a ) return null;
                    x1 = a.x; y1 = a.y;
                } else {
                    const c = condById.get( e.from.id ); if ( !c ) return null;
                    x1 = c.x; y1 = c.y;
                }

                // TO
                if ( e.to.kind === "node" ) {
                    const n = nodeById.get( e.to.id ); if ( !n ) return null;
                    x2 = n.x; y2 = n.y;
                } else if ( e.to.kind === "action" ) {
                    const a = actionById.get( e.to.id ); if ( !a ) return null;
                    x2 = a.x; y2 = a.y;
                } else {
                    const c = condById.get( e.to.id ); if ( !c ) return null;
                    x2 = c.x; y2 = c.y;
                }

                const dash = edgeDash( e.style );
                const widthToNode = 4, widthFromNode = 2;
                const strokeWidth =
                    e.to.kind === "node" ? widthToNode :
                        e.from.kind === "node" ? widthFromNode : 1.5;

                // ... dentro del map(e) de EdgesLayer ...
                const dx = x2 - x1, dy = y2 - y1;
                const mx = x1 + dx / 2, my = y1 + dy / 2;

                return (
                    <g key={ e.id } data-edge-id={ e.id } pointerEvents="none">
                        <path
                            d={ `M ${x1} ${y1} L ${mx} ${my} L ${x2} ${y2}` }  // â† vÃ©rtice intermedio
                            fill="none"
                            stroke={ edgeStroke }
                            strokeWidth={ strokeWidth }
                            strokeDasharray={ dash }
                            markerMid={ markerFor() }                    // â† ahora sÃ­ aparece
                            pointerEvents="none"
                        />
                    </g>
                );
            } ) }

            {/* Rubber band */ }
            { pending && ( () => {
                const start = pending.mode === "action-to-target"
                    ? actionById.get( pending.fromActionId )
                    : condById.get( pending.fromConditionId );
                if ( !start ) return null;
                return (
                    <line
                        x1={ start.x } y1={ start.y }
                        x2={ pending.mouse.x } y2={ pending.mouse.y }
                        stroke={ edgeStroke }
                        strokeWidth={ 2 }
                        strokeDasharray={ EDGE_DASH_1 }
                        pointerEvents="none"
                    />
                );
            } )() }
        </g>
    );
}

