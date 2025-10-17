import React from "react";
import { useAppStore } from "../../state/store";
import { getNodeSizeCached } from "../../layout/measurement";
import { PAD_X, TITLE_LINE_H } from "../../model/types";
import { useMenuBus } from "./menuBus";
import type { NodeBox } from "../../model/types";

function clientToRootGroupPoint( e: React.MouseEvent ) {
    const rootG = document.querySelector( 'g[data-root="root"]' ) as SVGGElement | null;
    const svg = ( e.currentTarget as SVGSVGElement ).ownerSVGElement || ( e.currentTarget as SVGElement );
    const svgEl = ( svg as SVGSVGElement ) ?? document.querySelector( "svg" );
    if ( !rootG || !svgEl ) return { x: e.clientX, y: e.clientY };
    const pt = svgEl.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    const ctm = rootG.getScreenCTM(); if ( !ctm ) return { x: e.clientX, y: e.clientY };
    const inv = ctm.inverse(); const p = pt.matrixTransform( inv ); return { x: p.x, y: p.y };
}

export function NodesLayer( { nodesOverride }: { nodesOverride?: NodeBox[] } = {} ) {
    const nodesAll = useAppStore( ( s ) => s.nodes );
    const nodes = nodesOverride ?? nodesAll;

    const selection = useAppStore( ( s ) => s.selection );
    const pending = useAppStore( ( s ) => s.pendingConnect );
    const commitTargetToNode = useAppStore( ( s ) => s.commitTargetToNode );

    const selectSingleOrKeep = useAppStore( ( s ) => s.selectSingleOrKeep );
    const toggleSelect = useAppStore( ( s ) => s.toggleSelect );
    const beginCombinedDrag = useAppStore( ( s ) => s.beginCombinedDrag );

    const hoverParent = useAppStore( ( s ) => s.dragHoverParent );

    const bus = useMenuBus();

    function onNodeMouseDown( e: React.MouseEvent, id: number ) {
        e.stopPropagation();
        if ( e.button !== 0 ) return;
        if ( pending ) { commitTargetToNode( id ); return; }

        if ( e.shiftKey ) toggleSelect( id );
        else selectSingleOrKeep( id, selection.has( id ) );

        const selNodes = new Set( useAppStore.getState().selection );
        if ( !selNodes.has( id ) ) selNodes.add( id );
        const selActions = new Set( useAppStore.getState().selectionActions );
        const selConds = new Set( useAppStore.getState().selectionConds );

        const anchor = clientToRootGroupPoint( e );
        beginCombinedDrag( anchor, selNodes, selActions, selConds );
    }

    function onNodeDoubleClick( e: React.MouseEvent, id: number ) {
        e.stopPropagation();
        bus.openNodeEditDialog( id );
    }

    function onNodeContextMenu( e: React.MouseEvent, id: number ) {
        e.preventDefault();
        e.stopPropagation();
        if ( !selection.has( id ) ) selectSingleOrKeep( id, false );
        bus.openNodeMenu( e.clientX, e.clientY, id );
    }

    return (
        <g data-layer="nodes">
            { nodes.map( ( n ) => {
                const m = getNodeSizeCached( n );
                const isSel = selection.has( n.id );
                const isDropTarget = hoverParent === n.id;

                const stroke = isDropTarget
                    ? "#f97316"
                    : ( n.colorStroke ?? "#94a3b8" );
                const strokeWidth = isDropTarget ? 3 : 1.5;
                const titleX = n.x + PAD_X;

                return (
                    <g
                        key={ n.id }
                        style={ { cursor: "inherit" } }
                        onMouseDown={ ( e ) => onNodeMouseDown( e, n.id ) }
                        onDoubleClick={ ( e ) => onNodeDoubleClick( e, n.id ) }
                        onContextMenu={ ( e ) => onNodeContextMenu( e, n.id ) }
                    >
                        <rect
                            x={ n.x } y={ n.y }
                            width={ m.w } height={ m.h }
                            fill={ n.colorFill ?? "#f1f5f9" }
                            stroke={ stroke }
                            strokeWidth={ strokeWidth }
                            rx={ 4 } ry={ 4 }
                        />
                        { isSel && (
                            <rect
                                x={ n.x - 3 }
                                y={ n.y - 3 }
                                width={ m.w + 6 }
                                height={ m.h + 6 }
                                rx={ 6 } ry={ 6 }
                                fill="none"
                                stroke="#9ca3af"          // gris neutro
                                strokeWidth={ 3 }
                                strokeDasharray="4 8"
                                pointerEvents="none"
                            />
                        ) }
                        <text
                            x={ n.x + 6 }
                            y={ n.y + 12 }
                            style={ { fontSize: 9, fill: "#64748b", userSelect: "none" } }
                        >
                            #{ n.id }
                        </text>
                        <text
                            x={ titleX }
                            y={ n.y + 12 + 18 }
                            style={ { fontSize: 18, fill: n.colorText ?? "#334155", userSelect: "none" } }
                        >
                            { m.lines.map( ( line, i ) => (
                                <tspan key={ i } x={ titleX } dy={ i === 0 ? 0 : TITLE_LINE_H }>{ line }</tspan>
                            ) ) }
                        </text>
                    </g>
                );
            } ) }
        </g>
    );
}
