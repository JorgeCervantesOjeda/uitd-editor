import type { ActionLabel, ConditionLabel, NodeBox } from "../model/types";
import type { DiagramFocusTarget } from "./types";
import { getNodeSizeCached, measureActionOval, measureConditionOval } from "../layout/measurement";

export type SelectionRect = { x: number; y: number; w: number; h: number };

export function normalizeSelectionRect( rect: SelectionRect ): SelectionRect {
    const minX = Math.min( rect.x, rect.x + rect.w );
    const maxX = Math.max( rect.x, rect.x + rect.w );
    const minY = Math.min( rect.y, rect.y + rect.h );
    const maxY = Math.max( rect.y, rect.y + rect.h );
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

export function getNodeRect( node: NodeBox ): SelectionRect {
    const size = getNodeSizeCached( node );
    return {
        x: node.x - size.w / 2,
        y: node.y - size.h / 2,
        w: size.w,
        h: size.h,
    };
}

export function getActionRect( action: ActionLabel ): SelectionRect {
    const size = measureActionOval( action.title, action.wrap ?? 22 );
    return {
        x: action.x - size.w / 2,
        y: action.y - size.h / 2,
        w: size.w,
        h: size.h,
    };
}

export function getConditionRect( condition: ConditionLabel ): SelectionRect {
    const size = measureConditionOval( condition.title, condition.wrap ?? 22 );
    return {
        x: condition.x - size.w / 2,
        y: condition.y - size.h / 2,
        w: size.w,
        h: size.h,
    };
}

function intersects( a: SelectionRect, b: SelectionRect ) {
    return !( a.x + a.w < b.x || a.x > b.x + b.w || a.y + a.h < b.y || a.y > b.y + b.h );
}

export function computeSelectionIntersectingRect(
    nodes: NodeBox[],
    actions: ActionLabel[],
    conditions: ConditionLabel[],
    rect: SelectionRect,
) {
    const normalized = normalizeSelectionRect( rect );
    const selection = new Set<number>();
    const selectionActions = new Set<number>();
    const selectionConds = new Set<number>();

    for ( const node of nodes ) {
        if ( intersects( getNodeRect( node ), normalized ) ) selection.add( node.id );
    }

    for ( const action of actions ) {
        if ( intersects( getActionRect( action ), normalized ) ) selectionActions.add( action.id );
    }

    for ( const condition of conditions ) {
        if ( intersects( getConditionRect( condition ), normalized ) ) selectionConds.add( condition.id );
    }

    return {
        selection,
        selectionActions,
        selectionConds,
        rect: normalized,
    };
}

export function getFirstTargetInSelection(
    nodes: NodeBox[],
    actions: ActionLabel[],
    conditions: ConditionLabel[],
    selection: Set<number>,
    selectionActions: Set<number>,
    selectionConds: Set<number>,
): NonNullable<DiagramFocusTarget> | null {
    const candidates: Array<NonNullable<DiagramFocusTarget> & { x: number; y: number }> = [];

    for ( const node of nodes ) {
        if ( selection.has( node.id ) ) candidates.push( { kind: "node", id: node.id, x: node.x, y: node.y } );
    }

    for ( const action of actions ) {
        if ( selectionActions.has( action.id ) ) candidates.push( { kind: "action", id: action.id, x: action.x, y: action.y } );
    }

    for ( const condition of conditions ) {
        if ( selectionConds.has( condition.id ) ) candidates.push( { kind: "condition", id: condition.id, x: condition.x, y: condition.y } );
    }

    candidates.sort( ( a, b ) => a.y - b.y || a.x - b.x );
    const first = candidates[ 0 ];
    return first ? { kind: first.kind, id: first.id } : null;
}
