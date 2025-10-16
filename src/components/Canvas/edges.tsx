import { useAppStore } from "../../state/store";
import type { Edge } from "../../model/types";
import { getNodeSizeCached } from "../../layout/measurement";

// Patrones de trazo
const DASH_SOLID = "";
const DASH_1 = "6 6";  // action/condition → node
const DASH_2 = "4 8";  // action → condition

const STROKE_COLOR = "#334155";
const STROKE_WIDTH = 1.5;

function edgeDash( style: Edge[ "style" ] ): string {
    switch ( style ) {
        case "solid": return DASH_SOLID;
        case "dashed1": return DASH_1;
        case "dashed2": return DASH_2;
        default: return DASH_SOLID;
    }
}

function nodeCenter( n: { x: number; y: number; title: string; wrap?: number; w?: number; h?: number } ) {
    const m = getNodeSizeCached( n as any );
    return { cx: n.x + m.w / 2, cy: n.y + m.h / 2 };
}
function labelCenter( a: { x: number; y: number } ) { return { cx: a.x, cy: a.y }; }

export function EdgesLayer( { edgesOverride }: { edgesOverride?: Edge[] } = {} ) {
    const nodes = useAppStore( ( s ) => s.nodes );
    const actions = useAppStore( ( s ) => s.actions );
    const conditions = useAppStore( ( s ) => s.conditions );
    const edgesAll = useAppStore( ( s ) => s.edges );
    const edges = edgesOverride ?? edgesAll;

    const pending = useAppStore( ( s ) => s.pendingConnect );

    return (
        <g data-layer="edges">
            {/* Aristas existentes */ }
            { edges.map( ( e ) => {
                let x1 = 0, y1 = 0, x2 = 0, y2 = 0;
                if ( e.from.kind === "node" ) {
                    const n = nodes.find( ( n0 ) => n0.id === e.from.id ); if ( !n ) return null;
                    const c = nodeCenter( n ); x1 = c.cx; y1 = c.cy;
                } else if ( e.from.kind === "action" ) {
                    const a = actions.find( ( a0 ) => a0.id === e.from.id ); if ( !a ) return null;
                    const c = labelCenter( a ); x1 = c.cx; y1 = c.cy;
                } else {
                    const cnd = conditions.find( ( c0 ) => c0.id === e.from.id ); if ( !cnd ) return null;
                    const c = labelCenter( cnd ); x1 = c.cx; y1 = c.cy;
                }
                if ( e.to.kind === "node" ) {
                    const n = nodes.find( ( n0 ) => n0.id === e.to.id ); if ( !n ) return null;
                    const c = nodeCenter( n ); x2 = c.cx; y2 = c.cy;
                } else if ( e.to.kind === "action" ) {
                    const a = actions.find( ( a0 ) => a0.id === e.to.id ); if ( !a ) return null;
                    const c = labelCenter( a ); x2 = c.cx; y2 = c.cy;
                } else {
                    const cnd = conditions.find( ( c0 ) => c0.id === e.to.id ); if ( !cnd ) return null;
                    const c = labelCenter( cnd ); x2 = c.cx; y2 = c.cy;
                }
                const dash = edgeDash( e.style );
                return (
                    <line
                        key={ e.id }
                        x1={ x1 } y1={ y1 } x2={ x2 } y2={ y2 }
                        stroke={ STROKE_COLOR } strokeWidth={ STROKE_WIDTH }
                        strokeDasharray={ dash }
                    />
                );
            } ) }

            {/* Rubber-banding */ }
            { pending && ( () => {
                if ( pending.mode === "action-to-target" ) {
                    const a = actions.find( ( x ) => x.id === pending.fromActionId );
                    if ( !a ) return null;
                    const c = labelCenter( a );
                    return (
                        <line
                            x1={ c.cx } y1={ c.cy } x2={ pending.mouse.x } y2={ pending.mouse.y }
                            stroke={ STROKE_COLOR } strokeWidth={ STROKE_WIDTH } strokeDasharray={ DASH_1 }
                        />
                    );
                } else if ( pending.mode === "condition-to-target" ) {
                    const cnd = conditions.find( ( x ) => x.id === pending.fromConditionId );
                    if ( !cnd ) return null;
                    const c = labelCenter( cnd );
                    return (
                        <line
                            x1={ c.cx } y1={ c.cy } x2={ pending.mouse.x } y2={ pending.mouse.y }
                            stroke={ STROKE_COLOR } strokeWidth={ STROKE_WIDTH } strokeDasharray={ DASH_1 }
                        />
                    );
                }
                return null;
            } )() }
        </g>
    );
}
