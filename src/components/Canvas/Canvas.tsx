// src/components/Canvas/Canvas.tsx
import { useEffect, useRef, useState } from "react";
import { useAppStore } from "../../state/store";
import { EdgesLayer } from "./edges";
import { NodesLayer } from "./nodes";
import { ActionsLayer } from "./actions";
import { useCoordHelpers } from "./coord";
import { useBackgroundInteraction } from "./background";
import { useCombinedDragging } from "./dragging";
import { useContextMenus } from "./contextmenus";
import { useKeyboardShortcuts } from "./keyboard";
import { renderMenus } from "./renderMenus";
import type { Edge, EdgeEndpoint } from "../../model/types";
import { NodeEditDialog } from "./NodeEditDialog";
import { TopToolbar } from "./TopToolbar/index";
import { MenuBusProvider } from "./menuBus";
import { SelectionBboxOverlay } from "./SelectionBboxOverlay";
import { ActionEditDialog } from "./ActionEditDialog";
import { ConditionEditDialog } from "./ConditionEditDialog";
import { AlignmentGuidesOverlay } from "./AlignmentGuidesOverlay";

export default function Canvas() {
    const hostRef = useRef<HTMLDivElement | null>( null );
    const svgRef = useRef<SVGSVGElement | null>( null );
    const gRef = useRef<SVGGElement | null>( null );

    const panzoom = useAppStore( ( s ) => s.panzoom );
    const viewBox = useAppStore( ( s ) => s.viewBox );
    const canvasDark = useAppStore( ( s ) => s.canvasDark );

    const [ editNodeId, setEditNodeId ] = useState<number | null>( null );
    const [ editActionId, setEditActionId ] = useState<number | null>( null );
    const [ editConditionId, setEditConditionId ] = useState<number | null>( null );
    const [ diagOpen, setDiagOpen ] = useState( true );

    const {
        canvasMenu, nodeMenu, actionMenu, conditionMenu,
        setCanvasMenu, setNodeMenu, setActionMenu, setConditionMenu,
        setAllClosed, onContextMenuHost, createNodeFromCanvasMenu,
    } = useContextMenus();

    const { clientToGroupPoint } = useCoordHelpers( svgRef, gRef );
    const { onMouseMoveCombined, endCombined } = useCombinedDragging( { clientToGroupPoint } );
    const { onMouseDownBackground, onWheel, endPanDrag, onMouseMoveBackground, marquee } =
        useBackgroundInteraction( {
            svgRef, clientToGroupPoint, setCanvasMenu, setNodeMenu, setActionMenu, setAllClosed
        } );

    useKeyboardShortcuts( { setCanvasMenu, setNodeMenu, setActionMenu } );

    // --- Datos de store para orquestación ---
    const nodes = useAppStore( s => s.nodes );
    const edges = useAppStore( s => s.edges );
    const actions = useAppStore( s => s.actions );
    const conditions = useAppStore( s => s.conditions );

    // === Niveles por nodo ===
    function buildLevelsMap(): Map<number, number> {
        const levels = new Map<number, number>();
        const getLevel = ( id: number ): number => {
            if ( levels.has( id ) ) return levels.get( id )!;
            const self = nodes.find( n => n.id === id );
            const p = self?.parentId ?? null;
            const lv = p == null ? 0 : getLevel( p ) + 1;
            levels.set( id, lv );
            return lv;
        };
        nodes.forEach( n => getLevel( n.id ) );
        return levels;
    }

    const levels = buildLevelsMap();
    const maxLevel = Math.max( 0, ...Array.from( levels.values() ) );

    // === Nivel del *destino* de una arista ===
    const levelOfTarget = ( ep: EdgeEndpoint ): number => {
        if ( ep.kind === "node" ) return levels.get( ep.id ) ?? 0;
        if ( ep.kind === "action" ) {
            const a = actions.find( x => x.id === ep.id );
            return a ? ( levels.get( a.originNodeId ) ?? 0 ) : 0;
        }
        // ep.kind === "condition"
        const c = conditions.find( x => x.id === ep.id );
        if ( !c ) return 0;
        const a = actions.find( x => x.id === c.originActionId );
        return a ? ( levels.get( a.originNodeId ) ?? 0 ) : 0;
    };

    // === Partición de aristas ===
    const edgesToLevel: Map<number, Edge[]> = new Map();
    for ( let L = 0; L <= maxLevel; L++ ) edgesToLevel.set( L, [] );

    const acEdges: Edge[] = [];

    edges.forEach( e => {
        const isAC =
            ( e.from.kind === "action" && e.to.kind === "condition" ) ||
            ( e.from.kind === "condition" && e.to.kind === "action" );

        if ( isAC ) {
            acEdges.push( e );
            return;
        }

        const L = levelOfTarget( e.to );
        edgesToLevel.get( L )!.push( e );
    } );

    // === Nodos por nivel ===
    const nodesByLevel: Map<number, typeof nodes> = new Map();
    for ( let L = 0; L <= maxLevel; L++ ) {
        nodesByLevel.set( L, nodes.filter( n => ( levels.get( n.id ) ?? 0 ) === L ) );
    }

    const menuBusValue = {
        openNodeEditDialog: ( nodeId: number ) => { setEditNodeId( nodeId ); },
        openActionEditDialog: ( actionId: number ) => { setEditActionId( actionId ); },
        openConditionEditDialog: ( conditionId: number ) => { setEditConditionId( conditionId ); },

        openNodeMenu: ( x: number, y: number, nodeId: number ) => {
            setCanvasMenu( { open: false, x: 0, y: 0 } );
            setActionMenu( { open: false, x: 0, y: 0, id: null } );
            setConditionMenu( { open: false, x: 0, y: 0, id: null } );
            setNodeMenu( { open: true, x, y, id: nodeId } );
        },
        openActionMenu: ( x: number, y: number, actionId: number ) => {
            setCanvasMenu( { open: false, x: 0, y: 0 } );
            setNodeMenu( { open: false, x: 0, y: 0, id: null } );
            setConditionMenu( { open: false, x: 0, y: 0, id: null } );
            setActionMenu( { open: true, x, y, id: actionId } );
        },
        openConditionMenu: ( x: number, y: number, conditionId: number ) => {
            setCanvasMenu( { open: false, x: 0, y: 0 } );
            setNodeMenu( { open: false, x: 0, y: 0, id: null } );
            setActionMenu( { open: false, x: 0, y: 0, id: null } );
            setConditionMenu( { open: true, x, y, id: conditionId } );
        },
        closeAll: () => setAllClosed(),
    };

    const [ ctrlDown, setCtrlDown ] = useState( false );
    useEffect( () => {
        const onKeyDown = ( e: KeyboardEvent ) => { if ( e.key === "Control" || e.key === "Meta" ) setCtrlDown( true ); };
        const onKeyUp = ( e: KeyboardEvent ) => { setCtrlDown( e.ctrlKey || e.metaKey ); };
        const onBlur = () => setCtrlDown( false );
        window.addEventListener( "keydown", onKeyDown );
        window.addEventListener( "keyup", onKeyUp );
        window.addEventListener( "blur", onBlur );
        return () => {
            window.removeEventListener( "keydown", onKeyDown );
            window.removeEventListener( "keyup", onKeyUp );
            window.removeEventListener( "blur", onBlur );
        };
    }, [] );

    return (
        <div
            ref={ hostRef }
            className={ `canvas ${ctrlDown ? "is-grab-ready" : ""}` }
            style={ { position: "absolute", inset: 0, background: "transparent" } }
        >
            <TopToolbar svgRef={ svgRef } diagOpen={ diagOpen } onToggleDiag={ () => setDiagOpen( v => !v ) } />

            <MenuBusProvider value={ menuBusValue }>
                <svg
                    ref={ svgRef }
                    width="100%" height="100%"
                    viewBox={ `0 0 ${viewBox.w} ${viewBox.h}` }
                    preserveAspectRatio="xMidYMid meet"
                    onMouseDown={ onMouseDownBackground }
                    onMouseMove={ ( e ) => { onMouseMoveCombined( e ); onMouseMoveBackground( e ); } }
                    onMouseUp={ () => { endPanDrag(); endCombined(); } }
                    onMouseLeave={ () => { endPanDrag(); endCombined(); } }
                    onWheel={ onWheel }
                    onContextMenu={ onContextMenuHost }
                >
                    <defs>
                        <marker
                            id="edgeArrowMid"
                            viewBox="0 0 10 10"
                            refX="5" refY="4"
                            markerWidth="16" markerHeight="16"
                            orient="auto-start-reverse"
                            markerUnits="userSpaceOnUse"
                        >
                            <path
                                d="M 0 0 L 10 4 L 0 8 z"
                                stroke={ canvasDark ? "#e2e8f0" : "#000000" }
                                fill={ canvasDark ? "#0b1220" : "#ffffff" }
                            />
                        </marker>
                        <marker
                            id="edgeQuestionMid"
                            viewBox="0 0 24 24"
                            refX="10" refY="10"
                            markerWidth="40" markerHeight="40"
                            markerUnits="userSpaceOnUse"
                            orient="0"
                        >
                            <circle
                                cx="10"
                                cy="10"
                                r="8"
                                fill={ canvasDark ? "#7c2d12" : "#f59e0b" }
                                stroke={ canvasDark ? "#fde68a" : "#b45309" }
                                strokeWidth="1"
                            />
                            <text
                                x="10" y="10"
                                textAnchor="middle"
                                dominantBaseline="central"
                                fontSize="14"
                                fontFamily="choco cooky, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto"
                                fill={ canvasDark ? "#fde68a" : "#ffffff" }
                                style={ { paintOrder: "stroke" } }
                            >
                                ?
                            </text>
                        </marker>
                    </defs>

                    { canvasDark && (
                        <rect
                            data-export="ignore"
                            x={ 0 }
                            y={ 0 }
                            width={ viewBox.w }
                            height={ viewBox.h }
                            fill="#0b1220"
                            pointerEvents="none"
                        />
                    ) }

                    <g
                        ref={ gRef }
                        data-root="root"
                        transform={ `translate(${panzoom.x} ${panzoom.y}) scale(${panzoom.zoom})` }
                    >
                        { Array.from( { length: maxLevel + 1 }, ( _, L ) => (
                            <g key={ `lvl-${L}` } data-kind="level-wrapper" data-level={ L }>
                                <EdgesLayer level={ L } edgesOverride={ edgesToLevel.get( L )! } />
                                <NodesLayer level={ L } nodesOverride={ nodesByLevel.get( L )! } />
                            </g>
                        ) ) }

                        <EdgesLayer edgesOverride={ acEdges } />

                        <g data-layer="labels" id="labels">
                            <ActionsLayer />
                        </g>

                        { marquee && marquee.w > 0 && marquee.h > 0 && (
                            <rect
                                data-export="ignore"
                                x={ marquee.x }
                                y={ marquee.y }
                                width={ marquee.w }
                                height={ marquee.h }
                                fill="rgba(59,130,246,0.12)"
                                stroke="#3b82f6"
                                strokeWidth={ 1 }
                                strokeDasharray="4 3"
                                pointerEvents="none"
                            />
                        ) }

                        <AlignmentGuidesOverlay />
                        <SelectionBboxOverlay margin={ 20 } />
                    </g>
                </svg>

                { renderMenus( {
                    canvasMenu, nodeMenu, actionMenu, conditionMenu,
                    onCreateNode: () => createNodeFromCanvasMenu( canvasMenu.x, canvasMenu.y, clientToGroupPoint ),
                    setCanvasMenu, setNodeMenu, setActionMenu, setConditionMenu,
                    openNodeEditDialog: menuBusValue.openNodeEditDialog,
                    openActionEditDialog: menuBusValue.openActionEditDialog,
                } ) }

                <NodeEditDialog
                    open={ editNodeId != null }
                    nodeId={ editNodeId }
                    onClose={ () => setEditNodeId( null ) }
                />

                <ActionEditDialog
                    open={ editActionId != null }
                    actionId={ editActionId }
                    onClose={ () => setEditActionId( null ) }
                />

                <ConditionEditDialog
                    open={ editConditionId != null }
                    conditionId={ editConditionId }
                    onClose={ () => setEditConditionId( null ) }
                />

            </MenuBusProvider>
        </div>
    );
}
