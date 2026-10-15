// Computes a bounded camera that centers the current canvas selection.

import type { ActionLabel, ConditionLabel, NodeBox } from "../model/types";
import {
    getActionRect,
    getConditionRect,
    getNodeRect,
    type SelectionRect,
} from "./selectionRect";
import { MAX_CANVAS_ZOOM, MIN_CANVAS_ZOOM } from "./slices/camera.slice";

const SELECTION_FIT_VIEWPORT_RATIO = 0.8;
const MIN_SELECTION_FIT_ZOOM = 0.08;
const MAX_SELECTION_FIT_ZOOM = 12;

export type SelectionMembership = {
    nodes: ReadonlySet<number>;
    actions: ReadonlySet<number>;
    conditions: ReadonlySet<number>;
};

export type SelectionCameraState = {
    nodes: NodeBox[];
    actions: ActionLabel[];
    conditions: ConditionLabel[];
    viewBox: { w: number; h: number };
    canvasFitZoom: number;
};

export type SelectionCamera = { x: number; y: number; zoom: number };

function unionRect( rects: SelectionRect[] ): SelectionRect | null {
    if ( rects.length === 0 ) return null;
    const minX = Math.min( ...rects.map( rect => rect.x ) );
    const minY = Math.min( ...rects.map( rect => rect.y ) );
    const maxX = Math.max( ...rects.map( rect => rect.x + rect.w ) );
    const maxY = Math.max( ...rects.map( rect => rect.y + rect.h ) );
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

export function selectionRectOf(
    state: SelectionCameraState,
    selection: SelectionMembership
): SelectionRect | null {
    const rects: SelectionRect[] = [];

    for ( const node of state.nodes ) {
        if ( selection.nodes.has( node.id ) ) rects.push( getNodeRect( node ) );
    }
    for ( const action of state.actions ) {
        if ( selection.actions.has( action.id ) ) rects.push( getActionRect( action ) );
    }
    for ( const condition of state.conditions ) {
        if ( selection.conditions.has( condition.id ) ) rects.push( getConditionRect( condition ) );
    }

    return unionRect( rects );
}

function fitRelativeSelectionZoomOf( requestedZoom: number, fitZoom: number ): number {
    const safeFitZoom = Number.isFinite( fitZoom ) && fitZoom > 0 ? fitZoom : 1;
    const minZoom = Math.max( MIN_SELECTION_FIT_ZOOM, safeFitZoom * MIN_CANVAS_ZOOM );
    const maxZoom = Math.min( MAX_SELECTION_FIT_ZOOM, safeFitZoom * MAX_CANVAS_ZOOM );
    if ( maxZoom < minZoom ) return maxZoom;
    return Math.min( maxZoom, Math.max( minZoom, requestedZoom ) );
}

export function centerCameraOfSelection(
    state: SelectionCameraState,
    selection: SelectionMembership
): SelectionCamera | null {
    const rect = selectionRectOf( state, selection );
    if ( !rect ) return null;

    const viewWidth = state.viewBox.w || 800;
    const viewHeight = state.viewBox.h || 600;
    const rawZoom = Math.min(
        viewWidth * SELECTION_FIT_VIEWPORT_RATIO / Math.max( 1, rect.w ),
        viewHeight * SELECTION_FIT_VIEWPORT_RATIO / Math.max( 1, rect.h )
    );
    const zoom = Number.isFinite( rawZoom ) && rawZoom > 0
        ? fitRelativeSelectionZoomOf( rawZoom, state.canvasFitZoom )
        : 1;
    const centerX = rect.x + rect.w / 2;
    const centerY = rect.y + rect.h / 2;

    return {
        x: viewWidth / 2 - zoom * centerX,
        y: viewHeight / 2 - zoom * centerY,
        zoom,
    };
}
