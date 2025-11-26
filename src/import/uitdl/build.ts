import type { UITDLDoc, UiRef } from "./types";
import type { AppState } from "../../state/types";
import {
    measureNodeSizeWithId,
    measureActionOval,
    measureConditionOval,
    layoutChildrenSquareish,
    type Size,
} from "../../layout/measurement";

import {
    CONTAINER_PAD_X,
    CONTAINER_CHILDREN_TOP_PAD,
    CONTAINER_CHILDREN_BOTTOM_PAD,
    CHILD_GAP_X,
    CHILD_GAP_Y,
    CONTAINER_HEADER_GAP_Y,
    NODE_WRAP_DEFAULT,
    MIN_W,
    MIN_H,
} from "../../model/types";

/** Instancia materializada de un UiRef (nodo lógico ya convertido a NodeBox). */
type NodeInst = { key: string; nodeId: number; parentId: number | null; children: NodeInst[] };

/** Construye el proyecto AppState (nodes/actions/conditions/edges) a partir del AST UITDL. */
export function buildProjectFromAST( ast: UITDLDoc, base: AppState ) {
    const nodes: any[] = [];
    const actions: any[] = [];
    const conditions: any[] = [];
    const edges: any[] = [];

    let nodeId = 1, actionId = 1, conditionId = 1, edgeId = 1;

    // --------- Defaults visuales ----------
    const NODE = {
        wrap: NODE_WRAP_DEFAULT,
        colorFill: "#a8a8f0",
        colorStroke: "#158484",
        colorText: "#000000",
    } as const;

    const ACTION = {
        wrap: NODE_WRAP_DEFAULT,
        colorFill: "#a8a8f0",
        colorStroke: "#158484",
        colorText: "#000000",
    } as const;

    const COND = {
        wrap: NODE_WRAP_DEFAULT,
        colorFill: "#eef2ff",
        colorStroke: "#94a3b8",
        colorText: "#1e293b",
    } as const;

    // --------- Espaciados (los que no están en model/types)
    const LAYOUT = {
        gapBetweenRootsX: 80,
        gapBetweenFragmentsY: 200,
        nodeToActionsGapY: 30,
        actionsGapY: 66,
        actionToCondsGapY: 20,
        condGapX: 130,
        edgeStyleNormal: "solid" as const,      // tu renderer maneja "solid" | "dashed1" | "dashed2"
        edgeStyleTransition: "dashed1" as const,
    };

    // --------- Metadatos de bloques UI ----------
    const uiName = new Map<string, string>();                 // UIKEY -> UINAME
    const uiDeclaredActions = new Map<string, Set<string>>(); // UIKEY -> set("verb complement")

    for ( const u of ast.uiBlocks ) {
        if ( u.name ) uiName.set( u.key, u.name );
        if ( !uiDeclaredActions.has( u.key ) ) uiDeclaredActions.set( u.key, new Set() );
        for ( const a of u.actions ) uiDeclaredActions.get( u.key )!.add( a.raw );
    }

    // --------- Helpers: creación de nodos desde DRAW ----------
    const ensureNode = ( key: string, parent: number | null ): NodeInst => {
        const id = nodeId++;
        const title = uiName.get( key ) || `UI ${key}`;
        const nm = measureNodeSizeWithId( key, title, NODE.wrap );
        nodes.push( {
            id,
            x: 0, y: 0,
            w: nm.w, h: nm.h,
            title,
            wrap: NODE.wrap,
            displayId: key,
            colorFill: NODE.colorFill,
            colorStroke: NODE.colorStroke,
            colorText: NODE.colorText,
            parentId: parent,
        } );
        return { key, nodeId: id, parentId: parent, children: [] };
    };

    const realizeRef = (
        ref: UiRef,
        parent: number | null,
        allByKey: Map<string, NodeInst[]>
    ): NodeInst => {
        const inst = ensureNode( ref.key, parent );
        if ( !allByKey.has( ref.key ) ) allByKey.set( ref.key, [] );
        allByKey.get( ref.key )!.push( inst );
        for ( const ch of ref.children ) {
            const child = realizeRef( ch, inst.nodeId, allByKey );
            inst.children.push( child );
        }
        return inst;
    };

    // --------- Materializar fragmentos (sólo DRAW crea nodos) ----------
    type FragRuntime = { roots: NodeInst[]; allByKey: Map<string, NodeInst[]> };
    const frags: FragRuntime[] = [];

    for ( const frag of ast.fragments ) {
        const allByKey = new Map<string, NodeInst[]>();
        const roots: NodeInst[] = [];
        for ( const r of frag.draw ) roots.push( realizeRef( r, null, allByKey ) );
        frags.push( { roots, allByKey } );
    }

    // --------- Resolver encadenamiento A(B(C)) bajo la raíz A ----------
    const resolvePathUnderRoot = ( root: NodeInst, ref: UiRef ): NodeInst | null => {
        if ( root.key !== ref.key ) return null;
        let cur: NodeInst = root;
        let r: UiRef = ref;
        while ( r.children.length > 0 ) {
            const next = r.children[ 0 ];
            let found: NodeInst | null = null;
            for ( const ch of cur.children ) { if ( ch.key === next.key ) { found = ch; break; } }
            if ( !found ) return null;
            cur = found;
            r = next;
        }
        return cur;
    };

    // --------- Acciones/Condiciones y edges ----------
    const actionKey = ( nodeId0: number, raw: string ) => `${nodeId0}::${raw}`;
    const actionMap = new Map<string, number>();              // (nodeId::raw) -> actionId
    const condSetByActionId = new Map<number, Set<string>>(); // actionId -> set(condTitle)

    const pushAction = ( nodeId0: number, raw: string ): number => {
        const k = actionKey( nodeId0, raw );
        const cached = actionMap.get( k );
        if ( cached != null ) return cached;

        const newId = actionId++;
        const am = measureActionOval( raw, ACTION.wrap );
        actions.push( {
            id: newId,
            originNodeId: nodeId0,
            x: 0, y: 0,
            w: am.w, h: am.h,
            title: raw,           // "verb complement"
            wrap: ACTION.wrap,
            colorFill: ACTION.colorFill,
            colorStroke: ACTION.colorStroke,
            colorText: ACTION.colorText,
        } );

        // Edge node -> action (para pintar el origen)
        edges.push( {
            id: edgeId++,
            from: { kind: "node", id: nodeId0 },
            to: { kind: "action", id: newId },
            style: LAYOUT.edgeStyleNormal,
        } );

        actionMap.set( k, newId );
        return newId;
    };

    const addConditionIfNew = ( actionId0: number, condTitle: string ): number | null => {
        if ( !condSetByActionId.has( actionId0 ) ) condSetByActionId.set( actionId0, new Set() );
        const set = condSetByActionId.get( actionId0 )!;
        if ( set.has( condTitle ) ) return null;
        set.add( condTitle );
        const cId = conditionId++;
        const cm = measureConditionOval( condTitle, COND.wrap );
        conditions.push( {
            id: cId,
            originActionId: actionId0,
            title: condTitle,
            x: 0, y: 0,
            w: cm.w, h: cm.h,
            wrap: COND.wrap,
            colorFill: COND.colorFill,
            colorStroke: COND.colorStroke,
            colorText: COND.colorText,
        } );
        return cId;
    };

    const firstInstanceByKey = new Map<string, number>();        // UIKEY -> primer nodeId visto
    const sourceInstancesByKey = new Map<string, Set<number>>(); // UIKEY -> instancias usadas como origen

    // --------- 1) Procesar transiciones ----------
    for ( let fi = 0; fi < ast.fragments.length; fi++ ) {
        const frag = ast.fragments[ fi ];
        const { allByKey } = frags[ fi ];

        // primar primera instancia de cada UIKEY
        for ( const [ k, arr ] of allByKey ) {
            if ( !firstInstanceByKey.has( k ) && arr.length ) firstInstanceByKey.set( k, arr[ 0 ].nodeId );
        }

        for ( const tr of frag.transitions ) {
            // FROM
            let fromCandidates: NodeInst[] = [];
            if ( tr.from.children.length > 0 ) {
                const aKey = tr.from.key;
                const rootsA = ( allByKey.get( aKey ) || [] ).filter( x => x.parentId === null );
                for ( const rootA of rootsA ) {
                    const target = resolvePathUnderRoot( rootA, tr.from );
                    if ( target ) fromCandidates.push( target );
                }
            } else {
                const rootsB = ( allByKey.get( tr.from.key ) || [] ).filter( x => x.parentId === null );
                if ( rootsB.length ) fromCandidates = rootsB;
                else {
                    const anyB = allByKey.get( tr.from.key ) || [];
                    if ( anyB.length ) fromCandidates = anyB;
                    else continue; // tolerante
                }
            }

            // TO
            let toCandidates: NodeInst[] = [];
            if ( tr.to.children.length > 0 ) {
                const aKey = tr.to.key;
                const rootsA = ( allByKey.get( aKey ) || [] ).filter( x => x.parentId === null );
                for ( const rootA of rootsA ) {
                    const target = resolvePathUnderRoot( rootA, tr.to );
                    if ( target ) toCandidates.push( target );
                }
            } else {
                const rootsB = ( allByKey.get( tr.to.key ) || [] ).filter( x => x.parentId === null );
                if ( rootsB.length ) toCandidates = rootsB;
                else {
                    const anyB = allByKey.get( tr.to.key ) || [];
                    if ( anyB.length ) toCandidates = anyB;
                    else continue; // tolerante
                }
            }

            if ( !fromCandidates.length || !toCandidates.length ) continue;

            const condTitle = ( tr.condLabel || "" ).trim();
            const hasCond = condTitle.length > 0 && condTitle.toLowerCase() !== "empty";

            for ( const src of fromCandidates ) {
                if ( !sourceInstancesByKey.has( src.key ) ) sourceInstancesByKey.set( src.key, new Set() );
                sourceInstancesByKey.get( src.key )!.add( src.nodeId );

                const aId = pushAction( src.nodeId, tr.actionRaw );

                for ( const dst of toCandidates ) {
                    if ( hasCond ) {
                        let condId = conditions.find( c => c.originActionId === aId && c.title === condTitle )?.id ?? null;
                        if ( condId == null ) condId = addConditionIfNew( aId, condTitle );
                        if ( condId != null ) {
                            // condition -> node (transición con condición)
                            edges.push( {
                                id: edgeId++,
                                from: { kind: "condition", id: condId },
                                to: { kind: "node", id: dst.nodeId },
                                style: LAYOUT.edgeStyleTransition,
                            } );
                        }
                    } else {
                        // action -> node (transición sin condición)
                        edges.push( {
                            id: edgeId++,
                            from: { kind: "action", id: aId },
                            to: { kind: "node", id: dst.nodeId },
                            style: LAYOUT.edgeStyleTransition,
                        } );
                    }
                }
            }
        }
    }

    // --------- 2) Agregar TODAS las acciones declaradas de UI en UNA instancia ----------
    for ( const [ key, declaredSet ] of uiDeclaredActions ) {
        let targetNodeId: number | undefined;
        const srcSet = sourceInstancesByKey.get( key );
        if ( srcSet && srcSet.size > 0 ) {
            targetNodeId = Math.min( ...Array.from( srcSet ) );
        } else if ( firstInstanceByKey.has( key ) ) {
            targetNodeId = firstInstanceByKey.get( key )!;
        } else {
            // UI suelta si no apareció en ningún DRAW
            const id = nodeId++;
            const title = uiName.get( key ) || `UI ${key}`;
            const nm = measureNodeSizeWithId( key, title, NODE.wrap );
            nodes.push( {
                id,
                x: 0, y: 0,
                w: nm.w, h: nm.h,
                title,
                wrap: NODE.wrap,
                displayId: key,
                colorFill: NODE.colorFill,
                colorStroke: NODE.colorStroke,
                colorText: NODE.colorText,
                parentId: null,
            } );
            targetNodeId = id;
        }

        for ( const raw of declaredSet ) {
            const k = actionKey( targetNodeId, raw );
            if ( !actionMap.has( k ) ) {
                const aId = actionId++;
                const am = measureActionOval( raw, ACTION.wrap );
                actions.push( {
                    id: aId,
                    originNodeId: targetNodeId,
                    x: 0, y: 0,
                    w: am.w, h: am.h,
                    title: raw,
                    wrap: ACTION.wrap,
                    colorFill: ACTION.colorFill,
                    colorStroke: ACTION.colorStroke,
                    colorText: ACTION.colorText,
                } );

                // Edge node -> action
                edges.push( {
                    id: edgeId++,
                    from: { kind: "node", id: targetNodeId },
                    to: { kind: "action", id: aId },
                    style: LAYOUT.edgeStyleNormal,
                } );

                actionMap.set( k, aId );
            }
        }
    }

    // ============================================================
    // 3) TAMAÑOS/LAYOUT BOTTOM-UP con rejilla squareish
    // ============================================================
    type SubtreeInfo = {
        w: number; h: number;
        nodeHeaderW: number; nodeHeaderH: number; // tamaño del "cabezal" medido
        childrenW: number; childrenH: number;
        childrenPos: Map<number, { x: number; y: number }>; // posiciones RELATIVAS (top-left)
    };

    const computeSubtreeCache = new Map<number, SubtreeInfo>();

    function computeSubtree( inst: NodeInst ): SubtreeInfo {
        const n = nodes.find( v => v.id === inst.nodeId )!;

        // hijos primero (post-orden)
        const childInfos = inst.children.map( ch => computeSubtree( ch ) );
        const childSizes: Size[] = childInfos.map( ci => ( { w: ci.w, h: ci.h } ) );

        // medir cabezal (igual que nesting.slice)
        const nm = measureNodeSizeWithId( n.displayId ?? n.id, n.title, n.wrap ?? NODE.wrap );
        const nodeHeaderW = nm.w;
        const nodeHeaderH = nm.h;

        // layout de hijos (mismas constantes)
        let childrenW = 0, childrenH = 0;
        const childrenPos = new Map<number, { x: number; y: number }>();
        if ( childSizes.length > 0 ) {
            const packed = layoutChildrenSquareish(
                { x: 0, y: 0 },
                childSizes,
                {
                    padX: CONTAINER_PAD_X,
                    padTopY: CONTAINER_CHILDREN_TOP_PAD,
                    padBottomY: CONTAINER_CHILDREN_BOTTOM_PAD,
                    gapX: CHILD_GAP_X,
                    gapY: CHILD_GAP_Y,
                    minW: MIN_W,
                    minH: MIN_H,
                }
            );
            childrenW = packed.container.w;
            childrenH = packed.container.h;
            for ( let i = 0; i < inst.children.length; i++ ) {
                const ch = inst.children[ i ];
                const p = packed.positions[ i ]; // top-left relativo
                childrenPos.set( ch.nodeId, { x: p.x, y: p.y } );
            }
        }

        // el padre contiene a sus hijos (no incluye acciones/condiciones)
        const totalW = Math.max( nodeHeaderW, childrenW );
        const totalH = nodeHeaderH + ( childSizes.length ? CONTAINER_HEADER_GAP_Y : 0 ) + childrenH;

        // fija tamaño del nodo (como haría relayoutContainer)
        n.w = totalW;
        n.h = totalH;

        return { w: totalW, h: totalH, nodeHeaderW, nodeHeaderH, childrenW, childrenH, childrenPos };
    }

    function computeSubtreeCached( inst: NodeInst ): SubtreeInfo {
        const cached = computeSubtreeCache.get( inst.nodeId );
        if ( cached ) return cached;
        const info = computeSubtree( inst );
        computeSubtreeCache.set( inst.nodeId, info );
        return info;
    }

    // coloca el subárbol; recibe top-left y setea x/y como **centro** (igual que tu app)
    function placeSubtree( inst: NodeInst, topLeft: { x: number; y: number }, info: SubtreeInfo ) {
        const n = nodes.find( v => v.id === inst.nodeId )!;

        // nodo en coordenadas de centro
        n.x = topLeft.x + n.w / 2;
        n.y = topLeft.y + n.h / 2;

        if ( inst.children.length === 0 ) return;

        // base del bloque de hijos (idéntico a nesting.slice)
        // TLx = n.x - n.w/2 ; TLy = n.y - n.h/2
        const TLx = n.x - n.w / 2;
        const TLy = n.y - n.h / 2;

        const baseX = TLx; // ox = TLx
        const baseY = TLy + info.nodeHeaderH + CONTAINER_HEADER_GAP_Y; // oy = TLy + base.h + gap

        for ( const ch of inst.children ) {
            const chInfo = computeSubtreeCached( ch );
            const rel = info.childrenPos.get( ch.nodeId )!; // top-left relativo del hijo dentro del bloque
            placeSubtree( ch, { x: baseX + rel.x, y: baseY + rel.y }, chInfo );
        }
    }

    // bottom-up por raíz (siembra caché)
    for ( const fr of frags ) {
        for ( const root of fr.roots ) {
            computeSubtreeCache.set( root.nodeId, computeSubtree( root ) );
        }
    }

    // colocar raíces por fragmento en fila
    let cursorY = 0;
    for ( const fr of frags ) {
        const infos = fr.roots.map( r => computeSubtreeCached( r ) );
        let cursorX = 0;
        for ( let i = 0; i < fr.roots.length; i++ ) {
            placeSubtree( fr.roots[ i ], { x: cursorX, y: cursorY }, infos[ i ] );
            cursorX += infos[ i ].w + LAYOUT.gapBetweenRootsX;
        }
        const blockH = Math.max( 0, ...infos.map( i => i.h ) );
        cursorY += blockH + LAYOUT.gapBetweenFragmentsY;
    }

    // --------- 4) Acciones y condiciones (layout vertical) ----------
    const actionsByNode = new Map<number, any[]>();
    for ( const a of actions ) {
        if ( !actionsByNode.has( a.originNodeId ) ) actionsByNode.set( a.originNodeId, [] );
        actionsByNode.get( a.originNodeId )!.push( a );
    }
    for ( const [ nid, arr ] of actionsByNode ) {
        const n = nodes.find( nn => nn.id === nid )!;
        arr.sort( ( a, b ) => a.id - b.id );
        let curTop = n.y + n.h / 2 + LAYOUT.nodeToActionsGapY; // top bajo el nodo
        for ( const a of arr ) {
            const am = measureActionOval( a.title, a.wrap ?? ACTION.wrap );
            a.w = am.w; a.h = am.h;
            a.x = n.x;                 // centro alineado con el nodo
            a.y = curTop + a.h / 2;    // top → centro
            curTop += a.h + LAYOUT.actionsGapY;
        }
    }

    const condsByAction = new Map<number, any[]>();
    for ( const c of conditions ) {
        if ( !condsByAction.has( c.originActionId ) ) condsByAction.set( c.originActionId, [] );
        condsByAction.get( c.originActionId )!.push( c );
    }
    for ( const [ aid, arr ] of condsByAction ) {
        const a = actions.find( x => x.id === aid );
        if ( !a ) continue;
        arr.forEach( c => {
            const cm = measureConditionOval( c.title, c.wrap ?? COND.wrap );
            c.w = cm.w; c.h = cm.h;
        } );
        const totalW = arr.reduce( ( acc, c, i ) => acc + c.w + ( i ? LAYOUT.condGapX : 0 ), 0 );
        let left = a.x - totalW / 2;                                 // izquierda del bloque
        const cyTop = a.y + a.h / 2 + LAYOUT.actionToCondsGapY;      // top de condiciones
        for ( const c of arr ) {
            c.x = left + c.w / 2;   // centro
            c.y = cyTop + c.h / 2;  // centro
            left += c.w + LAYOUT.condGapX;

            // action -> condition (edge para pintar)
            edges.push( {
                id: edgeId++,
                from: { kind: "action", id: aid },
                to: { kind: "condition", id: c.id },
                style: LAYOUT.edgeStyleNormal,
            } );
        }
    }

    // --------- 5) next* ----------
    const nextId = nodes.length ? Math.max( ...nodes.map( n => n.id ) ) + 1 : 1;
    const nextActionId = actions.length ? Math.max( ...actions.map( a => a.id ) ) + 1 : 1;
    const nextEdgeId = edges.length ? Math.max( ...edges.map( e => e.id ) ) + 1 : 1;

    return {
        nodes, actions, conditions, edges,
        nextId, nextActionId, nextEdgeId,
        panzoom: ( base as any ).panzoom,
        viewBox: ( base as any ).viewBox,
    };
}
