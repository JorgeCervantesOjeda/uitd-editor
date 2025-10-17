// src/components/Canvas/actions.tsx
import React from "react";
import { useAppStore } from "../../state/store";
import { measureActionOval } from "../../layout/measurement";
import { TITLE_LINE_H } from "../../model/types";
import { useMenuBus } from "./menuBus";

function clientToRootGroupPoint( e: React.MouseEvent ) {
    const rootG = document.querySelector( 'g[data-root="root"]' ) as SVGGElement | null;
    const svg = ( e.currentTarget as SVGSVGElement ).ownerSVGElement || ( e.currentTarget as SVGElement );
    const svgEl = ( svg as SVGSVGElement ) ?? document.querySelector( "svg" );
    if ( !rootG || !svgEl ) return { x: e.clientX, y: e.clientY };
    const pt = svgEl.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    const ctm = rootG.getScreenCTM(); if ( !ctm ) return { x: e.clientX, y: e.clientY };
    const inv = ctm.inverse(); const p = pt.matrixTransform( inv ); return { x: p.x, y: p.y };
}

export function ActionsLayer() {
    const actions = useAppStore( ( s ) => s.actions );
    const conditions = useAppStore( ( s ) => s.conditions );

    const selectionActions = useAppStore( ( s ) => s.selectionActions );
    const selectionConds = useAppStore( ( s ) => s.selectionConds );

    const pending = useAppStore( ( s ) => s.pendingConnect );
    const beginCombinedDrag = useAppStore( ( s ) => s.beginCombinedDrag );

    const selectSingleOrKeepAction = useAppStore( ( s ) => s.selectSingleOrKeepAction );
    const toggleSelectAction = useAppStore( ( s ) => s.toggleSelectAction );

    const selectSingleOrKeepCondition = useAppStore( ( s ) => s.selectSingleOrKeepCondition );
    const toggleSelectCondition = useAppStore( ( s ) => s.toggleSelectCondition );

    const renameAction = useAppStore( ( s ) => s.renameAction );
    const renameCondition = useAppStore( ( s ) => s.renameCondition );

    const bus = useMenuBus();

    function onActionMouseDown( e: React.MouseEvent, id: number ) {
        e.stopPropagation();
        if ( e.button !== 0 ) return;
        if ( pending ) return;

        if ( e.shiftKey ) toggleSelectAction( id );
        else selectSingleOrKeepAction( id, selectionActions.has( id ) );

        const selNodes = new Set( useAppStore.getState().selection );
        const selActions = new Set( useAppStore.getState().selectionActions );
        const selConds = new Set( useAppStore.getState().selectionConds );
        if ( !selActions.has( id ) ) selActions.add( id );

        const anchor = clientToRootGroupPoint( e );
        beginCombinedDrag( anchor, selNodes, selActions, selConds );
    }

    function onActionDoubleClick( e: React.MouseEvent, id: number ) {
        e.stopPropagation();
        const act = useAppStore.getState().actions.find( ( a ) => a.id === id );
        if ( !act ) return;
        const t = window.prompt( "Rename action:", act.title );
        if ( t != null ) renameAction( id, t );
    }

    function onActionContextMenu( e: React.MouseEvent, id: number ) {
        e.preventDefault();
        e.stopPropagation();
        if ( !selectionActions.has( id ) ) selectSingleOrKeepAction( id, false );
        bus.openActionMenu( e.clientX, e.clientY, id );
    }

    function onConditionMouseDown( e: React.MouseEvent, id: number ) {
        e.stopPropagation();
        if ( e.button !== 0 ) return;
        if ( pending && pending.mode === "condition-to-target" ) return;

        if ( e.shiftKey ) toggleSelectCondition( id );
        else selectSingleOrKeepCondition( id, selectionConds.has( id ) );

        const selNodes = new Set( useAppStore.getState().selection );
        const selActions = new Set( useAppStore.getState().selectionActions );
        const selConds = new Set( useAppStore.getState().selectionConds );
        if ( !selConds.has( id ) ) selConds.add( id );

        const anchor = clientToRootGroupPoint( e );
        beginCombinedDrag( anchor, selNodes, selActions, selConds );
    }

    function onConditionDoubleClick( e: React.MouseEvent, id: number ) {
        e.stopPropagation();
        const cond = useAppStore.getState().conditions.find( ( c ) => c.id === id );
        if ( !cond ) return;
        const t = window.prompt( "Rename condition:", cond.title );
        if ( t != null ) renameCondition( id, t );
    }

    function onConditionContextMenu( e: React.MouseEvent, id: number ) {
        e.preventDefault();
        e.stopPropagation();
        if ( !selectionConds.has( id ) ) selectSingleOrKeepCondition( id, false );
        bus.openConditionMenu( e.clientX, e.clientY, id );
    }

    function renderOval( cx: number, cy: number, title: string, wrap: number | undefined, fill?: string, strokeCol?: string, textCol?: string ) {
        const m = measureActionOval( title, wrap ?? 22 );
        const rx = m.w / 2, ry = m.h / 2;
        const textX = cx;
        const textStartY = cy - ( m.lines.length - 1 ) * ( TITLE_LINE_H / 2 );
        const stroke = strokeCol ?? "#6366f1";
        const strokeWidth = 1.5;

        return (
            <>
                <ellipse cx={ cx } cy={ cy } rx={ rx } ry={ ry } fill={ fill ?? "#eef2ff" } stroke={ stroke } strokeWidth={ strokeWidth } />
                <text textAnchor="middle" x={ textX } y={ textStartY } style={ { fontSize: 16, fill: textCol ?? "#1e293b", userSelect: "none" } }>
                    { m.lines.map( ( line, i ) => (
                        <tspan key={ i } x={ textX } dy={ i === 0 ? 0 : TITLE_LINE_H }>{ line }</tspan>
                    ) ) }
                </text>
            </>
        );
    }

    return (
        <g data-layer="labels">
            {/* Acciones */ }
            { actions.map( ( a ) => {
                const isSel = selectionActions.has( a.id );

                // Para colocar el id centrado debajo de la elipse
                const m = measureActionOval( a.title, a.wrap ?? 22 );
                const ry = m.h / 2;
                const idY = a.y + ry - 1; // margen inferior (ajústalo si quieres)

                return (
                    <g
                        key={ `action-${a.id}` }
                        style={ { cursor: "inherit" } }
                        onMouseDown={ ( e ) => onActionMouseDown( e, a.id ) }
                        onDoubleClick={ ( e ) => onActionDoubleClick( e, a.id ) }
                        onContextMenu={ ( e ) => onActionContextMenu( e, a.id ) }
                    >
                        { renderOval( a.x, a.y, a.title, a.wrap, a.colorFill, a.colorStroke, a.colorText ) }

                        { isSel && ( () => {
                            const m2 = measureActionOval( a.title, a.wrap ?? 22 );
                            const rx2 = m2.w / 2, ry2 = m2.h / 2;
                            return (
                                <ellipse
                                    cx={ a.x }
                                    cy={ a.y }
                                    rx={ rx2 + 3 }
                                    ry={ ry2 + 3 }
                                    fill="none"
                                    stroke="#9ca3af"        // gris neutro
                                    strokeWidth={ 3 }
                                    strokeDasharray="4 8"
                                    pointerEvents="none"
                                />
                            );
                        } )() }

                        {/* ID centrado y debajo */ }
                        <text
                            textAnchor="middle"
                            x={ a.x }
                            y={ idY }
                            style={ { fontSize: 9, fill: "#64748b", userSelect: "none" } }
                        >
                            { a.id }
                        </text>
                    </g>
                );
            } ) }

            {/* Condiciones */ }
            { conditions.map( ( c ) => {
                const isSel = selectionConds.has( c.id );

                // Para colocar el id centrado debajo de la elipse
                const m = measureActionOval( c.title, c.wrap ?? 22 ); // o measureConditionOval(...)
                const ry = m.h / 2;
                const idY = c.y + ry - 1; // margen inferior (ajústalo si quieres)

                return (
                    <g
                        key={ `cond-${c.id}` }
                        style={ { cursor: "inherit" } }
                        onMouseDown={ ( e ) => onConditionMouseDown( e, c.id ) }
                        onDoubleClick={ ( e ) => onConditionDoubleClick( e, c.id ) }
                        onContextMenu={ ( e ) => onConditionContextMenu( e, c.id ) }
                    >
                        { renderOval( c.x, c.y, c.title, c.wrap, c.colorFill, c.colorStroke, c.colorText ) }

                        { isSel && ( () => {
                            const m2 = measureActionOval( c.title, c.wrap ?? 22 ); // o measureConditionOval si lo prefieres
                            const rx2 = m2.w / 2, ry2 = m2.h / 2;
                            return (
                                <ellipse
                                    cx={ c.x }
                                    cy={ c.y }
                                    rx={ rx2 + 3 }
                                    ry={ ry2 + 3 }
                                    fill="none"
                                    stroke="#9ca3af"        // gris neutro
                                    strokeWidth={ 3 }
                                    strokeDasharray="4 8"
                                    pointerEvents="none"
                                />
                            );
                        } )() }

                        {/* ID centrado y debajo */ }
                        <text
                            textAnchor="middle"
                            x={ c.x }
                            y={ idY }
                            style={ { fontSize: 9, fill: "#64748b", userSelect: "none" } }
                        >
                            { c.id }
                        </text>
                    </g>
                );
            } ) }
        </g>
    );
}
