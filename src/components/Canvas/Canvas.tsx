// src/components/Canvas/Canvas.tsx
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useAppStore } from "../../state/store";
import { EdgesLayer } from "./edges";
import { NodesLayer } from "./nodes";
import { ActionsLayer } from "./actions";
import { useCoordHelpers } from "./coord";
import { useBackgroundInteraction } from "./background";
import { useCombinedDragging } from "./dragging";
import { useContextMenus } from "./contextmenus";
import { useKeyboardShortcuts } from "./keyboard";
import { RenderMenus } from "./renderMenus";
import type { Edge, EdgeEndpoint } from "../../model/types";
import { NodeEditDialog } from "./NodeEditDialog";
import { TopToolbar } from "./TopToolbar/index";
import { MenuBusProvider } from "./menuBus";
import { SelectionBboxOverlay } from "./SelectionBboxOverlay";
import { ActionEditDialog } from "./ActionEditDialog";
import { ConditionEditDialog } from "./ConditionEditDialog";
import { AlignmentGuidesOverlay } from "./AlignmentGuidesOverlay";
import { FragmentFramesLayer } from "./FragmentFramesLayer";
import { ZoomSlider } from "../ZoomSlider";
import { MAX_CANVAS_ZOOM, MIN_CANVAS_ZOOM } from "../../state/slices/camera.slice";

const CANVAS_FIT_PADDING_PX = 16;
const CANVAS_FIT_PERCENT = 100;
const CANVAS_FIT_EPSILON = 0.005;

type CanvasFitResult = {
    fitZoom: number;
    panzoom: { x: number; y: number; zoom: number };
};

function clientPointInElement(
    element: SVGGraphicsElement,
    clientX: number,
    clientY: number
): { x: number; y: number } | null {
    const svg = element.ownerSVGElement ?? ( element instanceof SVGSVGElement ? element : null );
    if ( !svg ) return null;

    const ctm = element.getScreenCTM();
    if ( !ctm ) return null;

    try {
        const point = svg.createSVGPoint();
        point.x = clientX;
        point.y = clientY;
        const transformed = point.matrixTransform( ctm.inverse() );
        return { x: transformed.x, y: transformed.y };
    } catch ( error ) {
        console.warn( "[Canvas fit] Could not invert the SVG screen transform.", error );
        return null;
    }
}

function computeCanvasFitToWidth(
    svg: SVGSVGElement,
    diagram: SVGGElement
): CanvasFitResult | null {
    let diagramBounds: DOMRect;
    try {
        diagramBounds = diagram.getBBox();
    } catch ( error ) {
        console.warn( "[Canvas fit] Diagram bounds are unavailable.", error );
        return null;
    }

    if ( !Number.isFinite( diagramBounds.width ) || diagramBounds.width <= 0 ) return null;

    const viewportBounds = svg.getBoundingClientRect();
    if ( viewportBounds.width <= 0 || viewportBounds.height <= 0 ) return null;

    const toolbar = svg.closest( ".canvas" )?.querySelector<HTMLElement>( ".topToolbar" );
    const toolbarBounds = toolbar?.getBoundingClientRect();
    const topOcclusionPx = toolbarBounds
        ? Math.max( 0, Math.min( viewportBounds.bottom, toolbarBounds.bottom ) - viewportBounds.top )
        : 0;
    const topInsetPx = CANVAS_FIT_PADDING_PX + topOcclusionPx;

    const topLeft = clientPointInElement( svg, viewportBounds.left, viewportBounds.top );
    const bottomRight = clientPointInElement( svg, viewportBounds.right, viewportBounds.bottom );
    const inset = clientPointInElement(
        svg,
        viewportBounds.left + Math.min( CANVAS_FIT_PADDING_PX, viewportBounds.width / 4 ),
        viewportBounds.top + Math.min( topInsetPx, viewportBounds.height / 2 )
    );
    if ( !topLeft || !bottomRight || !inset ) return null;

    const visibleLeft = Math.min( topLeft.x, bottomRight.x );
    const visibleTop = Math.min( topLeft.y, bottomRight.y );
    const visibleWidth = Math.abs( bottomRight.x - topLeft.x );
    const paddingX = Math.abs( inset.x - topLeft.x );
    const paddingY = Math.abs( inset.y - topLeft.y );
    const availableWidth = visibleWidth - 2 * paddingX;
    if ( !Number.isFinite( availableWidth ) || availableWidth <= 0 ) return null;

    const fitZoom = availableWidth / diagramBounds.width;
    if ( !Number.isFinite( fitZoom ) || fitZoom <= 0 ) return null;

    return {
        fitZoom,
        panzoom: {
            x: visibleLeft + paddingX - diagramBounds.x * fitZoom,
            y: visibleTop + paddingY - diagramBounds.y * fitZoom,
            zoom: fitZoom,
        },
    };
}

export default function Canvas() {
    const hostRef = useRef<HTMLDivElement | null>( null );
    const svgRef = useRef<SVGSVGElement | null>( null );
    const gRef = useRef<SVGGElement | null>( null );

    const panzoom = useAppStore( ( s ) => s.panzoom );
    const canvasFitZoom = useAppStore( ( s ) => s.canvasFitZoom );
    const canvasFitRequest = useAppStore( ( s ) => s.canvasFitRequest );
    const setCanvasCamera = useAppStore( ( s ) => s.setCanvasCamera );
    const requestCanvasFitToWidth = useAppStore( ( s ) => s.requestCanvasFitToWidth );
    const setZoomAnchored = useAppStore( ( s ) => s.setZoomAnchored );
    const viewBox = useAppStore( ( s ) => s.viewBox );
    const canvasDark = useAppStore( ( s ) => s.canvasDark );
    const focusTarget = useAppStore( ( s ) => s.focusTarget );
    const keyboardMarquee = useAppStore( ( s ) => s.keyboardMarquee );
    const focusFirstDiagramItem = useAppStore( ( s ) => s.focusFirstDiagramItem );
    const moveFocusInDirection = useAppStore( ( s ) => s.moveFocusInDirection );
    const extendKeyboardMarquee = useAppStore( ( s ) => s.extendKeyboardMarquee );

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

    const dialogsOpen = editNodeId != null || editActionId != null || editConditionId != null;
    const initialFitRequestedRef = useRef( false );

    const applyFitToWidth = useCallback( ( appliedFitRequest?: number ): boolean => {
        const svg = svgRef.current;
        const diagram = gRef.current;
        if ( !svg || !diagram ) return false;

        const fit = computeCanvasFitToWidth( svg, diagram );
        if ( !fit ) {
            if ( appliedFitRequest != null ) {
                const current = useAppStore.getState();
                setCanvasCamera( current.panzoom, current.canvasFitZoom, appliedFitRequest );
            }
            return false;
        }

        setCanvasCamera( fit.panzoom, fit.fitZoom, appliedFitRequest );
        return true;
    }, [ setCanvasCamera ] );

    const setZoomFromSlider = ( zoomPercent: number ) => {
        if ( zoomPercent === CANVAS_FIT_PERCENT ) {
            requestCanvasFitToWidth();
            return;
        }

        const svg = svgRef.current;
        if ( !svg ) return;
        const bounds = svg.getBoundingClientRect();
        const anchor = clientToGroupPoint( bounds.left + bounds.width / 2, bounds.top + bounds.height / 2 );
        const state = useAppStore.getState();
        setZoomAnchored( state.canvasFitZoom * zoomPercent / CANVAS_FIT_PERCENT, anchor );
    };

    useEffect( () => {
        if ( initialFitRequestedRef.current ) return;
        initialFitRequestedRef.current = true;
        requestCanvasFitToWidth();
    }, [ requestCanvasFitToWidth ] );

    useLayoutEffect( () => {
        if ( canvasFitRequest <= 0 ) return;

        let firstFrame = 0;
        let secondFrame = 0;
        firstFrame = window.requestAnimationFrame( () => {
            secondFrame = window.requestAnimationFrame( () => {
                applyFitToWidth( canvasFitRequest );
            } );
        } );

        return () => {
            window.cancelAnimationFrame( firstFrame );
            window.cancelAnimationFrame( secondFrame );
        };
    }, [ applyFitToWidth, canvasFitRequest ] );

    useLayoutEffect( () => {
        const svg = svgRef.current;
        const diagram = gRef.current;
        if ( !svg || !diagram || typeof ResizeObserver === "undefined" ) return;

        const initialBounds = svg.getBoundingClientRect();
        let previousWidth = initialBounds.width;
        let previousHeight = initialBounds.height;
        let frame = 0;

        const observer = new ResizeObserver( entries => {
            const entry = entries[ 0 ];
            if ( !entry ) return;
            const { width, height } = entry.contentRect;
            if ( width === previousWidth && height === previousHeight ) return;
            previousWidth = width;
            previousHeight = height;

            window.cancelAnimationFrame( frame );
            frame = window.requestAnimationFrame( () => {
                const nextFit = computeCanvasFitToWidth( svg, diagram );
                if ( !nextFit ) return;

                const state = useAppStore.getState();
                const currentFitZoom = Number.isFinite( state.canvasFitZoom ) && state.canvasFitZoom > 0
                    ? state.canvasFitZoom
                    : 1;
                const relativeZoom = state.panzoom.zoom / currentFitZoom;

                if ( Math.abs( relativeZoom - 1 ) <= CANVAS_FIT_EPSILON ) {
                    setCanvasCamera( nextFit.panzoom, nextFit.fitZoom );
                    return;
                }

                const bounds = svg.getBoundingClientRect();
                const anchor = clientPointInElement(
                    diagram,
                    bounds.left + bounds.width / 2,
                    bounds.top + bounds.height / 2
                );
                if ( !anchor ) return;

                const nextZoom = nextFit.fitZoom * relativeZoom;
                setCanvasCamera( {
                    x: state.panzoom.x + ( state.panzoom.zoom - nextZoom ) * anchor.x,
                    y: state.panzoom.y + ( state.panzoom.zoom - nextZoom ) * anchor.y,
                    zoom: nextZoom,
                }, nextFit.fitZoom );
            } );
        } );

        observer.observe( svg );
        return () => {
            observer.disconnect();
            window.cancelAnimationFrame( frame );
        };
    }, [ setCanvasCamera ] );

    useKeyboardShortcuts( {
        setCanvasMenu,
        setNodeMenu,
        setActionMenu,
        setConditionMenu,
        dialogsOpen,
    } );

    // --- Datos de store para orquestación ---
    const nodes = useAppStore( s => s.nodes );
    const edges = useAppStore( s => s.edges );
    const actions = useAppStore( s => s.actions );
    const conditions = useAppStore( s => s.conditions );

    // === Niveles por nodo ===
    function buildLevelsMap(): Map<number, number> {
        const levels = new Map<number, number>();
        const getLevel = ( id: number, visiting: Set<number> = new Set() ): number => {
            if ( levels.has( id ) ) return levels.get( id )!;
            if ( visiting.has( id ) ) return 0;
            visiting.add( id );
            const self = nodes.find( n => n.id === id );
            const p = self?.parentId ?? null;
            const lv = p == null ? 0 : getLevel( p, visiting ) + 1;
            visiting.delete( id );
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
        if ( dialogsOpen || !focusTarget || !hostRef.current ) return;
        const selector = `[data-kbd-kind="${focusTarget.kind}"][data-kbd-id="${focusTarget.id}"]`;
        const el = hostRef.current.querySelector( selector ) as ( SVGElement & { focus?: () => void } ) | null;
        if ( !el || document.activeElement === el ) return;
        el.focus?.();
    }, [ dialogsOpen, focusTarget ] );

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
            className={ `canvas${canvasDark ? " is-dark" : ""}${ctrlDown ? " is-grab-ready" : ""}` }
            style={ { position: "absolute", inset: 0, background: "transparent" } }
        >
            <TopToolbar svgRef={ svgRef } diagOpen={ diagOpen } onToggleDiag={ () => setDiagOpen( v => !v ) } />

            <MenuBusProvider value={ menuBusValue }>
                <svg
                    ref={ svgRef }
                    width="100%" height="100%"
                    viewBox={ `0 0 ${viewBox.w} ${viewBox.h}` }
                    preserveAspectRatio="xMidYMid meet"
                    tabIndex={ 0 }
                    role="group"
                    aria-label="Diagram canvas"
                    data-diagram-surface="true"
                    onFocus={ ( e ) => {
                        if ( e.target === e.currentTarget ) focusFirstDiagramItem();
                    } }
                    onKeyDown={ ( e ) => {
                        if ( e.target !== e.currentTarget ) return;
                        const moveByKey: Record<string, "left" | "right" | "up" | "down"> = {
                            ArrowLeft: "left",
                            ArrowRight: "right",
                            ArrowUp: "up",
                            ArrowDown: "down",
                        };
                        const direction = moveByKey[ e.key ];
                        if ( direction ) {
                            e.preventDefault();
                            if ( e.shiftKey ) extendKeyboardMarquee( direction );
            else moveFocusInDirection( direction );
                        }
                    } }
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
                        <FragmentFramesLayer />

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

                        { ( marquee ?? keyboardMarquee ) && ( marquee ?? keyboardMarquee )!.w > 0 && ( marquee ?? keyboardMarquee )!.h > 0 && (
                            <rect
                                data-export="ignore"
                                x={ ( marquee ?? keyboardMarquee )!.x }
                                y={ ( marquee ?? keyboardMarquee )!.y }
                                width={ ( marquee ?? keyboardMarquee )!.w }
                                height={ ( marquee ?? keyboardMarquee )!.h }
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

                <ZoomSlider
                    className="canvasZoomSlider"
                    minPercent={ MIN_CANVAS_ZOOM * 100 }
                    maxPercent={ MAX_CANVAS_ZOOM * 100 }
                    valuePercent={ panzoom.zoom / Math.max( canvasFitZoom, Number.EPSILON ) * 100 }
                    onChange={ setZoomFromSlider }
                />

                <RenderMenus
                    canvasMenu={ canvasMenu }
                    nodeMenu={ nodeMenu }
                    actionMenu={ actionMenu }
                    conditionMenu={ conditionMenu }
                    onCreateNode={ () => createNodeFromCanvasMenu( canvasMenu.x, canvasMenu.y, clientToGroupPoint ) }
                    setCanvasMenu={ setCanvasMenu }
                    setNodeMenu={ setNodeMenu }
                    setActionMenu={ setActionMenu }
                    setConditionMenu={ setConditionMenu }
                    openNodeEditDialog={ menuBusValue.openNodeEditDialog }
                    openActionEditDialog={ menuBusValue.openActionEditDialog }
                />

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
