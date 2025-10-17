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
import { MenuBusProvider } from "./menuBus";
import type { Edge, EdgeEndpoint } from "../../model/types";
import { NodeEditDialog } from "./NodeEditDialog";
import { WarningsPanel } from "./WarningsPanel";
import { HelpPanel } from "./HelpPanel";

export default function Canvas() {
    const hostRef = useRef<HTMLDivElement | null>( null );
    const svgRef = useRef<SVGSVGElement | null>( null );
    const gRef = useRef<SVGGElement | null>( null );

    const panzoom = useAppStore( ( s ) => s.panzoom );
    const viewBox = useAppStore( ( s ) => s.viewBox );

    const [ editNodeId, setEditNodeId ] = useState<number | null>( null );
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

    // --- Orquestación por niveles ---
    const nodes = useAppStore( s => s.nodes );
    const edges = useAppStore( s => s.edges );
    const actions = useAppStore( s => s.actions );
    const conditions = useAppStore( s => s.conditions );

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

    const levelOfEndpoint = ( ep: EdgeEndpoint ): number => {
        if ( ep.kind === "node" ) return levels.get( ep.id ) ?? 0;
        if ( ep.kind === "action" ) {
            const a = actions.find( x => x.id === ep.id );
            return a ? ( levels.get( a.originNodeId ) ?? 0 ) : 0;
        }
        const c = conditions.find( x => x.id === ep.id );
        if ( !c ) return 0;
        const a = actions.find( x => x.id === c.originActionId );
        return a ? ( levels.get( a.originNodeId ) ?? 0 ) : 0;
    };

    // Agrupar edges por "profundidad": max(level(from), level(to))
    const edgesByDepth: Map<number, Edge[]> = new Map();
    for ( let L = 0; L <= maxLevel; L++ ) edgesByDepth.set( L, [] );
    edges.forEach( e => {
        const d = Math.max( levelOfEndpoint( e.from ), levelOfEndpoint( e.to ) );
        edgesByDepth.get( d )!.push( e );
    } );

    // Nodos por nivel
    const nodesByLevel: Map<number, typeof nodes> = new Map();
    for ( let L = 0; L <= maxLevel; L++ ) {
        nodesByLevel.set( L, nodes.filter( n => ( levels.get( n.id ) ?? 0 ) === L ) );
    }

    const menuBusValue = {
        openNodeEditDialog: ( nodeId: number ) => {
            setEditNodeId( nodeId );
        },
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
        const onKeyDown = ( e: KeyboardEvent ) => {
            if ( e.key === "Control" || e.metaKey ) setCtrlDown( true );
        };
        const onKeyUp = ( e: KeyboardEvent ) => {
            if ( !e.ctrlKey && !e.metaKey ) setCtrlDown( false );
        };
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
            onContextMenu={ ( e ) => e.preventDefault() }
        >
            <WarningsPanel open={ diagOpen } onToggle={ () => setDiagOpen( v => !v ) } />
            <HelpPanel defaultOpen={ false } /> 
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
                    <g
                        ref={ gRef }
                        data-root="root"
                        transform={ `translate(${panzoom.x} ${panzoom.y}) scale(${panzoom.zoom})` }
                    >
                        {/* Por profundidad: primero edges (debajo), luego nodos del mismo nivel */ }
                        { Array.from( { length: maxLevel + 1 }, ( _, L ) => (
                            <g key={ `lvl-${L}` }>
                                <EdgesLayer edgesOverride={ edgesByDepth.get( L )! } />
                                <NodesLayer nodesOverride={ nodesByLevel.get( L )! } />
                            </g>
                        ) ) }

                        {/* Finalmente, óvalos arriba de las aristas */ }
                        <ActionsLayer />
                        {/* Marquee selection rectangle (no captura eventos) */ }
                        { marquee && marquee.w > 0 && marquee.h > 0 && (
                            <rect
                                x={ marquee.x }
                                y={ marquee.y }
                                width={ marquee.w }
                                height={ marquee.h }
                                fill="rgba(59,130,246,0.12)"         // azul translúcido
                                stroke="#3b82f6"
                                strokeWidth={ 1 }
                                strokeDasharray="4 3"
                                pointerEvents="none"
                            />
                        ) }
                    </g>
                </svg>

                { renderMenus( {
                    canvasMenu, nodeMenu, actionMenu, conditionMenu,
                    onCreateNode: () => createNodeFromCanvasMenu( canvasMenu.x, canvasMenu.y, clientToGroupPoint ),
                    setCanvasMenu, setNodeMenu, setActionMenu, setConditionMenu,
                    openNodeEditDialog: menuBusValue.openNodeEditDialog,
                } ) }
                <NodeEditDialog
                    open={ editNodeId != null }
                    nodeId={ editNodeId }
                    onClose={ () => setEditNodeId( null ) }
                />
            </MenuBusProvider>
        </div>
    );
}
