// src/components/Canvas/FragmentFramesLayer.tsx
// Renders selectable and editable visual frames around connected fragment groups.

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { buildFragmentBounds, type FragmentBounds } from "../../fragments/fragmentBounds";
import { useAppStore } from "../../state/store";
import {
    FRAGMENT_TOOLTIP_EDGE_MARGIN_PX,
    FRAGMENT_TOOLTIP_GAP_PX,
    FRAGMENT_TOOLTIP_HEIGHT_PX,
    FRAGMENT_TOOLTIP_HORIZONTAL_PADDING_PX,
    FRAGMENT_TOOLTIP_AVERAGE_CHAR_WIDTH_PX,
    FRAGMENT_TOOLTIP_FONT,
    FRAGMENT_TOOLTIP_MIN_WIDTH_PX,
    FRAGMENT_TOOLTIP_WIDTH_PX,
} from "./fragmentTooltipMetrics";

const FRAGMENT_TITLE_FONT_SIZE = 30;

type FragmentHoverProps = {
    hoveredFragmentId: string | null;
    setHoveredFragmentId: ( fragmentId: string | null ) => void;
};

type FragmentTooltipCamera = {
    y: number;
    x: number;
    zoom: number;
};

export type FragmentTooltipViewport = {
    cssHeight: number;
    cssWidth: number;
    viewBoxHeight: number;
    viewBoxWidth: number;
};

let tooltipMeasurementContext: CanvasRenderingContext2D | null = null;

function estimateWidthOfTooltipText( text: string ): number {
    const countOfCharacters = Array.from( text ).length;
    return countOfCharacters * FRAGMENT_TOOLTIP_AVERAGE_CHAR_WIDTH_PX;
}

function measuredWidthOfTooltipText( text: string ): number {
    if ( typeof document === "undefined" ) return estimateWidthOfTooltipText( text );

    if ( !tooltipMeasurementContext ) {
        const canvas = document.createElement( "canvas" );
        tooltipMeasurementContext = canvas.getContext( "2d" );
    }

    if ( !tooltipMeasurementContext ) {
        console.warn(
            "[Fragment tooltip] Could not measure tooltip text with canvas; using estimated width.",
            { fallback: "average-character-width", impact: "tooltip horizontal fit may be approximate" }
        );
        return estimateWidthOfTooltipText( text );
    }

    tooltipMeasurementContext.font = FRAGMENT_TOOLTIP_FONT;
    return tooltipMeasurementContext.measureText( text ).width;
}

function widthOfTooltipText( text: string, maxWidth: number ): number {
    const measuredWidth =
        measuredWidthOfTooltipText( text ) +
        FRAGMENT_TOOLTIP_HORIZONTAL_PADDING_PX;
    return Math.max(
        FRAGMENT_TOOLTIP_MIN_WIDTH_PX,
        Math.min( maxWidth, Math.ceil( measuredWidth ) )
    );
}

type FragmentTooltipPosition = {
    left: number;
    maxWidth: number;
    top: number;
};

function FragmentTitleInput( props: {
    fragment: FragmentBounds;
    draft: string;
    setDraft: ( value: string ) => void;
    commit: () => void;
    cancel: () => void;
} ) {
    const { fragment, draft, setDraft, commit, cancel } = props;
    const inputRef = useRef<HTMLInputElement | null>( null );

    useEffect( () => {
        inputRef.current?.focus();
        inputRef.current?.select();
    }, [] );

    return (
        <foreignObject
            x={ fragment.x + 8 }
            y={ fragment.y + 5 }
            width={ Math.max( 160, Math.min( fragment.w - 16, 320 ) ) }
            height={ 32 }
            pointerEvents="all"
        >
            <input
                ref={ inputRef }
                value={ draft }
                aria-label="Fragment title"
                onChange={ ( e ) => setDraft( e.currentTarget.value ) }
                onBlur={ commit }
                onKeyDown={ ( e ) => {
                    if ( e.key === "Enter" ) {
                        e.preventDefault();
                        commit();
                    }
                    if ( e.key === "Escape" ) {
                        e.preventDefault();
                        cancel();
                    }
                } }
                style={ {
                    boxSizing: "border-box",
                    width: "100%",
                    height: 28,
                    border: "1px solid #2563eb",
                    borderRadius: 6,
                    padding: "3px 7px",
                    font: "700 15px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto",
                    color: "#0f172a",
                    background: "#ffffff",
                    outline: "2px solid rgba(37, 99, 235, 0.18)",
                } }
            />
        </foreignObject>
    );
}

function FragmentTitleTooltip( props: {
    fragment: FragmentBounds;
    canvasDark: boolean;
    camera: FragmentTooltipCamera;
    viewport: FragmentTooltipViewport;
} ) {
    const { fragment, canvasDark, camera, viewport } = props;
    const tooltipRef = useRef<HTMLDivElement | null>( null );
    const [ position, setPosition ] = useState<FragmentTooltipPosition | null>( null );
    const safeZoom = Number.isFinite( camera.zoom ) && camera.zoom > 0 ? camera.zoom : 1;
    const safeCssWidth = Number.isFinite( viewport.cssWidth ) && viewport.cssWidth > 0
        ? viewport.cssWidth
        : viewport.viewBoxWidth;
    const safeCssHeight = Number.isFinite( viewport.cssHeight ) && viewport.cssHeight > 0
        ? viewport.cssHeight
        : viewport.viewBoxHeight;
    const safeViewBoxWidth = Number.isFinite( viewport.viewBoxWidth ) && viewport.viewBoxWidth > 0
        ? viewport.viewBoxWidth
        : safeCssWidth;
    const safeViewBoxHeight = Number.isFinite( viewport.viewBoxHeight ) && viewport.viewBoxHeight > 0
        ? viewport.viewBoxHeight
        : safeCssHeight;
    const cssPxPerSvgUnit = Math.min(
        safeCssWidth / safeViewBoxWidth,
        safeCssHeight / safeViewBoxHeight
    );
    const visibleLeftPx = Math.max( 0, ( safeCssWidth - safeViewBoxWidth * cssPxPerSvgUnit ) / 2 );
    const visibleTopPx = Math.max( 0, ( safeCssHeight - safeViewBoxHeight * cssPxPerSvgUnit ) / 2 );
    const visibleRightPx = safeCssWidth;
    const maxTooltipWidth = Math.max(
        0,
        Math.min(
            FRAGMENT_TOOLTIP_WIDTH_PX,
            safeCssWidth - 2 * FRAGMENT_TOOLTIP_EDGE_MARGIN_PX
        )
    );
    const canRenderTooltip = maxTooltipWidth > 0 && cssPxPerSvgUnit > 0;

    useLayoutEffect( () => {
        if ( !canRenderTooltip ) {
            setPosition( null );
            return;
        }

        const measuredWidth = tooltipRef.current?.offsetWidth;
        const tooltipWidth = Math.min(
            maxTooltipWidth,
            measuredWidth && measuredWidth > 0
                ? measuredWidth
                : widthOfTooltipText( fragment.title, maxTooltipWidth )
        );
        const leftAlignedScreenX = visibleLeftPx + ( camera.x + fragment.x * safeZoom ) * cssPxPerSvgUnit;
        const fragmentRightScreenX = visibleLeftPx + ( camera.x + ( fragment.x + fragment.w ) * safeZoom ) *
            cssPxPerSvgUnit;
        const fragmentTopScreenY = visibleTopPx + ( camera.y + fragment.y * safeZoom ) * cssPxPerSvgUnit;
    const minScreenX = FRAGMENT_TOOLTIP_EDGE_MARGIN_PX;
        const maxScreenX = Math.max( minScreenX, visibleRightPx - tooltipWidth - FRAGMENT_TOOLTIP_EDGE_MARGIN_PX );
        const rightAlignedScreenX = fragmentRightScreenX - tooltipWidth;
        const preferredScreenX = leftAlignedScreenX + tooltipWidth <= visibleRightPx - FRAGMENT_TOOLTIP_EDGE_MARGIN_PX
            ? leftAlignedScreenX
            : rightAlignedScreenX;
        const nextPosition = {
            left: Math.min( maxScreenX, Math.max( minScreenX, preferredScreenX ) ),
            maxWidth: maxTooltipWidth,
            top: Math.max(
                FRAGMENT_TOOLTIP_EDGE_MARGIN_PX,
                fragmentTopScreenY - FRAGMENT_TOOLTIP_HEIGHT_PX - FRAGMENT_TOOLTIP_GAP_PX
            ),
        };

        setPosition( current =>
            current &&
                current.left === nextPosition.left &&
                current.maxWidth === nextPosition.maxWidth &&
                current.top === nextPosition.top
                ? current
                : nextPosition
        );
    }, [
        camera.x,
        camera.y,
        canRenderTooltip,
        cssPxPerSvgUnit,
        fragment.title,
        fragment.w,
        fragment.x,
        fragment.y,
        maxTooltipWidth,
        safeZoom,
        visibleLeftPx,
        visibleRightPx,
        visibleTopPx,
    ] );

    if ( !canRenderTooltip ) return null;

    return (
        <div
            ref={ tooltipRef }
            className="fragmentFrameTooltip"
            style={ {
                position: "absolute",
                left: position?.left ?? visibleLeftPx + ( camera.x + fragment.x * safeZoom ) * cssPxPerSvgUnit,
                top: position?.top ?? Math.max(
                    FRAGMENT_TOOLTIP_EDGE_MARGIN_PX,
                    visibleTopPx + ( camera.y + fragment.y * safeZoom ) * cssPxPerSvgUnit -
                        FRAGMENT_TOOLTIP_HEIGHT_PX -
                        FRAGMENT_TOOLTIP_GAP_PX
                ),
                boxSizing: "border-box",
                maxWidth: position?.maxWidth ?? maxTooltipWidth,
                height: FRAGMENT_TOOLTIP_HEIGHT_PX,
                display: "flex",
                alignItems: "center",
                padding: "5px 10px",
                border: `1px solid ${canvasDark ? "#93c5fd" : "#bfdbfe"}`,
                borderRadius: 6,
                color: canvasDark ? "#dbeafe" : "#1e3a8a",
                background: canvasDark ? "#0b1220" : "#ffffff",
                boxShadow: "0 8px 20px rgba(15, 23, 42, 0.18)",
                font: FRAGMENT_TOOLTIP_FONT,
                overflow: "hidden",
                whiteSpace: "nowrap",
                textOverflow: "ellipsis",
            } }
        >
            { fragment.title }
        </div>
    );
}

export function FragmentFramesLayer( props: FragmentHoverProps ) {
    const { setHoveredFragmentId } = props;
    const nodes = useAppStore( s => s.nodes );
    const actions = useAppStore( s => s.actions );
    const conditions = useAppStore( s => s.conditions );
    const edges = useAppStore( s => s.edges );
    const canvasDark = useAppStore( s => s.canvasDark );
    const fragmentTitles = useAppStore( s => s.fragmentTitles );
    const setFragmentTitle = useAppStore( s => s.setFragmentTitle );
    const isCanvasLocked = useAppStore( s => s.isCanvasLockedByUITDLLiveSync );

    const [ editingId, setEditingId ] = useState<string | null>( null );
    const [ draft, setDraft ] = useState( "" );
    const framePressRef = useRef<{ id: string; x: number; y: number } | null>( null );

    const fragments = useMemo(
        () => buildFragmentBounds( { nodes, actions, conditions, edges, fragmentTitles } ),
        [ nodes, actions, conditions, edges, fragmentTitles ]
    );

    const commitEdit = () => {
        if ( !editingId ) return;
        if ( isCanvasLocked ) {
            setEditingId( null );
            return;
        }
        const title = draft.trim();
        const fragment = fragments.find( f => f.id === editingId );
        setFragmentTitle( editingId, title || fragment?.title || "Fragment" );
        setEditingId( null );
    };

    const cancelEdit = () => {
        setEditingId( null );
    };

    const selectFragment = ( fragment: FragmentBounds ) => {
        useAppStore.setState( {
            selection: new Set( fragment.nodeIds ),
            selectionActions: new Set( fragment.actionIds ),
            selectionConds: new Set( fragment.conditionIds ),
            focusTarget:
                fragment.nodeIds[ 0 ] != null
                    ? { kind: "node", id: fragment.nodeIds[ 0 ] }
                    : fragment.actionIds[ 0 ] != null
                        ? { kind: "action", id: fragment.actionIds[ 0 ] }
                        : fragment.conditionIds[ 0 ] != null
                            ? { kind: "condition", id: fragment.conditionIds[ 0 ] }
                            : null,
            keyboardMarquee: null,
            marqueeSeed: null,
        } );
    };

    const stroke = canvasDark ? "#93c5fd" : "#2563eb";
    const fill = canvasDark ? "rgba(59, 130, 246, 0.08)" : "rgba(37, 99, 235, 0.05)";
    const labelBg = canvasDark ? "#0b1220" : "#ffffff";

    useEffect( () => {
        if ( isCanvasLocked ) setEditingId( null );
    }, [ isCanvasLocked ] );

    if ( fragments.length === 0 ) return null;

    return (
        <g data-layer="fragment-frames" aria-hidden="true">
            { fragments.map( ( fragment ) => {
                const isEditing = editingId === fragment.id;

                return (
                    <g
                        key={ fragment.id }
                        className="fragmentFrameGroup"
                        onMouseEnter={ () => setHoveredFragmentId( fragment.id ) }
                        onMouseLeave={ () => setHoveredFragmentId( null ) }
                    >
                        <rect
                            x={ fragment.x }
                            y={ fragment.y }
                            width={ fragment.w }
                            height={ fragment.h }
                            rx={ 10 }
                            ry={ 10 }
                            fill={ fill }
                            stroke={ stroke }
                            strokeWidth={ 2 }
                            strokeDasharray="12 8"
                            pointerEvents="all"
                            style={ { cursor: "pointer" } }
                            onMouseDown={ ( e ) => {
                                if ( e.button !== 0 ) {
                                    framePressRef.current = null;
                                    return;
                                }
                                framePressRef.current = {
                                    id: fragment.id,
                                    x: e.clientX,
                                    y: e.clientY,
                                };
                            } }
                            onMouseUp={ ( e ) => {
                                if ( e.button !== 0 ) return;

                                const press = framePressRef.current;
                                framePressRef.current = null;
                                if ( !press || press.id !== fragment.id ) return;

                                const dx = e.clientX - press.x;
                                const dy = e.clientY - press.y;
                                const moved = Math.hypot( dx, dy );
                                if ( moved > 4 ) return;

                                e.preventDefault();
                                selectFragment( fragment );
                            } }
                            onDoubleClick={ ( e ) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if ( isCanvasLocked ) return;
                                setEditingId( fragment.id );
                                setDraft( fragment.title );
                            } }
                        />
                        { isEditing ? (
                            <FragmentTitleInput
                                fragment={ fragment }
                                draft={ draft }
                                setDraft={ setDraft }
                                commit={ commitEdit }
                                cancel={ cancelEdit }
                            />
                        ) : (
                            <>
                                <text
                                    x={ fragment.x + 14 }
                                    y={ fragment.y + 40 }
                                    fontSize={ FRAGMENT_TITLE_FONT_SIZE }
                                    fontFamily="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto"
                                    fontWeight={ 700 }
                                    fill={ stroke }
                                    stroke={ labelBg }
                                    strokeWidth={ 4 }
                                    paintOrder="stroke"
                                    pointerEvents="all"
                                    style={ { cursor: "text", userSelect: "none" } }
                                    onDoubleClick={ ( e ) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        if ( isCanvasLocked ) return;
                                        setEditingId( fragment.id );
                                        setDraft( fragment.title );
                                    } }
                                >
                                    { fragment.title }
                                </text>
                            </>
                        ) }
                    </g>
                );
            } ) }
        </g>
    );
}

export function FragmentTooltipsLayer( props: Pick<FragmentHoverProps, "hoveredFragmentId"> & {
    viewport: FragmentTooltipViewport;
} ) {
    const { hoveredFragmentId, viewport } = props;
    const nodes = useAppStore( s => s.nodes );
    const actions = useAppStore( s => s.actions );
    const conditions = useAppStore( s => s.conditions );
    const edges = useAppStore( s => s.edges );
    const canvasDark = useAppStore( s => s.canvasDark );
    const fragmentTitles = useAppStore( s => s.fragmentTitles );
    const camera = useAppStore( s => s.panzoom );

    const fragments = useMemo(
        () => buildFragmentBounds( { nodes, actions, conditions, edges, fragmentTitles } ),
        [ nodes, actions, conditions, edges, fragmentTitles ]
    );

    const fragment = fragments.find( item => item.id === hoveredFragmentId );
    if ( !fragment ) return null;

    return (
        <div
            className="fragmentTooltipsLayer"
            aria-hidden="true"
            style={ {
                gridArea: "surface",
                position: "relative",
                width: "100%",
                height: "100%",
                pointerEvents: "none",
                zIndex: 20,
            } }
        >
            <FragmentTitleTooltip
                fragment={ fragment }
                canvasDark={ canvasDark }
                camera={ camera }
                viewport={ viewport }
            />
        </div>
    );
}
