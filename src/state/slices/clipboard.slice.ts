// src/state/slices/clipboard.slice.ts
import type {
    AppState,
    NodeId,
    ActionId,
    ConditionId,
    ClipboardPayload,
} from "../types";
import type {
    NodeBox,
    ActionLabel,
    ConditionLabel,
    Edge,
} from "../../model/types";

/** BBox center de un conjunto de nodos (usa w/h si existen) */
function bboxOfNodes( nodes: NodeBox[] ) {
    if ( nodes.length === 0 ) return { cx: 0, cy: 0 };
    const lefts = nodes.map( ( n ) => n.x - ( n.w ?? 0 ) / 2 );
    const rights = nodes.map( ( n ) => n.x + ( n.w ?? 0 ) / 2 );
    const tops = nodes.map( ( n ) => n.y - ( n.h ?? 0 ) / 2 );
    const bottoms = nodes.map( ( n ) => n.y + ( n.h ?? 0 ) / 2 );
    const minX = Math.min( ...lefts );
    const maxX = Math.max( ...rights );
    const minY = Math.min( ...tops );
    const maxY = Math.max( ...bottoms );
    return { cx: ( minX + maxX ) / 2, cy: ( minY + maxY ) / 2 };
}

/** Centro de respaldo si no hay nodos: media de acciones/condiciones */
function centroidOfLabels(
    actions: ActionLabel[],
    conditions: ConditionLabel[]
) {
    const xs = [ ...actions.map( ( a ) => a.x ), ...conditions.map( ( c ) => c.x ) ];
    const ys = [ ...actions.map( ( a ) => a.y ), ...conditions.map( ( c ) => c.y ) ];
    if ( xs.length === 0 ) return { cx: 0, cy: 0 };
    const cx = xs.reduce( ( p, q ) => p + q, 0 ) / xs.length;
    const cy = ys.reduce( ( p, q ) => p + q, 0 ) / ys.length;
    return { cx, cy };
}

export const clipboardSlice = ( set: any, get: () => AppState ) => ( {
    // Portapapeles en memoria (no persistir)
    _clipboard: null as ClipboardPayload | null,

    /** Copiar selección actual (nodos + acciones + condiciones + aristas) */
    copySelectionToClipboard: () => {
        const s = get();
        const selNodes = s.selection ?? new Set<NodeId>();
        const selActs = s.selectionActions ?? new Set<ActionId>();
        const selConds = s.selectionConds ?? new Set<ConditionId>();

        if ( selNodes.size === 0 && selActs.size === 0 && selConds.size === 0 ) {
            set( { _clipboard: null } );
            return;
        }

        // Copiar entidades seleccionadas (clon superficial)
        const nodes: NodeBox[] = s.nodes
            .filter( ( n ) => selNodes.has( n.id ) )
            .map( ( n ) => ( { ...n } ) );
        const actions: ActionLabel[] = s.actions
            .filter( ( a ) => selActs.has( a.id ) )
            .map( ( a ) => ( { ...a } ) );
        const conditions: ConditionLabel[] = s.conditions
            .filter( ( c ) => selConds.has( c.id ) )
            .map( ( c ) => ( { ...c } ) );

        // Conjuntos para chequear pertenencia
        const nodeIds = new Set( nodes.map( ( n ) => n.id ) );
        const actIds = new Set( actions.map( ( a ) => a.id ) );
        const condIds = new Set( conditions.map( ( c ) => c.id ) );

        // 1) Aristas internas (ambos extremos dentro del subconjunto copiado)
        const internalEdges: Edge[] = s.edges
            .filter( ( e ) => {
                const hit = ( ep: Edge[ "from" ] | Edge[ "to" ] ) => {
                    if ( ep.kind === "node" ) return nodeIds.has( ep.id );
                    if ( ep.kind === "action" ) return actIds.has( ep.id );
                    return condIds.has( ep.id );
                };
                return hit( e.from ) && hit( e.to );
            } )
            .map( ( e ) => ( { ...e } ) );

        // 2) NUEVO: Aristas que LLEGAN a actions / conditions seleccionados,
        //    aunque su origen NO esté seleccionado.
        const incomingEdges: Edge[] = s.edges
            .filter( ( e ) => {
                const t = e.to;
                return (
                    ( t.kind === "action" && selActs.has( t.id ) ) ||
                    ( t.kind === "condition" && selConds.has( t.id ) )
                );
            } )
            .map( ( e ) => ( { ...e } ) );

        // Unificar por id para evitar duplicados si alguna ya era interna
        const byId = new Map<number, Edge>();
        for ( const e of [ ...internalEdges, ...incomingEdges ] ) {
            byId.set( e.id, e );
        }
        const edges = Array.from( byId.values() );

        // Centro de origen (para pegado cerca del copiado)
        let origin = { cx: 0, cy: 0 };
        if ( nodes.length > 0 ) {
            origin = bboxOfNodes( nodes );
        } else {
            origin = centroidOfLabels( actions, conditions );
        }

        const payload: ClipboardPayload = {
            nodes,
            actions,
            conditions,
            edges,
            origin,
            pasteCount: 0,
        };

        set( { _clipboard: payload } );
    },

    /** Cortar = copiar + borrar (preserva _clipboard recién armado) */
    cutSelectionToClipboard: () => {
        const s = get();
        s.copySelectionToClipboard?.();
        s.deleteSelected?.();
    },

    /**
     * Pegar en coordenadas dadas (worldX, worldY).
     * - Nuevos IDs para todo.
     * - Si el origen de una arista NO fue copiado, la arista conserva ese id de origen.
     * - Reubica por delta respecto al centro ORIGEN guardado.
     */
    pasteFromClipboardAt: ( worldX: number, worldY: number ) => {
        const s = get();
        const clip = s._clipboard as ClipboardPayload | null;
        if ( !clip ) return;

        // Δ respecto del origen guardado
        const dx = worldX - clip.origin.cx;
        const dy = worldY - clip.origin.cy;

        // Secuencias
        let nextNodeId = s.nextId;
        let nextActionId = s.nextActionId;
        let nextEdgeId = s.nextEdgeId;

        // Conditions: secuencia local (no hay nextConditionId global)
        let condSeq = Math.max(
            0,
            ...s.conditions.map( ( c ) => c.id ),
            ...clip.conditions.map( ( c ) => c.id )
        );

        // Remapeos
        const nodeIdMap = new Map<number, number>();
        const actIdMap = new Map<number, number>();
        const condIdMap = new Map<number, number>();

        // Nodos (incluye remapeo de parentId si el padre venía en la copia)
        const newNodes: NodeBox[] = clip.nodes
            .map( ( n ) => {
                const nid = nextNodeId++;
                nodeIdMap.set( n.id, nid );
                return {
                    ...n,
                    id: nid,
                    x: n.x + dx,
                    y: n.y + dy,
                };
            } )
            .map( ( n ) => {
                const oldParent = n.parentId ?? null;
                if ( oldParent != null && nodeIdMap.has( oldParent ) ) {
                    return { ...n, parentId: nodeIdMap.get( oldParent )! as NodeId };
                }
                return n;
            } );

        // Acciones
        const newActions: ActionLabel[] = clip.actions.map( ( a ) => {
            const aid = nextActionId++;
            actIdMap.set( a.id, aid );
            return {
                ...a,
                id: aid,
                originNodeId: nodeIdMap.get( a.originNodeId ) ?? a.originNodeId,
                x: a.x + dx,
                y: a.y + dy,
            };
        } );

        // Condiciones
        const newConds: ConditionLabel[] = clip.conditions.map( ( c ) => {
            const newId = ++condSeq;
            condIdMap.set( c.id, newId );
            return {
                ...c,
                id: newId,
                originActionId: actIdMap.get( c.originActionId ) ?? c.originActionId,
                x: c.x + dx,
                y: c.y + dy,
            };
        } );

        // Aristas (remapea endpoints si fueron copiados; si no, conserva el id original)
        const remapEp = (
            ep: Edge[ "from" ] | Edge[ "to" ]
        ): Edge[ "from" ] | Edge[ "to" ] => {
            if ( ep.kind === "node" ) {
                return { kind: "node", id: nodeIdMap.get( ep.id ) ?? ep.id };
            }
            if ( ep.kind === "action" ) {
                return { kind: "action", id: actIdMap.get( ep.id ) ?? ep.id };
            }
            return { kind: "condition", id: condIdMap.get( ep.id ) ?? ep.id };
        };

        const newEdges: Edge[] = clip.edges.map( ( e ) => ( {
            ...e,
            id: nextEdgeId++,
            from: remapEp( e.from ) as any,
            to: remapEp( e.to ) as any,
        } ) );

        // Commit + selección de lo pegado
        set( {
            nodes: [ ...s.nodes, ...newNodes ],
            actions: [ ...s.actions, ...newActions ],
            conditions: [ ...s.conditions, ...newConds ],
            edges: [ ...s.edges, ...newEdges ],
            nextId: nextNodeId,
            nextActionId: nextActionId,
            nextEdgeId: nextEdgeId,
            selection: new Set<NodeId>( newNodes.map( ( n ) => n.id ) ),
            selectionActions: new Set<ActionId>( newActions.map( ( a ) => a.id ) ),
            selectionConds: new Set<ConditionId>( newConds.map( ( c ) => c.id ) ),
        } );
    },

    /**
     * Alias sin parámetros: pega CERCA del origen copiado (offset incremental).
     */
    pasteFromClipboard: () => {
        const s = get();
        const clip = s._clipboard as ClipboardPayload | null;
        if ( !clip ) return;
        const step = 16;
        const k = ( clip.pasteCount ?? 0 ) + 1;
        const targetX = clip.origin.cx + step * k;
        const targetY = clip.origin.cy + step * k;
        s.pasteFromClipboardAt?.( targetX, targetY );
        set( { _clipboard: { ...clip, pasteCount: k } } );
    },
} );
