// src/import/uitdl/incremental.ts
// Reconciles valid UITDL text into the visual canvas while preserving stable entities.

import { parseUITDL as parseInternalUITDL } from "./parser";
import { buildProjectFromAST } from "./build";
import type { AppState, ActionLabel, ConditionLabel, Edge, NodeBox } from "../../state/types";
import type { EdgeEndpoint } from "../../model/types";
import { buildFragmentGroups } from "../../fragments/fragmentModel";
import {
    createSequenceTraceCorrelationId,
    emitSequenceTrace,
} from "../../debug/sequenceTrace";

export type LiveSyncSelection = {
    nodes: Set<number>;
    actions: Set<number>;
    conditions: Set<number>;
};

export type IncrementalUITDLResult = {
    nodes: NodeBox[];
    actions: ActionLabel[];
    conditions: ConditionLabel[];
    edges: Edge[];
    fragmentTitles: Record<string, string>;
    nextId: number;
    nextActionId: number;
    nextEdgeId: number;
    beforeSelection: LiveSyncSelection;
    afterSelection: LiveSyncSelection;
    changedCount: number;
};

const emptySelection = (): LiveSyncSelection => ( {
    nodes: new Set<number>(),
    actions: new Set<number>(),
    conditions: new Set<number>(),
} );

const nodeDisplayId = ( node: NodeBox ) => ( node.displayId ?? String( node.id ) ).trim();

function nodePathKey( node: NodeBox, nodesById: Map<number, NodeBox> ): string {
    const parts: string[] = [];
    const seen = new Set<number>();
    let current: NodeBox | undefined = node;

    while ( current ) {
        if ( seen.has( current.id ) ) break;
        seen.add( current.id );
        parts.push( nodeDisplayId( current ) );
        const parentId: number | null = current.parentId ?? null;
        current = parentId == null ? undefined : nodesById.get( parentId );
    }

    return parts.reverse().join( "/" );
}

function nodeTitlePathKey( node: NodeBox, nodesById: Map<number, NodeBox> ): string {
    const parts: string[] = [];
    const seen = new Set<number>();
    let current: NodeBox | undefined = node;

    while ( current ) {
        if ( seen.has( current.id ) ) break;
        seen.add( current.id );
        parts.push( current.title.trim() );
        const parentId: number | null = current.parentId ?? null;
        current = parentId == null ? undefined : nodesById.get( parentId );
    }

    return parts.reverse().join( "/" );
}

function duplicateAwareKeys<T>( items: T[], baseKeyOf: ( item: T ) => string ): Map<T, string> {
    const countByBase = new Map<string, number>();
    const out = new Map<T, string>();

    for ( const item of items ) {
        const base = baseKeyOf( item );
        const index = countByBase.get( base ) ?? 0;
        countByBase.set( base, index + 1 );
        out.set( item, `${base}#${index}` );
    }

    return out;
}

function makeIndexes( input: {
    nodes: NodeBox[];
    actions: ActionLabel[];
    conditions: ConditionLabel[];
    edges: Edge[];
} ) {
    const nodesById = new Map( input.nodes.map( node => [ node.id, node ] ) );
    const nodeKeys = duplicateAwareKeys( input.nodes, node => nodePathKey( node, nodesById ) );
    const nodeKeyById = new Map<number, string>();
    for ( const [ node, key ] of nodeKeys ) nodeKeyById.set( node.id, key );

    const nodeTitleKeys = duplicateAwareKeys( input.nodes, node => nodeTitlePathKey( node, nodesById ) );
    const nodeTitleKeyById = new Map<number, string>();
    for ( const [ node, key ] of nodeTitleKeys ) nodeTitleKeyById.set( node.id, key );

    const actionKeys = duplicateAwareKeys( input.actions, action => {
        const originKey = nodeKeyById.get( action.originNodeId ) ?? `missing-node-${action.originNodeId}`;
        return `${originKey}::${action.verb}::${action.complement.trim()}`;
    } );
    const actionKeyById = new Map<number, string>();
    for ( const [ action, key ] of actionKeys ) actionKeyById.set( action.id, key );

    const conditionKeys = duplicateAwareKeys( input.conditions, condition => {
        const actionKey = actionKeyById.get( condition.originActionId ) ?? `missing-action-${condition.originActionId}`;
        return `${actionKey}::${condition.title.trim()}`;
    } );
    const conditionKeyById = new Map<number, string>();
    for ( const [ condition, key ] of conditionKeys ) conditionKeyById.set( condition.id, key );

    const endpointKey = ( endpoint: EdgeEndpoint ) => {
        if ( endpoint.kind === "node" ) return `node:${nodeKeyById.get( endpoint.id ) ?? endpoint.id}`;
        if ( endpoint.kind === "action" ) return `action:${actionKeyById.get( endpoint.id ) ?? endpoint.id}`;
        return `condition:${conditionKeyById.get( endpoint.id ) ?? endpoint.id}`;
    };
    const edgeKeys = duplicateAwareKeys(
        input.edges,
        edge => `${endpointKey( edge.from )}->${endpointKey( edge.to )}:${edge.style}`
    );
    const edgeKeyById = new Map<number, string>();
    for ( const [ edge, key ] of edgeKeys ) edgeKeyById.set( edge.id, key );

    return {
        nodeKeyById,
        nodeTitleKeyById,
        actionKeyById,
        conditionKeyById,
        edgeKeyById,
        nodeByKey: new Map( input.nodes.map( node => [ nodeKeyById.get( node.id )!, node ] ) ),
        nodeByTitleKey: new Map( input.nodes.map( node => [ nodeTitleKeyById.get( node.id )!, node ] ) ),
        actionByKey: new Map( input.actions.map( action => [ actionKeyById.get( action.id )!, action ] ) ),
        conditionByKey: new Map( input.conditions.map( condition => [ conditionKeyById.get( condition.id )!, condition ] ) ),
        edgeByKey: new Map( input.edges.map( edge => [ edgeKeyById.get( edge.id )!, edge ] ) ),
    };
}

function isSameNodeData( left: NodeBox, right: NodeBox ) {
    return left.title === right.title &&
        left.displayId === right.displayId &&
        left.parentId === right.parentId &&
        left.wrap === right.wrap;
}

function isSameActionData( left: ActionLabel, right: ActionLabel ) {
    return left.originNodeId === right.originNodeId &&
        left.verb === right.verb &&
        left.complement === right.complement &&
        left.title === right.title &&
        left.wrap === right.wrap;
}

function isSameConditionData( left: ConditionLabel, right: ConditionLabel ) {
    return left.originActionId === right.originActionId &&
        left.title === right.title &&
        left.wrap === right.wrap;
}

function isSameEdgeData( left: Edge, right: Edge ) {
    return left.style === right.style &&
        left.from.kind === right.from.kind &&
        left.from.id === right.from.id &&
        left.to.kind === right.to.kind &&
        left.to.id === right.to.id;
}

function actionStableKey( action: ActionLabel, originNodeId: number ) {
    return `${originNodeId}::${action.verb}::${action.complement.trim()}`;
}

function conditionStableKey( condition: ConditionLabel, originActionId: number ) {
    return `${originActionId}::${condition.title.trim()}`;
}

function endpointStableKey( endpoint: EdgeEndpoint ) {
    return `${endpoint.kind}:${endpoint.id}`;
}

function edgeStableKey( edge: Edge ) {
    return `${endpointStableKey( edge.from )}->${endpointStableKey( edge.to )}:${edge.style}`;
}

function remapEndpoint(
    endpoint: EdgeEndpoint,
    nodeIdMap: Map<number, number>,
    actionIdMap: Map<number, number>,
    conditionIdMap: Map<number, number>
): EdgeEndpoint {
    if ( endpoint.kind === "node" ) return { kind: "node", id: nodeIdMap.get( endpoint.id ) ?? endpoint.id };
    if ( endpoint.kind === "action" ) return { kind: "action", id: actionIdMap.get( endpoint.id ) ?? endpoint.id };
    return { kind: "condition", id: conditionIdMap.get( endpoint.id ) ?? endpoint.id };
}

function nextNumberAfter( values: number[], fallback: number ) {
    return values.length > 0 ? Math.max( ...values ) + 1 : fallback;
}

const NEW_ELEMENT_PLACEMENT_GAP = 32;
const PLACEMENT_SEARCH_LIMIT = 32;

type PlacementItem = {
    key: string;
    kind: "node" | "action" | "condition";
    id: number;
    x: number;
    y: number;
    w: number;
    h: number;
    parentId: number | null;
    groupKey: string | null;
    fragmentId: string | null;
};

type PlacementBounds = {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
};

function placementBoundsOf( items: PlacementItem[], offset = { x: 0, y: 0 } ): PlacementBounds {
    return items.reduce( ( bounds, item ) => ( {
        minX: Math.min( bounds.minX, item.x - item.w / 2 + offset.x ),
        minY: Math.min( bounds.minY, item.y - item.h / 2 + offset.y ),
        maxX: Math.max( bounds.maxX, item.x + item.w / 2 + offset.x ),
        maxY: Math.max( bounds.maxY, item.y + item.h / 2 + offset.y ),
    } ), {
        minX: Number.POSITIVE_INFINITY,
        minY: Number.POSITIVE_INFINITY,
        maxX: Number.NEGATIVE_INFINITY,
        maxY: Number.NEGATIVE_INFINITY,
    } );
}

function placementRectanglesOverlap( left: PlacementBounds, right: PlacementBounds ): boolean {
    return left.minX < right.maxX && left.maxX > right.minX &&
        left.minY < right.maxY && left.maxY > right.minY;
}

function isNodeAncestor( ancestorId: number, descendantId: number, parentByNodeId: Map<number, number | null> ) {
    let current = parentByNodeId.get( descendantId ) ?? null;
    const seen = new Set<number>();
    while ( current != null && !seen.has( current ) ) {
        if ( current === ancestorId ) return true;
        seen.add( current );
        current = parentByNodeId.get( current ) ?? null;
    }
    return false;
}

function placementCollisionIsAllowed(
    group: PlacementItem[],
    occupied: PlacementItem[],
    parentByNodeId: Map<number, number | null>
) {
    return group.every( groupItem => occupied.every( occupiedItem => {
        if ( groupItem.kind !== "node" || occupiedItem.kind !== "node" ) return false;
        return isNodeAncestor( groupItem.id, occupiedItem.id, parentByNodeId ) ||
            isNodeAncestor( occupiedItem.id, groupItem.id, parentByNodeId );
    } ) );
}

function placementCandidateCenters(
    anchor: PlacementBounds,
    item: PlacementItem
): Array<{ x: number; y: number }> {
    const centers: Array<{ x: number; y: number }> = [];
    const anchorCenterX = ( anchor.minX + anchor.maxX ) / 2;
    const anchorCenterY = ( anchor.minY + anchor.maxY ) / 2;
    const stepX = Math.max( item.w + NEW_ELEMENT_PLACEMENT_GAP, 48 );
    const stepY = Math.max( item.h + NEW_ELEMENT_PLACEMENT_GAP, 48 );

    for ( let layer = 0; layer <= PLACEMENT_SEARCH_LIMIT; layer++ ) {
        const offsetX = layer * stepX;
        const offsetY = layer * stepY;
        const sideRightX = anchor.maxX + NEW_ELEMENT_PLACEMENT_GAP + item.w / 2;
        const sideLeftX = anchor.minX - NEW_ELEMENT_PLACEMENT_GAP - item.w / 2;
        const sideBottomY = anchor.maxY + NEW_ELEMENT_PLACEMENT_GAP + item.h / 2;
        const sideTopY = anchor.minY - NEW_ELEMENT_PLACEMENT_GAP - item.h / 2;

        if ( layer === 0 ) {
            centers.push(
                { x: sideRightX, y: anchorCenterY },
                { x: sideLeftX, y: anchorCenterY },
                { x: anchorCenterX, y: sideBottomY },
                { x: anchorCenterX, y: sideTopY },
            );
            continue;
        }

        centers.push(
            { x: sideRightX, y: anchorCenterY - offsetY },
            { x: sideRightX, y: anchorCenterY + offsetY },
            { x: sideLeftX, y: anchorCenterY - offsetY },
            { x: sideLeftX, y: anchorCenterY + offsetY },
            { x: anchorCenterX - offsetX, y: sideBottomY },
            { x: anchorCenterX + offsetX, y: sideBottomY },
            { x: anchorCenterX - offsetX, y: sideTopY },
            { x: anchorCenterX + offsetX, y: sideTopY },
        );
    }

    return centers;
}

function placeNewElementsAtFragmentPeriphery(
    base: AppState,
    nodes: NodeBox[],
    actions: ActionLabel[],
    conditions: ConditionLabel[],
    edges: Edge[]
) {
    const baseNodeIds = new Set( base.nodes.map( node => node.id ) );
    const baseActionIds = new Set( base.actions.map( action => action.id ) );
    const baseConditionIds = new Set( base.conditions.map( condition => condition.id ) );
    const parentByNodeId = new Map( nodes.map( node => [ node.id, node.parentId ?? null ] ) );
    const newNodeIds = new Set( nodes.filter( node => !baseNodeIds.has( node.id ) ).map( node => node.id ) );
    const newActionIds = new Set( actions.filter( action => !baseActionIds.has( action.id ) ).map( action => action.id ) );
    const newConditionIds = new Set( conditions.filter( condition => !baseConditionIds.has( condition.id ) ).map( condition => condition.id ) );

    const placementItems: PlacementItem[] = [
        ...nodes.map( node => ( {
            key: `node:${node.id}`,
            kind: "node" as const,
            id: node.id,
            x: node.x,
            y: node.y,
            w: node.w ?? 40,
            h: node.h ?? 40,
            parentId: node.parentId ?? null,
            groupKey: newNodeIds.has( node.id ) ? `node:${node.id}` : null,
            fragmentId: null,
        } ) ),
        ...actions.map( action => ( {
            key: `action:${action.id}`,
            kind: "action" as const,
            id: action.id,
            x: action.x,
            y: action.y,
            w: action.w ?? 40,
            h: action.h ?? 40,
            parentId: null,
            groupKey: newActionIds.has( action.id ) ? `action:${action.id}` : null,
            fragmentId: null,
        } ) ),
        ...conditions.map( condition => ( {
            key: `condition:${condition.id}`,
            kind: "condition" as const,
            id: condition.id,
            x: condition.x,
            y: condition.y,
            w: condition.w ?? 40,
            h: condition.h ?? 40,
            parentId: null,
            groupKey: newConditionIds.has( condition.id ) ? `condition:${condition.id}` : null,
            fragmentId: null,
        } ) ),
    ];

    // Fragment membership depends on graph edges; use the final edge set to recover the
    // same connected fragment that the canvas will render after reconciliation.
    const fragmentIdByItemKey = new Map<string, string>();
    for ( const fragment of buildFragmentGroups( { nodes, actions, conditions, edges } ) ) {
        for ( const nodeId of fragment.nodeIds ) fragmentIdByItemKey.set( `node:${nodeId}`, fragment.id );
        for ( const actionId of fragment.actionIds ) fragmentIdByItemKey.set( `action:${actionId}`, fragment.id );
        for ( const conditionId of fragment.conditionIds ) fragmentIdByItemKey.set( `condition:${conditionId}`, fragment.id );
    }
    for ( const item of placementItems ) item.fragmentId = fragmentIdByItemKey.get( item.key ) ?? null;

    for ( const item of placementItems ) {
        if ( item.kind !== "node" || !item.groupKey || item.parentId == null ) continue;
        let parent = parentByNodeId.get( item.parentId ) ?? null;
        while ( parent != null && newNodeIds.has( parent ) ) {
            item.groupKey = `node:${parent}`;
            parent = parentByNodeId.get( parent ) ?? null;
        }
    }

    const occupied = placementItems.filter( item => item.groupKey == null );
    const groups = [ ...new Set( placementItems.flatMap( item => item.groupKey ? [ item.groupKey ] : [] ) ) ]
        .map( groupKey => placementItems.filter( item => item.groupKey === groupKey ) )
        .sort( ( left, right ) => {
            const leftBounds = placementBoundsOf( left );
            const rightBounds = placementBoundsOf( right );
            return leftBounds.minY - rightBounds.minY || leftBounds.minX - rightBounds.minX;
        } );

    for ( const group of groups ) {
        const fragmentId = group[ 0 ]?.fragmentId;
        const fragmentAnchors = placementItems.filter( item =>
            item.fragmentId === fragmentId && item.groupKey == null
        );

        if ( fragmentAnchors.length === 0 ) {
            console.info( "[UITDL] Kept generated placement for a new fragment.", {
                cause: "The fragment has no pre-existing canvas element to define a perimeter.",
                fallback: "Keep the deterministic position generated for the new fragment.",
                impact: "The new fragment remains available for the subsequent grid compaction.",
                fragmentId,
            } );
            occupied.push( ...group );
            continue;
        }

        const fragmentBounds = placementBoundsOf( fragmentAnchors );
        const groupBounds = placementBoundsOf( group );
        const groupCenterItem: PlacementItem = {
            ...group[ 0 ],
            x: ( groupBounds.minX + groupBounds.maxX ) / 2,
            y: ( groupBounds.minY + groupBounds.maxY ) / 2,
            w: groupBounds.maxX - groupBounds.minX,
            h: groupBounds.maxY - groupBounds.minY,
        };
        const placement = placementCandidateCenters( fragmentBounds, groupCenterItem ).find( center => {
            const candidateOffset = {
                x: center.x - groupCenterItem.x,
                y: center.y - groupCenterItem.y,
            };
            const candidateBounds = placementBoundsOf( group, candidateOffset );
            return occupied.every( occupiedItem => {
                if ( placementCollisionIsAllowed( group, [ occupiedItem ], parentByNodeId ) ) return true;
                return !placementRectanglesOverlap( candidateBounds, placementBoundsOf( [ occupiedItem ] ) );
            } );
        } );

        if ( !placement ) {
            console.warn( "[UITDL] Could not find a non-overlapping placement for new elements.", {
                cause: "The deterministic perimeter search exhausted its candidate positions.",
                fallback: "Keep the reconciled positions and let grid compaction resolve the fragment layout.",
                impact: "New elements may temporarily overlap existing elements.",
                groupKey: group[ 0 ]?.groupKey,
            } );
            occupied.push( ...group );
            continue;
        }

        const dx = placement.x - groupCenterItem.x;
        const dy = placement.y - groupCenterItem.y;
        for ( const item of group ) {
            item.x += dx;
            item.y += dy;
        }
        occupied.push( ...group );
    }

    const positionByKey = new Map( placementItems.map( item => [ item.key, { x: item.x, y: item.y } ] ) );
    return {
        nodes: nodes.map( node => ( { ...node, ...positionByKey.get( `node:${node.id}` ) } ) ),
        actions: actions.map( action => ( { ...action, ...positionByKey.get( `action:${action.id}` ) } ) ),
        conditions: conditions.map( condition => ( { ...condition, ...positionByKey.get( `condition:${condition.id}` ) } ) ),
    };
}

function isSameStringRecord( left: Record<string, string>, right: Record<string, string> ) {
    const leftKeys = Object.keys( left );
    const rightKeys = Object.keys( right );
    if ( leftKeys.length !== rightKeys.length ) return false;

    for ( const key of leftKeys ) {
        if ( left[ key ] !== right[ key ] ) return false;
    }

    return true;
}

function remapFragmentTitleKey(
    key: string,
    nodeIdMap: Map<number, number>,
    actionIdMap: Map<number, number>,
    conditionIdMap: Map<number, number>
): string {
    return key
        .split( "|" )
        .map( part => {
            const [ kind, rawId ] = part.split( ":" );
            const id = Number( rawId );
            if ( !Number.isFinite( id ) ) return part;
            if ( kind === "node" ) return `node:${nodeIdMap.get( id ) ?? id}`;
            if ( kind === "action" ) return `action:${actionIdMap.get( id ) ?? id}`;
            if ( kind === "condition" ) return `condition:${conditionIdMap.get( id ) ?? id}`;
            return part;
        } )
        .sort( ( left, right ) => left.localeCompare( right ) )
        .join( "|" );
}

function remapFragmentTitles(
    titles: Record<string, string>,
    nodeIdMap: Map<number, number>,
    actionIdMap: Map<number, number>,
    conditionIdMap: Map<number, number>
): Record<string, string> {
    const remapped: Record<string, string> = {};
    for ( const [ key, title ] of Object.entries( titles ) ) {
        remapped[ remapFragmentTitleKey( key, nodeIdMap, actionIdMap, conditionIdMap ) ] = title;
    }
    return remapped;
}

export function reconcileUITDLTextIncrementally(
    text: string,
    base: AppState
): IncrementalUITDLResult {
    const operation = "reconcileUITDLTextIncrementally";
    const correlationId = createSequenceTraceCorrelationId( operation );
    emitSequenceTrace( {
        kind: "entry",
        correlationId,
        from: "UITDLTextPanel",
        to: "UITDLIncrementalReconciler",
        operation,
        payload: {
            textLength: text.length,
            baseNodeCount: base.nodes.length,
            baseActionCount: base.actions.length,
            baseConditionCount: base.conditions.length,
            baseEdgeCount: base.edges.length,
        },
    } );

    try {
    const ast = parseInternalUITDL( text );
    const parseErrors = ( ast.issues ?? [] ).filter( issue => issue.kind === "error" );
    if ( parseErrors.length > 0 ) throw new Error( "Live UITDL sync requires parseable text." );

    const built = buildProjectFromAST( ast, base, { materializeUnusedDeclaredActions: false } );
    const previous = makeIndexes( base );
    const incoming = makeIndexes( built );

    const beforeSelection = emptySelection();
    const afterSelection = emptySelection();
    let changedCount = 0;

    let nextNodeId = Math.max( base.nextId, nextNumberAfter( base.nodes.map( node => node.id ), 1 ) );
    let nextActionId = Math.max( base.nextActionId, nextNumberAfter( base.actions.map( action => action.id ), 1 ) );
    let nextConditionId = Math.max(
        base.nextId,
        nextNumberAfter( [
            ...base.nodes.map( node => node.id ),
            ...base.conditions.map( condition => condition.id ),
        ], 1 )
    );
    let nextEdgeId = Math.max( base.nextEdgeId, nextNumberAfter( base.edges.map( edge => edge.id ), 1 ) );

    const nodeIdMap = new Map<number, number>();
    const actionIdMap = new Map<number, number>();
    const conditionIdMap = new Map<number, number>();
    const usedPreviousNodeIds = new Set<number>();
    const usedPreviousActionIds = new Set<number>();
    const usedPreviousConditionIds = new Set<number>();

    for ( const node of built.nodes ) {
        const key = incoming.nodeKeyById.get( node.id )!;
        const matched = previous.nodeByKey.get( key );
        if ( matched && !usedPreviousNodeIds.has( matched.id ) ) {
            nodeIdMap.set( node.id, matched.id );
            usedPreviousNodeIds.add( matched.id );
        }
    }
    for ( const node of built.nodes ) {
        if ( nodeIdMap.has( node.id ) ) continue;
        const key = incoming.nodeTitleKeyById.get( node.id )!;
        const matched = previous.nodeByTitleKey.get( key );
        if ( matched && !usedPreviousNodeIds.has( matched.id ) ) {
            nodeIdMap.set( node.id, matched.id );
            usedPreviousNodeIds.add( matched.id );
        }
    }
    for ( const node of built.nodes ) {
        if ( nodeIdMap.has( node.id ) ) continue;
        nodeIdMap.set( node.id, nextNodeId++ );
    }

    const previousActionByStableKey = new Map(
        base.actions.map( action => [ actionStableKey( action, action.originNodeId ), action ] )
    );
    for ( const action of built.actions ) {
        const key = incoming.actionKeyById.get( action.id )!;
        const matched = previous.actionByKey.get( key );
        if ( matched && !usedPreviousActionIds.has( matched.id ) ) {
            actionIdMap.set( action.id, matched.id );
            usedPreviousActionIds.add( matched.id );
        }
    }
    for ( const action of built.actions ) {
        if ( actionIdMap.has( action.id ) ) continue;
        const originNodeId = nodeIdMap.get( action.originNodeId ) ?? action.originNodeId;
        const matched = previousActionByStableKey.get( actionStableKey( action, originNodeId ) );
        if ( matched && !usedPreviousActionIds.has( matched.id ) ) {
            actionIdMap.set( action.id, matched.id );
            usedPreviousActionIds.add( matched.id );
        }
    }
    for ( const action of built.actions ) {
        if ( actionIdMap.has( action.id ) ) continue;
        actionIdMap.set( action.id, nextActionId++ );
    }

    const previousConditionByStableKey = new Map(
        base.conditions.map( condition => [ conditionStableKey( condition, condition.originActionId ), condition ] )
    );
    for ( const condition of built.conditions ) {
        const key = incoming.conditionKeyById.get( condition.id )!;
        const matched = previous.conditionByKey.get( key );
        if ( matched && !usedPreviousConditionIds.has( matched.id ) ) {
            conditionIdMap.set( condition.id, matched.id );
            usedPreviousConditionIds.add( matched.id );
        }
    }
    for ( const condition of built.conditions ) {
        if ( conditionIdMap.has( condition.id ) ) continue;
        const originActionId = actionIdMap.get( condition.originActionId ) ?? condition.originActionId;
        const matched = previousConditionByStableKey.get( conditionStableKey( condition, originActionId ) );
        if ( matched && !usedPreviousConditionIds.has( matched.id ) ) {
            conditionIdMap.set( condition.id, matched.id );
            usedPreviousConditionIds.add( matched.id );
        }
    }
    for ( const condition of built.conditions ) {
        if ( conditionIdMap.has( condition.id ) ) continue;
        conditionIdMap.set( condition.id, nextConditionId++ );
    }

    const fragmentTitles = remapFragmentTitles(
        built.fragmentTitles ?? {},
        nodeIdMap,
        actionIdMap,
        conditionIdMap
    );
    if ( !isSameStringRecord( base.fragmentTitles ?? {}, fragmentTitles ) ) changedCount++;

    const previousNodeById = new Map( base.nodes.map( node => [ node.id, node ] ) );
    const previousActionById = new Map( base.actions.map( action => [ action.id, action ] ) );
    const previousConditionById = new Map( base.conditions.map( condition => [ condition.id, condition ] ) );

    const nodes = built.nodes.map( node => {
        const id = nodeIdMap.get( node.id )!;
        const matched = previousNodeById.get( id );
        const parentId = node.parentId == null ? null : nodeIdMap.get( node.parentId ) ?? null;
        const next: NodeBox = matched
            ? {
                ...node,
                id,
                parentId,
                x: matched.x,
                y: matched.y,
                colorFill: matched.colorFill,
                colorStroke: matched.colorStroke,
                colorText: matched.colorText,
            }
            : { ...node, id, parentId };

        if ( !matched ) {
            afterSelection.nodes.add( id );
            changedCount++;
        } else if ( !isSameNodeData( matched, next ) ) {
            beforeSelection.nodes.add( matched.id );
            afterSelection.nodes.add( id );
            changedCount++;
        }
        return next;
    } );

    const actions = built.actions.map( action => {
        const id = actionIdMap.get( action.id )!;
        const matched = previousActionById.get( id );
        const originNodeId = nodeIdMap.get( action.originNodeId ) ?? action.originNodeId;
        const next: ActionLabel = matched
            ? {
                ...action,
                id,
                originNodeId,
                x: matched.x,
                y: matched.y,
                colorFill: matched.colorFill,
                colorStroke: matched.colorStroke,
                colorText: matched.colorText,
            }
            : { ...action, id, originNodeId };

        if ( !matched ) {
            afterSelection.actions.add( id );
            afterSelection.nodes.add( originNodeId );
            changedCount++;
        } else if ( !isSameActionData( matched, next ) ) {
            beforeSelection.actions.add( matched.id );
            afterSelection.actions.add( id );
            changedCount++;
        }
        return next;
    } );

    const conditions = built.conditions.map( condition => {
        const id = conditionIdMap.get( condition.id )!;
        const matched = previousConditionById.get( id );
        const originActionId = actionIdMap.get( condition.originActionId ) ?? condition.originActionId;
        const next: ConditionLabel = matched
            ? {
                ...condition,
                id,
                originActionId,
                x: matched.x,
                y: matched.y,
                colorFill: matched.colorFill,
                colorStroke: matched.colorStroke,
                colorText: matched.colorText,
            }
            : { ...condition, id, originActionId };

        if ( !matched ) {
            afterSelection.conditions.add( id );
            afterSelection.actions.add( originActionId );
            changedCount++;
        } else if ( !isSameConditionData( matched, next ) ) {
            beforeSelection.conditions.add( matched.id );
            afterSelection.conditions.add( id );
            changedCount++;
        }
        return next;
    } );

    const finalNodeIds = new Set( nodes.map( node => node.id ) );
    const finalActionIds = new Set( actions.map( action => action.id ) );
    const finalConditionIds = new Set( conditions.map( condition => condition.id ) );

    for ( const node of base.nodes ) {
        if ( !finalNodeIds.has( node.id ) ) {
            beforeSelection.nodes.add( node.id );
            changedCount++;
        }
    }
    for ( const action of base.actions ) {
        if ( !finalActionIds.has( action.id ) ) {
            beforeSelection.actions.add( action.id );
            changedCount++;
        }
    }
    for ( const condition of base.conditions ) {
        if ( !finalConditionIds.has( condition.id ) ) {
            beforeSelection.conditions.add( condition.id );
            changedCount++;
        }
    }

    const previousEdgeStableKeys = duplicateAwareKeys( base.edges, edgeStableKey );
    const previousEdgeByStableKey = new Map(
        base.edges.map( edge => [ previousEdgeStableKeys.get( edge )!, edge ] )
    );
    const incomingEdgeStableKeys = duplicateAwareKeys( built.edges, edge => edgeStableKey( {
        ...edge,
        from: remapEndpoint( edge.from, nodeIdMap, actionIdMap, conditionIdMap ),
        to: remapEndpoint( edge.to, nodeIdMap, actionIdMap, conditionIdMap ),
    } ) );

    const edges = built.edges.map( edge => {
        const key = incomingEdgeStableKeys.get( edge )!;
        const matched = previousEdgeByStableKey.get( key );
        const id = matched?.id ?? nextEdgeId++;
        const next: Edge = {
            id,
            from: remapEndpoint( edge.from, nodeIdMap, actionIdMap, conditionIdMap ),
            to: remapEndpoint( edge.to, nodeIdMap, actionIdMap, conditionIdMap ),
            style: edge.style,
        };

        if ( !matched ) {
            if ( next.from.kind === "node" ) afterSelection.nodes.add( next.from.id );
            if ( next.from.kind === "action" ) afterSelection.actions.add( next.from.id );
            if ( next.from.kind === "condition" ) afterSelection.conditions.add( next.from.id );
            if ( next.to.kind === "node" ) afterSelection.nodes.add( next.to.id );
            if ( next.to.kind === "action" ) afterSelection.actions.add( next.to.id );
            if ( next.to.kind === "condition" ) afterSelection.conditions.add( next.to.id );
            changedCount++;
        } else if ( !isSameEdgeData( matched, next ) ) {
            changedCount++;
        }
        return next;
    } );

    const finalEdgeIds = new Set( edges.map( edge => edge.id ) );
    for ( const edge of base.edges ) {
        if ( finalEdgeIds.has( edge.id ) ) continue;
        if ( edge.from.kind === "node" ) beforeSelection.nodes.add( edge.from.id );
        if ( edge.from.kind === "action" ) beforeSelection.actions.add( edge.from.id );
        if ( edge.from.kind === "condition" ) beforeSelection.conditions.add( edge.from.id );
        if ( edge.to.kind === "node" ) beforeSelection.nodes.add( edge.to.id );
        if ( edge.to.kind === "action" ) beforeSelection.actions.add( edge.to.id );
        if ( edge.to.kind === "condition" ) beforeSelection.conditions.add( edge.to.id );
        changedCount++;
    }

    const placed = placeNewElementsAtFragmentPeriphery( base, nodes, actions, conditions, edges );

    const result = {
        nodes: placed.nodes,
        actions: placed.actions,
        conditions: placed.conditions,
        edges,
        fragmentTitles,
        nextId: Math.max(
            nextNodeId,
            nextConditionId,
            nextNumberAfter( [
                ...nodes.map( node => node.id ),
                ...conditions.map( condition => condition.id ),
            ], 1 )
        ),
        nextActionId: Math.max( nextActionId, nextNumberAfter( actions.map( action => action.id ), 1 ) ),
        nextEdgeId: Math.max( nextEdgeId, nextNumberAfter( edges.map( edge => edge.id ), 1 ) ),
        beforeSelection,
        afterSelection,
        changedCount,
    };

    emitSequenceTrace( {
        kind: "exit",
        correlationId,
        from: "UITDLIncrementalReconciler",
        to: "UITDLTextPanel",
        operation,
        outcome: "response",
        payload: {
            nodeCount: result.nodes.length,
            actionCount: result.actions.length,
            conditionCount: result.conditions.length,
            edgeCount: result.edges.length,
            changedCount: result.changedCount,
        },
    } );

    return result;
    } catch ( error ) {
        emitSequenceTrace( {
            kind: "exit",
            correlationId,
            from: "UITDLIncrementalReconciler",
            to: "UITDLTextPanel",
            operation,
            outcome: "error",
            payload: {
                error: error instanceof Error ? error.message : String( error ),
            },
        } );
        throw error;
    }
}
