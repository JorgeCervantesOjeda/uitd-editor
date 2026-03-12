import type { AppState } from "../state/types";
import type { UiVerb } from "../model/types";

export type UITDLExportOptions = {
    title?: string;
    fragmentBaseName?: string;
};

type UIKey = string;

type TransitionRecord = {
    srcKey: UIKey;
    dstKey: UIKey;
    srcNodeId: number;
    dstNodeId: number;
    actVerb: UiVerb;
    actComplement: string;
    condLabel?: string;
};

type FragmentInfo = {
    nodeIds: number[];
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

export function exportToUITDL(
    state: AppState,
    options: UITDLExportOptions = {}
): string {
    const title = options.title ?? "UITD Diagram";
    const fragmentBase = options.fragmentBaseName ?? "Fragment";

    const { nodes, actions, conditions, edges } = state;

    const nodesById = new Map<number, ( typeof nodes )[ number ]>();
    nodes.forEach( ( n ) => nodesById.set( n.id, n ) );

    const actionsById = new Map<number, ( typeof actions )[ number ]>();
    actions.forEach( ( a ) => actionsById.set( a.id, a ) );

    const condById = new Map<number, ( typeof conditions )[ number ]>();
    conditions.forEach( ( c ) => condById.set( c.id, c ) );

    const uiKeyByNodeId = new Map<number, UIKey>();
    for ( const n of nodes ) {
        const dispRaw = n.displayId ?? "";
        const key = dispRaw.trim();
        if ( !key ) continue;
        uiKeyByNodeId.set( n.id, key );
    }

    if ( uiKeyByNodeId.size === 0 ) {
        return `UITD ${q( title )} {\n}\n`;
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

    // --- Grafo de nodos para fragmentos ---
    const nodeAdj = new Map<number, Set<number>>();
    const addNodeEdge = ( a: number, b: number ) => {
        if ( !nodeAdj.has( a ) ) nodeAdj.set( a, new Set() );
        if ( !nodeAdj.has( b ) ) nodeAdj.set( b, new Set() );
        nodeAdj.get( a )!.add( b );
        nodeAdj.get( b )!.add( a );
    };

    for ( const n of nodes ) {
        if ( !nodeAdj.has( n.id ) ) nodeAdj.set( n.id, new Set() );
    }

    for ( const n of nodes ) {
        if ( n.parentId != null ) addNodeEdge( n.id, n.parentId );
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
        srcKey: UIKey,
        dstKey: UIKey,
        srcNodeId: number,
        dstNodeId: number,
        actVerb: UiVerb,
        actComplement: string,
        condLabel?: string
    ) => {
        const act = actionToUtdl( actVerb, actComplement );
        if ( !act ) return;
        collectedTransitions.push( {
            srcKey,
            dstKey,
            srcNodeId,
            dstNodeId,
            actVerb,
            actComplement,
            condLabel,
        } );
        addNodeEdge( srcNodeId, dstNodeId );
    };

    // con condición
    for ( const c of conditions ) {
        const action = actionsById.get( c.originActionId );
        if ( !action ) continue;

        const condTitle = ( c.title ?? "" ).trim();
        if ( !condTitle || condTitle.toLowerCase() === "empty" ) continue;

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
            srcKey,
            dstKey,
            srcNode.id,
            targetNode.id,
            action.verb,
            action.complement,
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
                srcKey,
                dstKey,
                srcNode.id,
                targetNode.id,
                a.verb,
                a.complement
            );
        }
    }

    // componentes conexas
    const components: number[][] = [];
    const visitedNodes = new Set<number>();

    for ( const n of nodes ) {
        if ( visitedNodes.has( n.id ) ) continue;
        const queue: number[] = [ n.id ];
        const comp: number[] = [];
        visitedNodes.add( n.id );

        while ( queue.length ) {
            const u = queue.shift()!;
            comp.push( u );
            for ( const v of nodeAdj.get( u ) ?? [] ) {
                if ( !visitedNodes.has( v ) ) {
                    visitedNodes.add( v );
                    queue.push( v );
                }
            }
        }
        components.push( comp );
    }

    const fragments: FragmentInfo[] = components.map( ( comp ) => ( { nodeIds: comp } ) );

    const renderNodeRef = (
        nodeId: number,
        inFragmentNodes: Set<number>,
        childrenByParent: Map<number, number[]>
    ): string => {
        const node = nodesById.get( nodeId );
        if ( !node ) return "";

        const uiKey = ( node.displayId ?? "" ).trim();
        if ( !uiKey ) return "";

        const childIds = childrenByParent.get( nodeId ) ?? [];
        const validChildren = childIds.filter( ( cid ) => inFragmentNodes.has( cid ) );

        if ( validChildren.length === 0 ) return uiKey;

        const sortedChildren = [ ...validChildren ].sort( ( a, b ) => a - b );
        const childRefs: string[] = [];
        for ( const cid of sortedChildren ) {
            const chStr = renderNodeRef( cid, inFragmentNodes, childrenByParent );
            if ( chStr ) childRefs.push( chStr );
        }

        if ( childRefs.length === 0 ) return uiKey;
        return `${uiKey}(${childRefs.join( ", " )})`;
    };

    const lines: string[] = [];
    lines.push( `UITD ${q( title )} {` );
    lines.push( ...uiLines );

    let fragCounter = 1;

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

        const refParts: string[] = [];
        for ( const rootId of roots ) {
            const ref = renderNodeRef( rootId, inFragSet, childrenByParent );
            if ( ref ) refParts.push( ref );
        }
        if ( refParts.length === 0 ) continue;

        const fragName = `${fragmentBase} ${fragCounter++}`;
        lines.push( `    FRAGMENT ${q( fragName )} {` );
        lines.push( `        DRAW { ${refParts.join( ", " )} };` );

        const uiRefForNode = ( nodeId: number ): string | null => {
            const chain: number[] = [];
            let cur: number | null = nodeId;
            const seen = new Set<number>();

            while ( cur != null ) {
                if ( seen.has( cur ) ) return null; // defensa ante ciclos de parentId
                seen.add( cur );
                const n = nodesById.get( cur );
                if ( !n ) break;
                chain.push( cur );
                const pid = n.parentId;
                if ( pid == null || !inFragSet.has( pid ) ) break;
                cur = pid;
            }

            if ( chain.length === 0 ) return null;

            const chainRootToLeaf = chain.slice().reverse();

            const uiIdOf = ( id: number ): string | null => {
                const nn = nodesById.get( id );
                if ( !nn ) return null;
                const d = ( nn.displayId ?? "" ).trim();
                return d || null;
            };

            let acc = uiIdOf( chainRootToLeaf[ 0 ] );
            if ( !acc ) return null;

            for ( let i = 1; i < chainRootToLeaf.length; i++ ) {
                const cid = uiIdOf( chainRootToLeaf[ i ] );
                if ( !cid ) continue;
                acc = `${acc}(${cid})`;
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
                lines.push(
                    `        TRANSITION from ${srcRef} to ${dstRef} ` +
                    `if user ${act} AND ${q( tr.condLabel )};`
                );
            } else {
                lines.push(
                    `        TRANSITION from ${srcRef} to ${dstRef} ` +
                    `if user ${act};`
                );
            }
        }

        lines.push( "    }" );
    }

    lines.push( "}" );
    return lines.join( "\n" );
}
