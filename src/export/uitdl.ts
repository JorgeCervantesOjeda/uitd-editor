// src/export/uitdl.ts
// Exports the visual diagram as UITDL text and optional source locations.

import type { AppState } from "../state/types";
import type { UiVerb } from "../model/types";
import { buildFragmentGroups, resolveFragmentTitle } from "../fragments/fragmentModel";

export type UITDLExportOptions = {
    title?: string;
    fragmentBaseName?: string;
};

type UIKey = string;

type TransitionRecord = {
    actionId: number;
    conditionId?: number;
    srcKey: UIKey;
    dstKey: UIKey;
    srcNodeId: number;
    dstNodeId: number;
    actVerb: UiVerb;
    actComplement: string;
    condLabel?: string;
};

type FragmentInfo = {
    id: string;
    nodeIds: number[];
    actionIds: number[];
    conditionIds: number[];
};

export type UITDLSourceLocation = {
    lineNumber: number;
    column: number;
    endColumn: number;
};

export type UITDLFragmentSourceLocation = UITDLSourceLocation & {
    id: string;
    nodeIds: number[];
    actionIds: number[];
    conditionIds: number[];
};

export type UITDLSourceMap = {
    nodes: Map<number, UITDLSourceLocation[]>;
    actions: Map<number, UITDLSourceLocation[]>;
    conditions: Map<number, UITDLSourceLocation[]>;
    fragments: UITDLFragmentSourceLocation[];
};

export type UITDLExportResult = {
    text: string;
    locations: UITDLSourceMap;
};

const q = ( s: string ): string =>
    `"${( s ?? "" )
        // OJO: el usuario pidió NO permitir comillas escapadas en el editor.
        // Aquí escapamos por robustez del export (si llegara a colarse),
        // pero idealmente nunca habrá " ni \ en complement.
        .replace( /\\/g, "\\\\" )
        .replace( /"/g, '\\"' )}"`;

function actionToUtdl( verb: UiVerb, complement: string ): string | null {
    const v = verb;
    const c = ( complement ?? "" ).trim();
    if ( !v ) return null;
    if ( !c ) return null;
    return `${v} ${q( c )}`;
}

function addLocation(
    locations: Map<number, UITDLSourceLocation[]>,
    id: number,
    location: UITDLSourceLocation
) {
    const existing = locations.get( id ) ?? [];
    existing.push( location );
    locations.set( id, existing );
}

export function exportToUITDLWithLocations(
    state: AppState,
    options: UITDLExportOptions = {}
): UITDLExportResult {
    const title = options.title ?? "UITD Diagram";
    const fragmentBase = options.fragmentBaseName ?? "Fragment";

    const { nodes, actions, conditions, edges } = state;
    const locations: UITDLSourceMap = {
        nodes: new Map(),
        actions: new Map(),
        conditions: new Map(),
        fragments: [],
    };
    const lines: string[] = [];
    const pushLine = ( line: string ): number => {
        lines.push( line );
        return lines.length;
    };

    const nodesById = new Map<number, ( typeof nodes )[ number ]>();
    nodes.forEach( ( n ) => nodesById.set( n.id, n ) );

    const actionsById = new Map<number, ( typeof actions )[ number ]>();
    actions.forEach( ( a ) => actionsById.set( a.id, a ) );

    const uiKeyByNodeId = new Map<number, UIKey>();
    for ( const n of nodes ) {
        const dispRaw = n.displayId ?? "";
        const key = dispRaw.trim();
        if ( !key ) continue;
        uiKeyByNodeId.set( n.id, key );
    }

    if ( uiKeyByNodeId.size === 0 ) {
        return { text: `UITD ${q( title )} {\n}\n`, locations };
    }

    const uiGroups = new Map<UIKey, ( typeof nodes )[ number ][]>();
    for ( const n of nodes ) {
        const key = uiKeyByNodeId.get( n.id );
        if ( !key ) continue;
        if ( !uiGroups.has( key ) ) uiGroups.set( key, [] );
        uiGroups.get( key )!.push( n );
    }

    // Acciones por UI lógica (para UI blocks)
    const actionsByUIKey = new Map<UIKey, Set<string>>();
    for ( const a of actions ) {
        const originNode = nodesById.get( a.originNodeId );
        if ( !originNode ) continue;
        const key = uiKeyByNodeId.get( originNode.id );
        if ( !key ) continue;

        const formatted = actionToUtdl( a.verb, a.complement );
        if ( !formatted ) continue;

        if ( !actionsByUIKey.has( key ) ) actionsByUIKey.set( key, new Set() );
        actionsByUIKey.get( key )!.add( formatted );
    }

    const uiLines: string[] = [];

    const uiKeysSorted = Array.from( uiGroups.keys() ).sort( ( a, b ) => {
        const na = Number( a );
        const nb = Number( b );
        if ( Number.isFinite( na ) && Number.isFinite( nb ) ) return na - nb;
        return a.localeCompare( b );
    } );

    for ( const key of uiKeysSorted ) {
        const groupNodes = uiGroups.get( key )!;
        const name = ( groupNodes[ 0 ].title ?? "" ).trim() || `UI ${key}`;

        uiLines.push( `    UI ${key} ${q( name )} actions {` );
        const actSet = actionsByUIKey.get( key ) ?? new Set<string>();
        for ( const act of actSet ) {
            uiLines.push( `        ${act};` );
        }
        uiLines.push( "    }" );
    }

    const edgesFromAction = new Map<number, typeof edges>();
    const edgesFromCond = new Map<number, typeof edges>();

    for ( const e of edges ) {
        if ( e.from.kind === "action" ) {
            if ( !edgesFromAction.has( e.from.id ) ) edgesFromAction.set( e.from.id, [] );
            edgesFromAction.get( e.from.id )!.push( e );
        } else if ( e.from.kind === "condition" ) {
            if ( !edgesFromCond.has( e.from.id ) ) edgesFromCond.set( e.from.id, [] );
            edgesFromCond.get( e.from.id )!.push( e );
        }
    }

    const collectedTransitions: TransitionRecord[] = [];

    const addTransitionRecord = (
        actionId: number,
        srcKey: UIKey,
        dstKey: UIKey,
        srcNodeId: number,
        dstNodeId: number,
        actVerb: UiVerb,
        actComplement: string,
        conditionId?: number,
        condLabel?: string
    ) => {
        const act = actionToUtdl( actVerb, actComplement );
        if ( !act ) return;
        collectedTransitions.push( {
            actionId,
            conditionId,
            srcKey,
            dstKey,
            srcNodeId,
            dstNodeId,
            actVerb,
            actComplement,
            condLabel,
        } );
    };

    // con condición
    for ( const c of conditions ) {
        const action = actionsById.get( c.originActionId );
        if ( !action ) continue;

        const condTitle = ( c.title ?? "" ).trim();
        if ( !condTitle ) continue;

        const outFromCond = edgesFromCond.get( c.id ) ?? [];
        const condToNode = outFromCond.find(
            ( e ) => e.to.kind === "node" && e.style === "dashed1"
        );
        if ( !condToNode ) continue;

        const srcNode = nodesById.get( action.originNodeId );
        if ( !srcNode ) continue;
        const srcKey = uiKeyByNodeId.get( srcNode.id );
        if ( !srcKey ) continue;

        const targetNode = nodesById.get( condToNode.to.id );
        if ( !targetNode ) continue;
        const dstKey = uiKeyByNodeId.get( targetNode.id );
        if ( !dstKey ) continue;

        addTransitionRecord(
            action.id,
            srcKey,
            dstKey,
            srcNode.id,
            targetNode.id,
            action.verb,
            action.complement,
            c.id,
            condTitle
        );
    }

    // sin condición
    for ( const a of actions ) {
        const srcNode = nodesById.get( a.originNodeId );
        if ( !srcNode ) continue;
        const srcKey = uiKeyByNodeId.get( srcNode.id );
        if ( !srcKey ) continue;

        const out = edgesFromAction.get( a.id ) ?? [];
        const toNodeEdges = out.filter(
            ( e ) => e.to.kind === "node" && e.style === "dashed1"
        );

        for ( const e of toNodeEdges ) {
            const targetNode = nodesById.get( e.to.id );
            if ( !targetNode ) continue;
            const dstKey = uiKeyByNodeId.get( targetNode.id );
            if ( !dstKey ) continue;

            addTransitionRecord(
                a.id,
                srcKey,
                dstKey,
                srcNode.id,
                targetNode.id,
                a.verb,
                a.complement
            );
        }
    }

    const fragments: FragmentInfo[] = buildFragmentGroups( {
        nodes,
        actions,
        conditions,
        edges,
    } ).map( ( group ) => ( {
        id: group.id,
        nodeIds: group.nodeIds,
        actionIds: group.actionIds,
        conditionIds: group.conditionIds,
    } ) );

    const renderNodeRef = ( input: {
        nodeId: number;
        inFragmentNodes: Set<number>;
        childrenByParent: Map<number, number[]>;
        lineNumber: number;
        startColumn: number;
    } ): string => {
        const { nodeId, inFragmentNodes, childrenByParent, lineNumber, startColumn } = input;
        const node = nodesById.get( nodeId );
        if ( !node ) return "";

        const uiKey = ( node.displayId ?? "" ).trim();
        if ( !uiKey ) return "";

        addLocation( locations.nodes, nodeId, {
            lineNumber,
            column: startColumn,
            endColumn: startColumn + uiKey.length,
        } );

        const childIds = childrenByParent.get( nodeId ) ?? [];
        const validChildren = childIds.filter( ( cid ) => inFragmentNodes.has( cid ) );

        if ( validChildren.length === 0 ) return uiKey;

        const sortedChildren = [ ...validChildren ].sort( ( a, b ) => a - b );
        const childRefs: string[] = [];
        let nextColumn = startColumn + uiKey.length + 1;
        for ( const cid of sortedChildren ) {
            const chStr = renderNodeRef( {
                nodeId: cid,
                inFragmentNodes,
                childrenByParent,
                lineNumber,
                startColumn: nextColumn,
            } );
            if ( chStr ) childRefs.push( chStr );
            nextColumn += chStr.length + 2;
        }

        if ( childRefs.length === 0 ) return uiKey;
        return `${uiKey}[${childRefs.join( ", " )}]`;
    };

    pushLine( `UITD ${q( title )} {` );
    for ( const line of uiLines ) pushLine( line );

    for ( let fi = 0; fi < fragments.length; fi++ ) {
        const frag = fragments[ fi ];
        const compNodeSet = new Set<number>( frag.nodeIds );

        const nodesInFragment: number[] = [];
        for ( const nodeId of frag.nodeIds ) {
            const n = nodesById.get( nodeId );
            if ( !n ) continue;
            const k = ( n.displayId ?? "" ).trim();
            if ( !k ) continue;
            nodesInFragment.push( nodeId );
        }

        if ( nodesInFragment.length === 0 ) continue;

        const inFragSet = new Set<number>( nodesInFragment );

        const childrenByParent = new Map<number, number[]>();
        const hasParentInFragment = new Set<number>();

        for ( const nodeId of nodesInFragment ) {
            const n = nodesById.get( nodeId )!;
            const pid = n.parentId;
            if ( pid != null && inFragSet.has( pid ) ) {
                if ( !childrenByParent.has( pid ) ) childrenByParent.set( pid, [] );
                childrenByParent.get( pid )!.push( nodeId );
                hasParentInFragment.add( nodeId );
            }
        }

        const roots: number[] = [];
        for ( const nodeId of nodesInFragment ) {
            if ( !hasParentInFragment.has( nodeId ) ) roots.push( nodeId );
        }
        if ( roots.length === 0 ) roots.push( ...nodesInFragment );

        roots.sort( ( a, b ) => a - b );

        const fragName = resolveFragmentTitle( state.fragmentTitles, frag.id, fi ) || `${fragmentBase} ${fi + 1}`;
        const fragmentLine = `    FRAGMENT ${q( fragName )} {`;
        const fragmentLineNumber = pushLine( fragmentLine );
        const fragmentColumn = fragmentLine.indexOf( "FRAGMENT" ) + 1;
        locations.fragments.push( {
            id: frag.id,
            nodeIds: frag.nodeIds,
            actionIds: frag.actionIds,
            conditionIds: frag.conditionIds,
            lineNumber: fragmentLineNumber,
            column: fragmentColumn,
            endColumn: fragmentLine.length + 1,
        } );

        const drawPrefix = "        DRAW { ";
        const refParts: string[] = [];
        let nextDrawColumn = drawPrefix.length + 1;
        const plannedDrawLineNumber = lines.length + 1;
        for ( const rootId of roots ) {
            const ref = renderNodeRef( {
                nodeId: rootId,
                inFragmentNodes: inFragSet,
                childrenByParent,
                lineNumber: plannedDrawLineNumber,
                startColumn: nextDrawColumn,
            } );
            if ( ref ) refParts.push( ref );
            nextDrawColumn += ref.length + 2;
        }
        if ( refParts.length === 0 ) continue;

        const drawLine = `${drawPrefix}${refParts.join( ", " )} };`;
        pushLine( drawLine );

        const uiRefForNode = ( nodeId: number ): string | null => {
            const path: number[] = [];
            let cur: number | null = nodeId;
            const seen = new Set<number>();

            while ( cur != null ) {
                if ( seen.has( cur ) ) return null;
                seen.add( cur );
                const n = nodesById.get( cur );
                if ( !n ) break;
                path.push( cur );
                const pid = n.parentId;
                if ( pid == null || !inFragSet.has( pid ) ) break;
                cur = pid;
            }

            if ( path.length === 0 ) return null;

            const uiIdOf = ( id: number ): string | null => {
                const nn = nodesById.get( id );
                if ( !nn ) return null;
                const d = ( nn.displayId ?? "" ).trim();
                return d || null;
            };

            const chainRootToLeaf = path.slice().reverse().map( uiIdOf );
            if ( chainRootToLeaf.some( ( part ) => !part ) ) return null;

            let acc = chainRootToLeaf[ chainRootToLeaf.length - 1 ]!;
            for ( let i = chainRootToLeaf.length - 2; i >= 0; i-- ) {
                acc = `${chainRootToLeaf[ i ]!}(${acc})`;
            }
            return acc;
        };

        const seenTrans = new Set<string>();
        for ( const tr of collectedTransitions ) {
            if ( !compNodeSet.has( tr.srcNodeId ) || !compNodeSet.has( tr.dstNodeId ) ) continue;

            const srcRef = uiRefForNode( tr.srcNodeId );
            const dstRef = uiRefForNode( tr.dstNodeId );
            if ( !srcRef || !dstRef ) continue;

            const act = actionToUtdl( tr.actVerb, tr.actComplement );
            if ( !act ) continue;

            const key = `${srcRef}|${dstRef}|${act}|${tr.condLabel ?? ""}`;
            if ( seenTrans.has( key ) ) continue;
            seenTrans.add( key );

            if ( tr.condLabel ) {
                const conditionText = `AND ${q( tr.condLabel )}`;
                const transitionLine =
                    `        TRANSITION from ${srcRef} to ${dstRef} ` +
                    `if user ${act} ${conditionText};`;
                const lineNumber = pushLine( transitionLine );
                const actionColumn = transitionLine.indexOf( act ) + 1;
                addLocation( locations.actions, tr.actionId, {
                    lineNumber,
                    column: actionColumn,
                    endColumn: actionColumn + act.length,
                } );
                if ( tr.conditionId != null ) {
                    const conditionColumn = transitionLine.indexOf( conditionText ) + 1;
                    addLocation( locations.conditions, tr.conditionId, {
                        lineNumber,
                        column: conditionColumn,
                        endColumn: conditionColumn + conditionText.length,
                    } );
                }
            } else {
                const transitionLine =
                    `        TRANSITION from ${srcRef} to ${dstRef} ` +
                    `if user ${act};`;
                const lineNumber = pushLine( transitionLine );
                const actionColumn = transitionLine.indexOf( act ) + 1;
                addLocation( locations.actions, tr.actionId, {
                    lineNumber,
                    column: actionColumn,
                    endColumn: actionColumn + act.length,
                } );
            }
        }

        pushLine( "    }" );
    }

    pushLine( "}" );
    return { text: lines.join( "\n" ), locations };
}

export function exportToUITDL(
    state: AppState,
    options: UITDLExportOptions = {}
): string {
    return exportToUITDLWithLocations( state, options ).text;
}
