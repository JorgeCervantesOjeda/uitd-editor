// src/components/Canvas/actions.tsx
import React from "react";
import { useAppStore } from "../../state/store";
import { measureActionOval, measureConditionOval } from "../../layout/measurement";
import { TITLE_LINE_H } from "../../model/types";
import { useMenuBus } from "./menuBus";

function clientToRootGroupPoint( e: React.MouseEvent ) {
    const rootG = document.querySelector( 'g[data-root="root"]' ) as SVGGElement | null;
    const svg = ( e.currentTarget as SVGSVGElement ).ownerSVGElement || ( e.currentTarget as SVGElement );
    const svgEl = ( svg as SVGSVGElement ) ?? document.querySelector( "svg" );
    if ( !rootG || !svgEl ) return { x: e.clientX, y: e.clientY };
    const pt = svgEl.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = rootG.getScreenCTM();
    if ( !ctm ) return { x: e.clientX, y: e.clientY };
    const inv = ctm.inverse();
    const p = pt.matrixTransform( inv );
    return { x: p.x, y: p.y };
}

function focusSvgElement( el: SVGElement | null ) {
    const maybeFocusable = el as SVGElement & { focus?: () => void };
    maybeFocusable.focus?.();
}

function getElementMenuPoint( el: SVGGraphicsElement ) {
    const rect = el.getBoundingClientRect();
    return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
    };
}

const SEL_GAP = 5;
const SEL_COLOR = "var(--diagram-selection)";
const SEL_WIDTH = 3;
const SEL_DASH = "4 8";

export function ActionsLayer() {
    const actions = useAppStore( ( s ) => s.actions );
    const conditions = useAppStore( ( s ) => s.conditions );

    const selectionActions = useAppStore( ( s ) => s.selectionActions );
    const selectionConds = useAppStore( ( s ) => s.selectionConds );
    const focusTarget = useAppStore( ( s ) => s.focusTarget );

    const pending = useAppStore( ( s ) => s.pendingConnect );
    const beginCombinedDrag = useAppStore( ( s ) => s.beginCombinedDrag );

    const selectSingleOrKeepAction = useAppStore( ( s ) => s.selectSingleOrKeepAction );
    const toggleSelectAction = useAppStore( ( s ) => s.toggleSelectAction );

    const selectSingleOrKeepCondition = useAppStore( ( s ) => s.selectSingleOrKeepCondition );
    const toggleSelectCondition = useAppStore( ( s ) => s.toggleSelectCondition );
    const setFocusTarget = useAppStore( ( s ) => s.setFocusTarget );
    const moveFocusInDirection = useAppStore( ( s ) => s.moveFocusInDirection );
    const extendKeyboardMarquee = useAppStore( ( s ) => s.extendKeyboardMarquee );

    const bus = useMenuBus();

    function onActionMouseDown( e: React.MouseEvent<SVGGElement>, id: number ) {
        e.stopPropagation();
        if ( e.button !== 0 ) return;
        if ( pending ) return;

        const alreadySelected = useAppStore.getState().selectionActions.has( id );

        if ( e.shiftKey ) {
            toggleSelectAction( id );
        } else if ( !alreadySelected ) {
            selectSingleOrKeepAction( id, false );
        }

        setFocusTarget( { kind: "action", id } );
        focusSvgElement( e.currentTarget );

        const selNodes = new Set( useAppStore.getState().selection );
        const selActions = new Set( useAppStore.getState().selectionActions );
        if ( !selActions.has( id ) ) selActions.add( id );
        const selConds = new Set( useAppStore.getState().selectionConds );

        const anchor = clientToRootGroupPoint( e );
        beginCombinedDrag( anchor, selNodes, selActions, selConds );
    }

    function onConditionMouseDown( e: React.MouseEvent<SVGGElement>, id: number ) {
        e.stopPropagation();
        if ( e.button !== 0 ) return;
        if ( pending && pending.mode === "condition-to-target" ) return;

        const alreadySelected = useAppStore.getState().selectionConds.has( id );

        if ( e.shiftKey ) {
            toggleSelectCondition( id );
        } else if ( !alreadySelected ) {
            selectSingleOrKeepCondition( id, false );
        }

        setFocusTarget( { kind: "condition", id } );
        focusSvgElement( e.currentTarget );

        const selNodes = new Set( useAppStore.getState().selection );
        const selActions = new Set( useAppStore.getState().selectionActions );
        const selConds = new Set( useAppStore.getState().selectionConds );
        if ( !selConds.has( id ) ) selConds.add( id );

        const anchor = clientToRootGroupPoint( e );
        beginCombinedDrag( anchor, selNodes, selActions, selConds );
    }

    function onActionDoubleClick( e: React.MouseEvent, id: number ) {
        e.stopPropagation();
        bus.openActionEditDialog( id );
    }

    function onActionContextMenu( e: React.MouseEvent, id: number ) {
        e.preventDefault();
        e.stopPropagation();
        if ( !selectionActions.has( id ) ) selectSingleOrKeepAction( id, false );
        setFocusTarget( { kind: "action", id } );
        bus.openActionMenu( e.clientX, e.clientY, id );
    }

    function onConditionDoubleClick( e: React.MouseEvent, id: number ) {
        e.stopPropagation();
        bus.openConditionEditDialog( id );
    }

    function onConditionContextMenu( e: React.MouseEvent, id: number ) {
        e.preventDefault();
        e.stopPropagation();
        if ( !selectionConds.has( id ) ) selectSingleOrKeepCondition( id, false );
        setFocusTarget( { kind: "condition", id } );
        bus.openConditionMenu( e.clientX, e.clientY, id );
    }

    function onActionKeyDown( e: React.KeyboardEvent<SVGGElement>, id: number ) {
        const moveByKey: Record<string, "left" | "right" | "up" | "down"> = {
            ArrowLeft: "left",
            ArrowRight: "right",
            ArrowUp: "up",
            ArrowDown: "down",
        };
        const direction = moveByKey[ e.key ];
        if ( direction ) {
            e.preventDefault();
            e.stopPropagation();
            if ( e.shiftKey ) extendKeyboardMarquee( direction );
            else moveFocusInDirection( direction );
            return;
        }

        if ( e.key === "Enter" || e.key === "F2" ) {
            e.preventDefault();
            e.stopPropagation();
            if ( !selectionActions.has( id ) ) selectSingleOrKeepAction( id, false );
            setFocusTarget( { kind: "action", id } );
            bus.openActionEditDialog( id );
            return;
        }

        if ( e.key === "ContextMenu" || ( e.shiftKey && e.key === "F10" ) ) {
            e.preventDefault();
            e.stopPropagation();
            if ( !selectionActions.has( id ) ) selectSingleOrKeepAction( id, false );
            setFocusTarget( { kind: "action", id } );
            const point = getElementMenuPoint( e.currentTarget );
            bus.openActionMenu( point.x, point.y, id );
        }
    }

    function onConditionKeyDown( e: React.KeyboardEvent<SVGGElement>, id: number ) {
        const moveByKey: Record<string, "left" | "right" | "up" | "down"> = {
            ArrowLeft: "left",
            ArrowRight: "right",
            ArrowUp: "up",
            ArrowDown: "down",
        };
        const direction = moveByKey[ e.key ];
        if ( direction ) {
            e.preventDefault();
            e.stopPropagation();
            if ( e.shiftKey ) extendKeyboardMarquee( direction );
            else moveFocusInDirection( direction );
            return;
        }

        if ( e.key === "Enter" || e.key === "F2" ) {
            e.preventDefault();
            e.stopPropagation();
            if ( !selectionConds.has( id ) ) selectSingleOrKeepCondition( id, false );
            setFocusTarget( { kind: "condition", id } );
            bus.openConditionEditDialog( id );
            return;
        }

        if ( e.key === "ContextMenu" || ( e.shiftKey && e.key === "F10" ) ) {
            e.preventDefault();
            e.stopPropagation();
            if ( !selectionConds.has( id ) ) selectSingleOrKeepCondition( id, false );
            setFocusTarget( { kind: "condition", id } );
            const point = getElementMenuPoint( e.currentTarget );
            bus.openConditionMenu( point.x, point.y, id );
        }
    }

    function renderActionOvalBase(
        cx: number,
        cy: number,
        title: string,
        wrap: number | undefined,
        fill?: string,
        strokeCol?: string,
        textCol?: string
    ) {
        const m = measureActionOval( title, wrap ?? 22 );
        const rx = m.w / 2;
        const ry = m.h / 2;
        const textX = cx;
        const textStartY = cy - ( m.lines.length - 1 ) * ( TITLE_LINE_H / 2 ) + 4;

        const resolvedFill =
            ( fill && fill.trim() !== "" ) ? fill : "var(--diagram-action-fill)";
        const resolvedStroke =
            ( strokeCol && strokeCol.trim() !== "" ) ? strokeCol : "var(--diagram-action-stroke)";
        const resolvedText =
            ( textCol && textCol.trim() !== "" ) ? textCol : "var(--diagram-action-text)";

        const strokeWidth = 4;

        return {
            m, rx, ry,
            node: (
                <>
                    <ellipse
                        cx={ cx }
                        cy={ cy }
                        rx={ rx }
                        ry={ ry }
                        fill={ resolvedFill }
                        stroke={ resolvedStroke }
                        strokeWidth={ strokeWidth }
                    />
                    <text
                        textAnchor="middle"
                        x={ textX }
                        y={ textStartY }
                        style={ { fontSize: 16, fill: resolvedText, userSelect: "none" } }
                    >
                        { m.lines.map( ( line, i ) => (
                            <tspan key={ i } x={ textX } dy={ i === 0 ? 0 : TITLE_LINE_H }>
                                { line }
                            </tspan>
                        ) ) }
                    </text>
                </>
            )
        };
    }

    function conditionHexagonPoints( cx: number, cy: number, rx: number, ry: number ) {
        const inset = Math.max( 10, rx * 0.35 );
        return [
            `${cx - rx + inset},${cy - ry}`,
            `${cx + rx - inset},${cy - ry}`,
            `${cx + rx},${cy}`,
            `${cx + rx - inset},${cy + ry}`,
            `${cx - rx + inset},${cy + ry}`,
            `${cx - rx},${cy}`,
        ].join( " " );
    }

    function renderConditionHexagonBase(
        cx: number,
        cy: number,
        title: string,
        wrap: number | undefined,
        fill?: string,
        strokeCol?: string,
        textCol?: string
    ) {
        const m = measureConditionOval( title, wrap ?? 22 );
        const rx = m.w / 2;
        const ry = m.h / 2;
        const textX = cx;
        const textStartY = cy - ( m.lines.length - 1 ) * ( TITLE_LINE_H / 2 ) + 4;

        const resolvedFill =
            ( fill && fill.trim() !== "" ) ? fill : "var(--diagram-action-fill)";
        const resolvedStroke =
            ( strokeCol && strokeCol.trim() !== "" ) ? strokeCol : "var(--diagram-action-stroke)";
        const resolvedText =
            ( textCol && textCol.trim() !== "" ) ? textCol : "var(--diagram-action-text)";

        const strokeWidth = 4;

        return {
            m, rx, ry,
            node: (
                <>
                    <polygon
                        points={ conditionHexagonPoints( cx, cy, rx, ry ) }
                        fill={ resolvedFill }
                        stroke={ resolvedStroke }
                        strokeWidth={ strokeWidth }
                    />
                    <text
                        textAnchor="middle"
                        x={ textX }
                        y={ textStartY }
                        style={ { fontSize: 16, fill: resolvedText, userSelect: "none" } }
                    >
                        { m.lines.map( ( line, i ) => (
                            <tspan key={ i } x={ textX } dy={ i === 0 ? 0 : TITLE_LINE_H }>
                                { line }
                            </tspan>
                        ) ) }
                    </text>
                </>
            )
        };
    }

    return (
        <g data-layer="labels">
            { actions.map( ( a ) => {
                const isSel = selectionActions.has( a.id );
                const isFocused = focusTarget?.kind === "action" && focusTarget.id === a.id;
                const { rx, ry, node } = renderActionOvalBase( a.x, a.y, a.title, a.wrap, a.colorFill, a.colorStroke, a.colorText );
                return (
                    <g
                        key={ `action-${a.id}` }
                        data-kbd-kind="action"
                        data-kbd-id={ a.id }
                        role="button"
                        aria-label={ `Action ${a.id}: ${a.title}` }
                        tabIndex={ isFocused ? 0 : -1 }
                        focusable="true"
                        style={ { cursor: "default", outline: "none" } }
                        onFocus={ () => setFocusTarget( { kind: "action", id: a.id } ) }
                        onKeyDown={ ( e ) => onActionKeyDown( e, a.id ) }
                        onMouseDown={ ( e ) => onActionMouseDown( e, a.id ) }
                        onDoubleClick={ ( e ) => onActionDoubleClick( e, a.id ) }
                        onContextMenu={ ( e ) => onActionContextMenu( e, a.id ) }
                    >
                        { node }
                        { isSel && (
                            <ellipse
                                data-export="ignore"
                                cx={ a.x } cy={ a.y }
                                rx={ rx + SEL_GAP } ry={ ry + SEL_GAP }
                                fill="none"
                                stroke={ SEL_COLOR }
                                strokeWidth={ SEL_WIDTH }
                                strokeDasharray={ SEL_DASH }
                                pointerEvents="none"
                            />
                        ) }
                        { isFocused && (
                            <ellipse
                                data-export="ignore"
                                cx={ a.x }
                                cy={ a.y }
                                rx={ rx + 12 }
                                ry={ ry + 12 }
                                fill="none"
                                stroke="#f97316"
                                strokeWidth={ 2 }
                                strokeDasharray="3 4"
                                pointerEvents="none"
                            />
                        ) }
                    </g>
                );
            } ) }

            { conditions.map( ( c ) => {
                const isSel = selectionConds.has( c.id );
                const isFocused = focusTarget?.kind === "condition" && focusTarget.id === c.id;
                const { rx, ry, node } = renderConditionHexagonBase( c.x, c.y, c.title, c.wrap, c.colorFill, c.colorStroke, c.colorText );
                return (
                    <g
                        key={ `cond-${c.id}` }
                        data-kbd-kind="condition"
                        data-kbd-id={ c.id }
                        role="button"
                        aria-label={ `Condition ${c.id}: ${c.title}` }
                        tabIndex={ isFocused ? 0 : -1 }
                        focusable="true"
                        style={ { cursor: "default", outline: "none" } }
                        onFocus={ () => setFocusTarget( { kind: "condition", id: c.id } ) }
                        onKeyDown={ ( e ) => onConditionKeyDown( e, c.id ) }
                        onMouseDown={ ( e ) => onConditionMouseDown( e, c.id ) }
                        onDoubleClick={ ( e ) => onConditionDoubleClick( e, c.id ) }
                        onContextMenu={ ( e ) => onConditionContextMenu( e, c.id ) }
                    >
                        { node }
                        { isSel && (
                            <polygon
                                data-export="ignore"
                                points={ conditionHexagonPoints( c.x, c.y, rx + SEL_GAP, ry + SEL_GAP ) }
                                fill="none"
                                stroke={ SEL_COLOR }
                                strokeWidth={ SEL_WIDTH }
                                strokeDasharray={ SEL_DASH }
                                pointerEvents="none"
                            />
                        ) }
                        { isFocused && (
                            <polygon
                                data-export="ignore"
                                points={ conditionHexagonPoints( c.x, c.y, rx + 12, ry + 12 ) }
                                fill="none"
                                stroke="#f97316"
                                strokeWidth={ 2 }
                                strokeDasharray="3 4"
                                pointerEvents="none"
                            />
                        ) }
                    </g>
                );
            } ) }
        </g>
    );
}
