// src/export/uitdl.ts
import type { AppState } from "../state/types";

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
    actLabel: string;
    condLabel?: string;
};

type FragmentInfo = {
    nodeIds: number[];
};

const q = ( s: string ): string =>
    `"${( s ?? "" )
        .replace( /\\/g, "\\\\" )
        .replace( /"/g, '\\"' )}"`;

/**
 * Exporta el estado actual del editor al lenguaje UITDL.
 *
 * Reglas principales:
 * - UIID = displayId (string). Todos los nodos con el mismo displayId se consideran una UI lógica.
 * - TITLE es global.
 * - UI ... actions {...} se generan por displayId.
 * - Fragmentos: cada componente conexa del grafo de nodos (por id) → un FRAGMENT.
 * - Dentro de cada FRAGMENT:
 *      - Se consideran SÓLO los nodos (ids) que pertenecen a ese fragmento.
 *      - Se reconstruye el bosque de nesting usando parentId pero restringido al fragmento.
 *      - Cada raíz del bosque se dibuja como un UIREF:
 *          displayId o displayId(hijos...)
 *      - Si la misma displayId aparece en varias raíces / ramas, se dibuja varias veces
 *        (instancias diferentes), siempre usando displayId como nombre.
 * - Transiciones: se basan en action→node y condition→node (style "dashed1"),
 *   agrupadas también por componente conexa de nodos.
 */
export function exportToUITDL(
    state: AppState,
    options: UITDLExportOptions = {}
): string {
    const title = options.title ?? "UITD Diagram";
    const fragmentBase = options.fragmentBaseName ?? "Fragment";

    const { nodes, actions, conditions, edges } = state;

    // --- Mapas base ---
    const nodesById = new Map<number, ( typeof nodes )[ number ]>();
    nodes.forEach( ( n ) => nodesById.set( n.id, n ) );

    const actionsById = new Map<number, ( typeof actions )[ number ]>();
    actions.forEach( ( a ) => actionsById.set( a.id, a ) );

    const condById = new Map<number, ( typeof conditions )[ number ]>();
    conditions.forEach( ( c ) => condById.set( c.id, c ) );

    // NodeId -> UIKey (displayId normalizado)
    const uiKeyByNodeId = new Map<number, UIKey>();
    for ( const n of nodes ) {
        const dispRaw = n.displayId ?? "";
        const key = dispRaw.trim();
        if ( !key ) continue; // nodos sin displayId NO participan en UITDL
        uiKeyByNodeId.set( n.id, key );
    }

    if ( uiKeyByNodeId.size === 0 ) {
        return `UITD ${q( title )} {\n}\n`;
    }

    // --- 1) Agrupar nodos por displayId (UI lógica) ---
    const uiGroups = new Map<UIKey, ( typeof nodes )[ number ][]>();
    for ( const n of nodes ) {
        const key = uiKeyByNodeId.get( n.id );
        if ( !key ) continue;
        if ( !uiGroups.has( key ) ) uiGroups.set( key, [] );
        uiGroups.get( key )!.push( n );
    }

    // --- 2) Acciones por UI lógica (para los bloques UI) ---
    const actionsByUIKey = new Map<UIKey, Set<string>>();
    for ( const a of actions ) {
        const originNode = nodesById.get( a.originNodeId );
        if ( !originNode ) continue;
        const key = uiKeyByNodeId.get( originNode.id );
        if ( !key ) continue;

        if ( !actionsByUIKey.has( key ) ) actionsByUIKey.set( key, new Set() );
        const label = ( a.title ?? "" ).trim();
        if ( !label ) continue;
        actionsByUIKey.get( key )!.add( label );
    }

    // --- 3) Bloques UI ---
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
        for ( const label of actSet ) {
            uiLines.push( `        clicks ${q( label )};` );
        }
        uiLines.push( "    }" );
    }

    // --- 4) Grafo de NODOS (por id) para fragmentos ---
    const nodeAdj = new Map<number, Set<number>>();

    const addNodeEdge = ( a: number, b: number ) => {
        if ( !nodeAdj.has( a ) ) nodeAdj.set( a, new Set() );
        if ( !nodeAdj.has( b ) ) nodeAdj.set( b, new Set() );
        nodeAdj.get( a )!.add( b );
        nodeAdj.get( b )!.add( a );
    };

    // Inicializar todos los nodos, aunque aislados
    for ( const n of nodes ) {
        if ( !nodeAdj.has( n.id ) ) nodeAdj.set( n.id, new Set() );
    }

    // 4.a) Aristas por nesting (parentId <-> childId)
    for ( const n of nodes ) {
        if ( n.parentId != null ) {
            addNodeEdge( n.id, n.parentId );
        }
    }

    // --- 5) Edges agrupados por origen para transiciones ---
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
        actLabel: string,
        condLabel?: string
    ) => {
        const act = actLabel.trim();
        if ( !act ) return;
        collectedTransitions.push( {
            srcKey,
            dstKey,
            srcNodeId,
            dstNodeId,
            actLabel: act,
            condLabel,
        } );
        // Para fragmentos, conectamos también por transiciones
        addNodeEdge( srcNodeId, dstNodeId );
    };

    // 5.a) Transiciones con condición (action -> condition -> node)
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

        const actLabel = ( action.title ?? "" ).trim();
        if ( !actLabel ) continue;

        addTransitionRecord(
            srcKey,
            dstKey,
            srcNode.id,
            targetNode.id,
            actLabel,
            condTitle
        );
    }

    // 5.b) Transiciones sin condición (action -> node)
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

            const actLabel = ( a.title ?? "" ).trim();
            if ( !actLabel ) continue;

            addTransitionRecord(
                srcKey,
                dstKey,
                srcNode.id,
                targetNode.id,
                actLabel
            );
        }
    }

    // --- 6) Componentes conexas de NODOS (por id) ---
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

    const fragments: FragmentInfo[] = components.map( ( comp ) => ( {
        nodeIds: comp,
    } ) );

    // --- Helper para renderizar un nodo (instancia) como UIREF recursivo ---
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

        if ( validChildren.length === 0 ) {
            return uiKey;
        }

        const sortedChildren = [ ...validChildren ].sort( ( a, b ) => a - b );
        const childRefs: string[] = [];
        for ( const cid of sortedChildren ) {
            const chStr = renderNodeRef( cid, inFragmentNodes, childrenByParent );
            if ( chStr ) childRefs.push( chStr );
        }

        if ( childRefs.length === 0 ) return uiKey;

        return `${uiKey}(${childRefs.join( ", " )})`;
    };

    // --- 7) Ensamblar UITDL completo ---
    const lines: string[] = [];
    lines.push( `UITD ${q( title )} {` );

    // UI blocks
    lines.push( ...uiLines );

    // FRAGMENTs
    let fragCounter = 1;

    for ( let fi = 0; fi < fragments.length; fi++ ) {
        const frag = fragments[ fi ];
        const compNodeSet = new Set<number>( frag.nodeIds );

        // Nodos que SÍ tienen displayId y pertenecen al fragmento
        const nodesInFragment: number[] = [];
        for ( const nodeId of frag.nodeIds ) {
            const n = nodesById.get( nodeId );
            if ( !n ) continue;
            const k = ( n.displayId ?? "" ).trim();
            if ( !k ) continue;
            nodesInFragment.push( nodeId );
        }

        if ( nodesInFragment.length === 0 ) {
            // Componente sin UIs etiquetadas → no genera fragmento
            continue;
        }

        const inFragSet = new Set<number>( nodesInFragment );

        // --- Bosque de nesting REAL en este fragmento ---
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

        // Raíces: nodos del fragmento que no tienen parentId dentro del fragmento
        const roots: number[] = [];
        for ( const nodeId of nodesInFragment ) {
            if ( !hasParentInFragment.has( nodeId ) ) {
                roots.push( nodeId );
            }
        }

        // Si por alguna razón no hay raíces (ciclo raro), usamos todos
        if ( roots.length === 0 ) {
            roots.push( ...nodesInFragment );
        }

        // Ordenamos raíces por id para estabilidad
        roots.sort( ( a, b ) => a - b );

        const refParts: string[] = [];
        for ( const rootId of roots ) {
            const ref = renderNodeRef( rootId, inFragSet, childrenByParent );
            if ( ref ) refParts.push( ref );
        }

        if ( refParts.length === 0 ) {
            // Nada que dibujar
            continue;
        }

        const fragName = `${fragmentBase} ${fragCounter++}`;
        lines.push( `    FRAGMENT ${q( fragName )} {` );
        lines.push( `        DRAW { ${refParts.join( ", " )} };` );

        // --- Transiciones de este fragmento ---
        const seenTrans = new Set<string>();
        for ( const tr of collectedTransitions ) {
            if ( !compNodeSet.has( tr.srcNodeId ) || !compNodeSet.has( tr.dstNodeId ) ) continue;

            const key = `${tr.srcKey}|${tr.dstKey}|${tr.actLabel}|${tr.condLabel ?? ""}`;
            if ( seenTrans.has( key ) ) continue;
            seenTrans.add( key );

            if ( tr.condLabel ) {
                lines.push(
                    `        TRANSITION from ${tr.srcKey} to ${tr.dstKey} ` +
                    `if user clicks ${q( tr.actLabel )} AND ${q( tr.condLabel )};`
                );
            } else {
                lines.push(
                    `        TRANSITION from ${tr.srcKey} to ${tr.dstKey} ` +
                    `if user clicks ${q( tr.actLabel )};`
                );
            }
        }

        lines.push( "    }" );
    }

    lines.push( "}" );

    return lines.join( "\n" );
}
