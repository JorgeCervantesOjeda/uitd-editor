// src/import/uitdl/incremental.ts
// Reconciles valid UITDL text into the visual canvas while preserving stable entities.

import { parseUITDL as parseInternalUITDL } from "./parser";
import { buildProjectFromAST } from "./build";
import type { AppState, ActionLabel, ConditionLabel, Edge, NodeBox } from "../../state/types";
import type { EdgeEndpoint } from "../../model/types";

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
        actionKeyById,
        conditionKeyById,
        edgeKeyById,
        nodeByKey: new Map( input.nodes.map( node => [ nodeKeyById.get( node.id )!, node ] ) ),
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

    for ( const node of built.nodes ) {
        const key = incoming.nodeKeyById.get( node.id )!;
        const matched = previous.nodeByKey.get( key );
        if ( matched ) nodeIdMap.set( node.id, matched.id );
        else nodeIdMap.set( node.id, nextNodeId++ );
    }

    for ( const action of built.actions ) {
        const key = incoming.actionKeyById.get( action.id )!;
        const matched = previous.actionByKey.get( key );
        if ( matched ) actionIdMap.set( action.id, matched.id );
        else actionIdMap.set( action.id, nextActionId++ );
    }

    for ( const condition of built.conditions ) {
        const key = incoming.conditionKeyById.get( condition.id )!;
        const matched = previous.conditionByKey.get( key );
        if ( matched ) conditionIdMap.set( condition.id, matched.id );
        else conditionIdMap.set( condition.id, nextConditionId++ );
    }

    const fragmentTitles = remapFragmentTitles(
        built.fragmentTitles ?? {},
        nodeIdMap,
        actionIdMap,
        conditionIdMap
    );
    if ( !isSameStringRecord( base.fragmentTitles ?? {}, fragmentTitles ) ) changedCount++;

    const nodes = built.nodes.map( node => {
        const key = incoming.nodeKeyById.get( node.id )!;
        const matched = previous.nodeByKey.get( key );
        const id = nodeIdMap.get( node.id )!;
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
        const key = incoming.actionKeyById.get( action.id )!;
        const matched = previous.actionByKey.get( key );
        const id = actionIdMap.get( action.id )!;
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
        const key = incoming.conditionKeyById.get( condition.id )!;
        const matched = previous.conditionByKey.get( key );
        const id = conditionIdMap.get( condition.id )!;
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

    const edges = built.edges.map( edge => {
        const key = incoming.edgeKeyById.get( edge.id )!;
        const matched = previous.edgeByKey.get( key );
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

    return {
        nodes,
        actions,
        conditions,
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
}
