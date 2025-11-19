// src/components/Canvas/nodes.tsx
import React from "react";
import { useAppStore } from "../../state/store";
import { getNodeSizeCached } from "../../layout/measurement";
import { PAD_X, TITLE_LINE_H } from "../../model/types";
import { useMenuBus } from "./menuBus";
import type { NodeBox, NodeId } from "../../model/types";
import { markDraw } from "../../debug/markDraw";

function clientToRootGroupPoint( e: React.MouseEvent ) {
    const rootG = document.querySelector( 'g[data-root="root"]' ) as SVGGElement | null;
    const svg = ( e.currentTarget as SVGSVGElement ).ownerSVGElement || ( e.currentTarget as SVGElement );
    const svgEl = ( svg as SVGSVGElement ) ?? document.querySelector( "svg" );
    if ( !rootG || !svgEl ) return { x: e.clientX, y: e.clientY };
    const pt = svgEl.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    const ctm = rootG.getScreenCTM(); if ( !ctm ) return { x: e.clientX, y: e.clientY };
    const inv = ctm.inverse(); const p = pt.matrixTransform( inv ); return { x: p.x, y: p.y };
}

export function NodesLayer(
    { nodesOverride, level }: { nodesOverride?: NodeBox[]; level?: number } = {}
) {
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
        console.debug( "[rb] node mousedown", { nodeId: id, pending: useAppStore.getState().pendingConnect } );

        // Modo rubber band → commit inmediato
        if ( useAppStore.getState().pendingConnect ) {
            e.preventDefault();
            e.stopPropagation();
            commitTargetToNode( id as NodeId );
            return;
        }

        e.stopPropagation();
        if ( e.button !== 0 ) return;
        if ( pending ) { commitTargetToNode( id ); return; }

        const alreadySelected = useAppStore.getState().selection.has( id );

        if ( e.shiftKey ) {
            toggleSelect( id );
        } else if ( !alreadySelected ) {
            // Reemplaza selección sólo si el click cae sobre un nodo NO seleccionado
            selectSingleOrKeep( id, /*keep*/ false );
        }
        // Si ya estaba seleccionado y no hay shift: no tocamos la selección (preservamos acciones/conds)

        // Snapshot de la selección final para drag combinado
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

    // markDraw( `NodesLayer:render L${level ?? "-"}`, { nodes: nodes.length } );

    return (
        <g data-layer="nodes"
            data-level={ level ?? null }
            id={ level != null ? `nodes-L${level}` : undefined }>
            { nodes.map( ( n ) => {
                const m = getNodeSizeCached( n );
                const isSel = selection.has( n.id );
                const isDropTarget = hoverParent === n.id;

                const stroke = isDropTarget ? "#f97316" : ( n.colorStroke ?? "#94a3b8" );
                const strokeWidth = isDropTarget ? 6 : 4;
                const left = n.x - m.w / 2;
                const top = n.y - m.h / 2;
                const titleX = left + PAD_X;
                return (
                    <g
                        key={ n.id }
                        data-node-id={ n.id }                // ← útil para la tabla de DOM
                        style={ { cursor: "inherit" } }
                        onMouseDown={ ( e ) => onNodeMouseDown( e, n.id ) }
                        onDoubleClick={ ( e ) => onNodeDoubleClick( e, n.id ) }
                        onContextMenu={ ( e ) => onNodeContextMenu( e, n.id ) }
                    >
                        <rect
                            x={ left } y={ top }
                            width={ m.w } height={ m.h }
                            fill={ n.colorFill ?? "#f1f5f9" }
                            stroke={ stroke }
                            strokeWidth={ strokeWidth }
                            rx={ 4 } ry={ 4 }
                            pointerEvents="all"
                        />
                        { isSel && (
                            <rect
                                data-export="ignore"
                                x={ left - 4 }
                                y={ top - 4 }
                                width={ m.w + 8 }
                                height={ m.h + 8 }
                                rx={ 8 } ry={ 8 }
                                fill="none"
                                stroke="#0c03af"
                                strokeWidth={ 3 }
                                strokeDasharray="4 8"
                                pointerEvents="none"
                            />
                        ) }
                        <text
                            x={ left + 6 }
                            y={ top + 12 }
                            style={ { fontSize: 9, fill: "#64748b", userSelect: "none", pointerEvents: "auto" } }
                        >
                            #{ n.id }
                        </text>
                        <text
                            x={ titleX }
                            y={ top + 12 + 18 }
                            style={ { fontSize: 18, fill: n.colorText ?? "#334155", userSelect: "none", pointerEvents: "auto" } }
                        >
                            { m.lines.map( ( line, i ) => (
                                <tspan key={ i } x={ titleX } dy={ i === 0 ? 0 : TITLE_LINE_H }>
                                    { line }
                                </tspan>
                            ) ) }
                        </text>
                    </g>
                );
            } ) }
        </g>
    );
}
