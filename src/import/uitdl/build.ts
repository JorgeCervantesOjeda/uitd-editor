// src/import/uitdl/build.ts
import type { UITDLDoc, UiRef } from "./types";
import type { AppState } from "../../state/types";
import type { NodeBox, ActionLabel, ConditionLabel, Edge } from "../../model/types";
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

import type { UiVerb } from "../../model/uiVerbs";
import { validateComplement, buildActionTitle } from "../../utils/actionLabel";

/** Instancia materializada de un UiRef (nodo lógico ya convertido a NodeBox). */
type NodeInst = { key: string; nodeId: number; parentId: number | null; children: NodeInst[] };

/** Construye el proyecto AppState (nodes/actions/conditions/edges) a partir del AST UITDL. */
export function buildProjectFromAST( ast: UITDLDoc, base: AppState ) {
    const nodes: NodeBox[] = [];
    const actions: ActionLabel[] = [];
    const conditions: ConditionLabel[] = [];
    const edges: Edge[] = [];

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

    // --------- Layout config ----------
    const LAYOUT = {
        gapBetweenFragmentsY: 220,
        edgeStyleNormal: "solid" as const,
        edgeStyleTransition: "dashed1" as const,
        edgeStyleActionCondition: "dashed2" as const,

        // Grid per fragment
        gridNoisePx: 14,
        gridExtraPadPx: 80,
    };

    // --------- Metadatos de bloques UI ----------
    const uiName = new Map<string, string>(); // UIKEY -> UINAME

    // UIKEY -> Map(keyString -> {verb, complement})
    const uiDeclaredActions = new Map<string, Map<string, { verb: UiVerb; complement: string }>>();
    const actionDeclKey = ( verb: UiVerb, complement: string ) => `${verb}\u0000${complement}`;

    for ( const u of ast.uiBlocks ) {
        if ( u.name ) uiName.set( u.key, u.name );
        if ( !uiDeclaredActions.has( u.key ) ) uiDeclaredActions.set( u.key, new Map() );

        for ( const a of u.actions ) {
            const verb = a.verb as UiVerb;
            const complement = ( a.complement ?? "" ).trim();

            const chk = validateComplement( complement );
            if ( !chk.ok ) continue;

            uiDeclaredActions.get( u.key )!.set(
                actionDeclKey( verb, complement ),
                { verb, complement }
            );
        }
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

    // width (wrap) efectivo: transición > fragment default > default global
    const effectiveWrap = ( fragIndex: number, trWidth?: number ) => {
        const frag = ast.fragments[ fragIndex ];
        const fragW = frag?.widthDefault;
        const w = trWidth ?? fragW ?? ACTION.wrap;
        const n = Number( w );
        return Number.isFinite( n ) && n > 0 ? n : ACTION.wrap;
    };

    // --------- Acciones/Condiciones y edges ----------
    const actionKey = ( nodeId0: number, verb: UiVerb, complement: string ) =>
        `${nodeId0}::${verb}::${complement}`;

    const actionMap = new Map<string, number>();              // (nodeId::verb::comp) -> actionId
    const condSetByActionId = new Map<number, Set<string>>(); // actionId -> set(condTitle)

    // Para evitar duplicar action->condition
    const acEdgeKey = ( aId: number, cId: number ) => `${aId}->${cId}`;
    const acEdgeSet = new Set<string>();

    const ensureActionToConditionEdge = ( aId: number, cId: number ) => {
        const k = acEdgeKey( aId, cId );
        if ( acEdgeSet.has( k ) ) return;

        const exists = edges.some(
            ( e ) =>
                e?.from?.kind === "action" &&
                e.from.id === aId &&
                e?.to?.kind === "condition" &&
                e.to.id === cId
        );
        if ( exists ) {
            acEdgeSet.add( k );
            return;
        }

        edges.push( {
            id: edgeId++,
            from: { kind: "action", id: aId },
            to: { kind: "condition", id: cId },
            style: LAYOUT.edgeStyleActionCondition,
        } );

        acEdgeSet.add( k );
    };

    const pushAction = ( nodeId0: number, verb: UiVerb, complement: string, wrapWanted?: number ): number => {
        const comp = ( complement ?? "" ).trim();
        const k = actionKey( nodeId0, verb, comp );
        const cached = actionMap.get( k );
        if ( cached != null ) {
            const a = actions.find( x => x.id === cached );
            if ( a && wrapWanted != null ) {
                const prev = a.wrap ?? ACTION.wrap;
                const next = Math.min( prev, wrapWanted );
                if ( next !== prev ) {
                    a.wrap = next;
                    const am = measureActionOval( a.title, a.wrap );
                    a.w = am.w; a.h = am.h;
                }
            }
            return cached;
        }

        const chk = validateComplement( comp );
        if ( !chk.ok ) return -1;

        const newId = actionId++;
        const wrap = wrapWanted ?? ACTION.wrap;

        const title = buildActionTitle( verb, comp );
        const am = measureActionOval( title, wrap );

        actions.push( {
            id: newId,
            originNodeId: nodeId0,
            x: 0, y: 0,
            w: am.w, h: am.h,

            verb,
            complement: comp, // SIN comillas
            title,            // con comillas visibles

            wrap,
            colorFill: ACTION.colorFill,
            colorStroke: ACTION.colorStroke,
            colorText: ACTION.colorText,
        } );

        // Edge node -> action
        edges.push( {
            id: edgeId++,
            from: { kind: "node", id: nodeId0 },
            to: { kind: "action", id: newId },
            style: LAYOUT.edgeStyleNormal,
        } );

        actionMap.set( k, newId );
        return newId;
    };

    const addConditionIfNew = ( actionId0: number, condTitle: string, wrapWanted?: number ): number | null => {
        if ( !condSetByActionId.has( actionId0 ) ) condSetByActionId.set( actionId0, new Set() );
        const set = condSetByActionId.get( actionId0 )!;
        if ( set.has( condTitle ) ) {
            // ya existe: quizá ajustar wrap si llega más estricto
            const c = conditions.find( x => x.originActionId === actionId0 && x.title === condTitle );
            if ( c && wrapWanted != null ) {
                const prev = c.wrap ?? COND.wrap;
                const next = Math.min( prev, wrapWanted );
                if ( next !== prev ) {
                    c.wrap = next;
                    const cm = measureConditionOval( c.title, c.wrap );
                    c.w = cm.w; c.h = cm.h;
                }
            }
            return null;
        }

        set.add( condTitle );
        const cId = conditionId++;
        const wrap = wrapWanted ?? COND.wrap;
        const cm = measureConditionOval( condTitle, wrap );
        conditions.push( {
            id: cId,
            originActionId: actionId0,
            title: condTitle,
            x: 0, y: 0,
            w: cm.w, h: cm.h,
            wrap,
            colorFill: COND.colorFill,
            colorStroke: COND.colorStroke,
            colorText: COND.colorText,
        } );
        return cId;
    };

    const firstInstanceByKey = new Map<string, number>();
    const sourceInstancesByKey = new Map<string, Set<number>>();

    // --------- 1) Procesar transiciones ----------
    for ( let fi = 0; fi < ast.fragments.length; fi++ ) {
        const frag = ast.fragments[ fi ];
        const { allByKey } = frags[ fi ];

        // primar primera instancia de cada UIKEY
        for ( const [ k, arr ] of allByKey ) {
            if ( !firstInstanceByKey.has( k ) && arr.length ) firstInstanceByKey.set( k, arr[ 0 ].nodeId );
        }

        for ( const tr of frag.transitions ) {
            // FROM candidates
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
                    else continue;
                }
            }

            // TO candidates
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
                    else continue;
                }
            }

            if ( !fromCandidates.length || !toCandidates.length ) continue;

            const verb = tr.verb as UiVerb;
            const comp = ( tr.complement ?? "" ).trim();

            const chk = validateComplement( comp );
            if ( !chk.ok ) continue;

            const condTitle = ( tr.condLabel || "" ).trim();
            const hasCond = condTitle.length > 0 && condTitle.toLowerCase() !== "empty";

            const wrap = effectiveWrap( fi, tr.width );

            for ( const src of fromCandidates ) {
                if ( !sourceInstancesByKey.has( src.key ) ) sourceInstancesByKey.set( src.key, new Set() );
                sourceInstancesByKey.get( src.key )!.add( src.nodeId );

                const aId = pushAction( src.nodeId, verb, comp, wrap );
                if ( aId < 0 ) continue;

                for ( const dst of toCandidates ) {
                    if ( hasCond ) {
                        // agrega/ajusta cond (wrap también)
                        let condId =
                            conditions.find( c => c.originActionId === aId && c.title === condTitle )?.id ?? null;
                        if ( condId == null ) {
                            const made = addConditionIfNew( aId, condTitle, wrap );
                            if ( made != null ) condId = made;
                        } else {
                            // si ya existe, quizá ajustar wrap
                            addConditionIfNew( aId, condTitle, wrap );
                        }

                        if ( condId != null ) {
                            // ✅ Garantiza action -> condition (para “?”)
                            ensureActionToConditionEdge( aId, condId );

                            edges.push( {
                                id: edgeId++,
                                from: { kind: "condition", id: condId },
                                to: { kind: "node", id: dst.nodeId },
                                style: LAYOUT.edgeStyleTransition,
                            } );
                        }
                    } else {
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
    for ( const [ key, declaredMap ] of uiDeclaredActions ) {
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

        for ( const decl of declaredMap.values() ) {
            const k = actionKey( targetNodeId, decl.verb, decl.complement );
            if ( actionMap.has( k ) ) continue;

            const chk = validateComplement( decl.complement );
            if ( !chk.ok ) continue;

            const aId = actionId++;
            const wrap = ACTION.wrap;

            const title = buildActionTitle( decl.verb, decl.complement );
            const am = measureActionOval( title, wrap );

            actions.push( {
                id: aId,
                originNodeId: targetNodeId,
                x: 0, y: 0,
                w: am.w, h: am.h,

                verb: decl.verb,
                complement: decl.complement,
                title,

                wrap,
                colorFill: ACTION.colorFill,
                colorStroke: ACTION.colorStroke,
                colorText: ACTION.colorText,
            } );

            edges.push( {
                id: edgeId++,
                from: { kind: "node", id: targetNodeId },
                to: { kind: "action", id: aId },
                style: LAYOUT.edgeStyleNormal,
            } );

            actionMap.set( k, aId );
        }
    }

    // ============================================================
    // 3) TAMAÑOS/LAYOUT BOTTOM-UP para nodos (respeta anidamiento)
    // ============================================================
    type SubtreeInfo = {
        w: number; h: number;
        nodeHeaderW: number; nodeHeaderH: number;
        childrenW: number; childrenH: number;
        childrenPos: Map<number, { x: number; y: number }>;
    };

    const computeSubtreeCache = new Map<number, SubtreeInfo>();

    function computeSubtree( inst: NodeInst ): SubtreeInfo {
        const n = nodes.find( v => v.id === inst.nodeId )!;

        const childInfos = inst.children.map( ch => computeSubtree( ch ) );
        const childSizes: Size[] = childInfos.map( ci => ( { w: ci.w, h: ci.h } ) );

        const nm = measureNodeSizeWithId( n.displayId ?? n.id, n.title, n.wrap ?? NODE.wrap );
        const nodeHeaderW = nm.w;
        const nodeHeaderH = nm.h;

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
                const p = packed.positions[ i ];
                childrenPos.set( ch.nodeId, { x: p.x, y: p.y } );
            }
        }

        const totalW = Math.max( nodeHeaderW, childrenW );
        const totalH = nodeHeaderH + ( childSizes.length ? CONTAINER_HEADER_GAP_Y : 0 ) + childrenH;

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

    function placeSubtree( inst: NodeInst, topLeft: { x: number; y: number }, info: SubtreeInfo ) {
        const n = nodes.find( v => v.id === inst.nodeId )!;
        const nodeW = n.w ?? info.w;
        const nodeH = n.h ?? info.h;

        n.x = topLeft.x + nodeW / 2;
        n.y = topLeft.y + nodeH / 2;

        if ( inst.children.length === 0 ) return;

        const TLx = n.x - nodeW / 2;
        const TLy = n.y - nodeH / 2;

        const baseX = TLx;
        const baseY = TLy + info.nodeHeaderH + CONTAINER_HEADER_GAP_Y;

        for ( const ch of inst.children ) {
            const chInfo = computeSubtreeCached( ch );
            const rel = info.childrenPos.get( ch.nodeId )!;
            placeSubtree( ch, { x: baseX + rel.x, y: baseY + rel.y }, chInfo );
        }
    }

    for ( const fr of frags ) {
        for ( const root of fr.roots ) {
            computeSubtreeCache.set( root.nodeId, computeSubtree( root ) );
        }
    }

    // ============================================================
    // 4) GRID por fragmento (raíces + acciones + condiciones) con jitter
    // ============================================================

    function jitter( mag: number ) {
        return ( Math.random() * 2 - 1 ) * mag;
    }

    function collectAllNodeIdsInFrag( roots: NodeInst[] ): number[] {
        const out: number[] = [];
        const st: NodeInst[] = [ ...roots ];
        while ( st.length ) {
            const cur = st.pop()!;
            out.push( cur.nodeId );
            for ( const ch of cur.children ) st.push( ch );
        }
        return out;
    }

    // Re-medir ovals (wrap ya establecido)
    for ( const a of actions ) {
        const am = measureActionOval( a.title, a.wrap ?? ACTION.wrap );
        a.w = am.w; a.h = am.h;
    }
    for ( const c of conditions ) {
        const cm = measureConditionOval( c.title, c.wrap ?? COND.wrap );
        c.w = cm.w; c.h = cm.h;
    }

    let cursorY = 0;

    for ( let fi = 0; fi < frags.length; fi++ ) {
        const fr = frags[ fi ];

        const nodeIdsInFrag = new Set<number>( collectAllNodeIdsInFrag( fr.roots ) );
        const actionsInFrag = actions.filter( a => nodeIdsInFrag.has( a.originNodeId ) );
        const actionIdSet = new Set<number>( actionsInFrag.map( a => a.id ) );
        const condsInFrag = conditions.filter( c => actionIdSet.has( c.originActionId ) );

        const roots = fr.roots;
        const rootInfos = roots.map( r => computeSubtreeCached( r ) );

        type GridItem =
            | { kind: "root"; idx: number; w: number; h: number }
            | { kind: "action"; id: number; w: number; h: number }
            | { kind: "condition"; id: number; w: number; h: number };

        const items: GridItem[] = [];
        for ( let i = 0; i < roots.length; i++ ) {
            items.push( { kind: "root", idx: i, w: rootInfos[ i ].w, h: rootInfos[ i ].h } );
        }
        for ( const a of actionsInFrag ) items.push( { kind: "action", id: a.id, w: a.w ?? 120, h: a.h ?? 60 } );
        for ( const c of condsInFrag ) items.push( { kind: "condition", id: c.id, w: c.w ?? 120, h: c.h ?? 60 } );

        const nItems = items.length;
        if ( nItems === 0 ) continue;

        const gridCols = Math.max( 1, Math.ceil( Math.sqrt( nItems ) ) );
        const gridRows = Math.ceil( nItems / gridCols );

        let maxDim = 0;
        for ( const it of items ) maxDim = Math.max( maxDim, it.w, it.h );
        const CELL = maxDim + LAYOUT.gridExtraPadPx;

        const baseX0 = 0;
        const baseY0 = cursorY;

        const actionById = new Map<number, ActionLabel>( actions.map( a => [ a.id, a ] ) );
        const condById = new Map<number, ConditionLabel>( conditions.map( c => [ c.id, c ] ) );

        for ( let i = 0; i < nItems; i++ ) {
            const col = i % gridCols;
            const row = Math.floor( i / gridCols );

            const cellTLx = baseX0 + col * CELL + jitter( LAYOUT.gridNoisePx );
            const cellTLy = baseY0 + row * CELL + jitter( LAYOUT.gridNoisePx );

            const it = items[ i ];
            if ( it.kind === "root" ) {
                const root = roots[ it.idx ];
                const info = rootInfos[ it.idx ];
                placeSubtree( root, { x: cellTLx, y: cellTLy }, info );
            } else if ( it.kind === "action" ) {
                const a = actionById.get( it.id );
                if ( !a ) continue;
                a.x = cellTLx + ( a.w ?? it.w ) / 2;
                a.y = cellTLy + ( a.h ?? it.h ) / 2;
            } else {
                const c = condById.get( it.id );
                if ( !c ) continue;
                c.x = cellTLx + ( c.w ?? it.w ) / 2;
                c.y = cellTLy + ( c.h ?? it.h ) / 2;
            }
        }

        const blockH = gridRows * CELL;
        cursorY += blockH + LAYOUT.gapBetweenFragmentsY;
    }

    // ============================================================
    // 5) Asegurar edge action -> condition (para marcador “?”)
    // ============================================================
    for ( const e of edges ) {
        if ( e?.from?.kind === "action" && e?.to?.kind === "condition" ) {
            acEdgeSet.add( acEdgeKey( e.from.id, e.to.id ) );
        }
    }
    for ( const c of conditions ) {
        ensureActionToConditionEdge( c.originActionId, c.id );
    }

    // --------- next* ----------
    const nextId = nodes.length ? Math.max( ...nodes.map( n => n.id ) ) + 1 : 1;
    const nextActionId = actions.length ? Math.max( ...actions.map( a => a.id ) ) + 1 : 1;
    const nextEdgeId = edges.length ? Math.max( ...edges.map( e => e.id ) ) + 1 : 1;

    return {
        nodes, actions, conditions, edges,
        nextId, nextActionId, nextEdgeId,
        panzoom: base.panzoom,
        viewBox: base.viewBox,
    };
}
