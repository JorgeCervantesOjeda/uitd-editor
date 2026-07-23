// src/fragments/fragmentBounds.ts
// Computes visible canvas bounds for connected fragment groups.

import type { ActionLabel, ConditionLabel, Edge, NodeBox } from "../model/types";
import {
    getActionSizeCached,
    getConditionSizeCached,
    getNodeSizeCached,
} from "../layout/measurement";
import { buildFragmentGroups, resolveFragmentTitle } from "./fragmentModel";

export const FRAGMENT_FRAME_PADDING = 34;

export type FragmentBounds = {
    id: string;
    title: string;
    nodeIds: number[];
    actionIds: number[];
    conditionIds: number[];
    x: number;
    y: number;
    w: number;
    h: number;
};

type AccumulatedBounds = {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
};

function expandFragmentBounds(
    bounds: AccumulatedBounds,
    x: number,
    y: number,
    w: number,
    h: number
): void {
    bounds.minX = Math.min( bounds.minX, x - w / 2 );
    bounds.minY = Math.min( bounds.minY, y - h / 2 );
    bounds.maxX = Math.max( bounds.maxX, x + w / 2 );
    bounds.maxY = Math.max( bounds.maxY, y + h / 2 );
}

export function buildFragmentBounds( input: {
    nodes: NodeBox[];
    actions: ActionLabel[];
    conditions: ConditionLabel[];
    edges: Edge[];
    fragmentTitles?: Record<string, string>;
} ): FragmentBounds[] {
    const { nodes, actions, conditions, edges, fragmentTitles } = input;
    const groups = buildFragmentGroups( { nodes, actions, conditions, edges } );
    const nodesById = new Map( nodes.map( n => [ n.id, n ] ) );
    const actionsById = new Map( actions.map( a => [ a.id, a ] ) );
    const conditionsById = new Map( conditions.map( c => [ c.id, c ] ) );

    return groups
        .map( ( group, idx ) => {
            const bounds: AccumulatedBounds = {
                minX: Number.POSITIVE_INFINITY,
                minY: Number.POSITIVE_INFINITY,
                maxX: Number.NEGATIVE_INFINITY,
                maxY: Number.NEGATIVE_INFINITY,
            };

            for ( const nodeId of group.nodeIds ) {
                const node = nodesById.get( nodeId );
                if ( !node ) continue;
                const measured = getNodeSizeCached( node );
                expandFragmentBounds( bounds, node.x, node.y, measured.w, measured.h );
            }

            for ( const actionId of group.actionIds ) {
                const action = actionsById.get( actionId );
                if ( !action ) continue;
                const measured = getActionSizeCached( action );
                expandFragmentBounds( bounds, action.x, action.y, measured.w, measured.h );
            }

            for ( const conditionId of group.conditionIds ) {
                const condition = conditionsById.get( conditionId );
                if ( !condition ) continue;
                const measured = getConditionSizeCached( condition );
                expandFragmentBounds( bounds, condition.x, condition.y, measured.w, measured.h );
            }

            if ( !Number.isFinite( bounds.minX ) || !Number.isFinite( bounds.minY ) ) return null;

            return {
                id: group.id,
                title: resolveFragmentTitle( fragmentTitles, group.id, idx ),
                nodeIds: group.nodeIds,
                actionIds: group.actionIds,
                conditionIds: group.conditionIds,
                x: bounds.minX - FRAGMENT_FRAME_PADDING,
                y: bounds.minY - FRAGMENT_FRAME_PADDING,
                w: bounds.maxX - bounds.minX + 2 * FRAGMENT_FRAME_PADDING,
                h: bounds.maxY - bounds.minY + 2 * FRAGMENT_FRAME_PADDING,
            };
        } )
        .filter( ( fragment ): fragment is FragmentBounds => fragment != null );
}
