// src/components/Canvas/ElementWidthHandle.tsx
// Provides zoom-aware right-edge resizing with live wrapping and one undo entry per drag.

import { useEffect, useRef, type PointerEvent } from "react";
import type { DiagramFocusTarget } from "../../state/types";
import { useAppStore } from "../../state/store";
import { resizeElementWidth } from "../../state/elementWidth";
import { newElementSelection } from "../../state/newElementSelection";
import "./elementWidthHandle.css";

export function ElementWidthHandle( { target, x, y, width, height }: {
    target: NonNullable<DiagramFocusTarget>;
    x: number; y: number; width: number; height: number;
} ) {
    const locked = useAppStore( s => s.isCanvasLockedByUITDLLiveSync );
    const pending = useAppStore( s => s.pendingConnect != null );
    const finishRef = useRef<null | ( ( cancel?: boolean ) => void )>( null );
    useEffect( () => () => finishRef.current?.(), [] );

    const beginResize = ( event: PointerEvent<SVGRectElement> ) => {
        event.preventDefault();
        event.stopPropagation();
        if ( event.button !== 0 || locked || pending ) return;
        const matrix = event.currentTarget.getScreenCTM();
        if ( !matrix ) {
            console.warn( "Cannot resize element without a screen transform.", {
                cause: "SVG screen transform unavailable", fallback: "Keep current width", impact: "Resize drag was not started",
            } );
            return;
        }
        const inverse = matrix.inverse();
        const startX = event.clientX;
        const startY = event.clientY;
        const pointerId = event.pointerId;
        finishRef.current?.();
        const before = useAppStore.getState();
        const ownsSession = before.editingSession == null;
        if ( ownsSession ) before.beginEditingSession( [ "nodes", "actions", "conditions" ] );
        useAppStore.setState( newElementSelection( target ) );
        const move = ( next: globalThis.PointerEvent ) => {
            if ( next.pointerId !== pointerId ) return;
            next.preventDefault();
            const dx = inverse.a * ( next.clientX - startX ) + inverse.c * ( next.clientY - startY );
            resizeElementWidth( target, width + dx );
        };
        const finish = ( cancel = false ) => {
            window.removeEventListener( "pointermove", move );
            window.removeEventListener( "pointerup", release );
            window.removeEventListener( "pointercancel", cancelDrag );
            window.removeEventListener( "keydown", key, true );
            window.removeEventListener( "blur", release );
            if ( cancel ) useAppStore.setState( { nodes: before.nodes, actions: before.actions, conditions: before.conditions } );
            if ( ownsSession ) useAppStore.getState().commitEditingSession();
            finishRef.current = null;
        };
        const release = () => finish();
        const cancelDrag = () => finish( true );
        const key = ( next: KeyboardEvent ) => {
            next.stopPropagation();
            if ( next.key === "Escape" ) { next.preventDefault(); finish( true ); }
            if ( next.ctrlKey || next.metaKey ) next.preventDefault();
        };
        finishRef.current = finish;
        window.addEventListener( "pointermove", move, { passive: false } );
        window.addEventListener( "pointerup", release );
        window.addEventListener( "pointercancel", cancelDrag );
        window.addEventListener( "keydown", key, true );
        window.addEventListener( "blur", release );
    };

    if ( locked || pending ) return null;
    const right = x + width / 2;
    return (
        <g className="elementWidthControl" data-export="ignore">
            <rect className="elementWidthHandle" x={ right - 6 } y={ y - height / 2 }
                width={ 12 } height={ height } role="separator" aria-orientation="vertical"
                aria-label={ `Resize ${target.kind} width` } aria-valuenow={ Math.round( width ) }
                tabIndex={ 0 } onPointerDown={ beginResize }
                onMouseDown={ event => event.stopPropagation() }
                onDoubleClick={ event => event.stopPropagation() }
                onKeyDown={ event => {
                    if ( event.key !== "ArrowLeft" && event.key !== "ArrowRight" ) return;
                    event.preventDefault(); event.stopPropagation();
                    resizeElementWidth( target, width + ( event.key === "ArrowRight" ? 9 : -9 ) );
                } }>
                <title>Drag the right edge to wrap text. Use Left/Right arrows when focused.</title>
            </rect>
            <path className="elementWidthGrip" d={ `M ${right} ${y - 9} V ${y + 9}` } />
        </g>
    );
}
