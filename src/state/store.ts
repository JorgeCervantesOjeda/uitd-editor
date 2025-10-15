// src/state/store.ts
// Estado global (Zustand) para el editor UITD.

import { create } from "zustand";
import type {
    Point,
    NodeBox,
    NodeId,
    ActionLabel,
    ActionId,
    ConditionLabel,
    ConditionId,
    Edge,
    EdgeEndpoint,
} from "../model/types";
import { measureActionOval } from "../layout/measurement";

export type PendingConnect =
    | { mode: "action-to-target"; fromActionId: ActionId; mouse: Point }
    | { mode: "condition-to-target"; fromConditionId: ConditionId; mouse: Point }
    | null;

export type AppState = {
    // Cámara
    panzoom: { x: number; y: number; zoom: number };
    setPan: ( dx: number, dy: number ) => void;
    setZoomAnchored: ( newZoom: number, anchorWorld: Point ) => void;

    // Tamaño de lienzo (viewBox)
    viewBox: { w: number; h: number };
    setViewBox: ( w: number, h: number ) => void;

    // Entidades
    nodes: NodeBox[];
    actions: ActionLabel[];
    conditions: ConditionLabel[];
    edges: Edge[];

    // Secuencias de IDs
    nextId: number;        // para NodeId y ConditionId
    nextActionId: number;  // para ActionId
    nextEdgeId: number;

    // Selección
    selection: Set<NodeId>;
    selectionActions: Set<ActionId>;
    selectionConds: Set<ConditionId>;
    clearSelection: () => void;

    // Creación
    createNodeAt: ( worldX: number, worldY: number ) => void;
    addActionForNode: ( nodeId: NodeId ) => void;

    // Condiciones (incluye conversión de arista directa)
    handleCreateCondition: ( actionId: ActionId ) => void;

    // Conexiones (rubber-banding)
    pendingConnect: PendingConnect;
    beginGoToTarget: ( actionId: ActionId ) => void;
    beginRubberFromCondition: ( conditionId: ConditionId ) => void;
    updatePendingMouse: ( world: Point ) => void;
    commitTargetToNode: ( nodeId: NodeId ) => void;
    cancelPending: () => void;

    // Selección granular
    selectSingleOrKeep: ( id: NodeId, keepIfAlreadySelected: boolean ) => void;
    toggleSelect: ( id: NodeId ) => void;
    selectSingleOrKeepAction: ( id: ActionId, keepIfAlreadySelected: boolean ) => void;
    toggleSelectAction: ( id: ActionId ) => void;
    selectSingleOrKeepCondition: ( id: ConditionId, keepIfAlreadySelected: boolean ) => void;
    toggleSelectCondition: ( id: ConditionId ) => void;

    // Drag combinado
    drag: {
        active: boolean;
        anchor: Point;
        startNodes: Map<NodeId, { x: number; y: number }>;
        startActions: Map<ActionId, { x: number; y: number }>;
        startConds: Map<ConditionId, { x: number; y: number }>;
    };
    beginCombinedDrag: (
        anchor: Point,
        nodeIds: Set<NodeId>,
        actionIds: Set<ActionId>,
        condIds: Set<ConditionId>
    ) => void;
    updateCombinedDrag: ( current: Point ) => void;
    endCombinedDrag: () => void;

    // Edición
    renameNode: ( id: NodeId, title: string ) => void;
    renameAction: ( id: ActionId, title: string ) => void;
    renameCondition: ( id: ConditionId, title: string ) => void;
    deleteSelected: () => void;

    // Colores
    setNodeColors: ( id: NodeId, colors: { fill?: string; stroke?: string; text?: string } ) => void;
};

const DEFAULT_NODE_FILL = "#f1f5f9";
const DEFAULT_NODE_STROKE = "#94a3b8";
const DEFAULT_NODE_TEXT = "#334155";

const DEFAULT_LABEL_FILL = "#eef2ff";
const DEFAULT_LABEL_STROKE = "#6366f1";
const DEFAULT_LABEL_TEXT = "#1e293b";

export const useAppStore = create<AppState>( ( set, get ) => ( {
    // Cámara
    panzoom: { x: 0, y: 0, zoom: 1 },

    setPan: ( dx, dy ) => {
        const pz = get().panzoom;
        set( { panzoom: { ...pz, x: pz.x + dx, y: pz.y + dy } } );
    },

    setZoomAnchored: ( newZoom, anchor ) => {
        const pz = get().panzoom;
        const clamped = Math.min( 8.0, Math.max( 0.25, newZoom ) );
        if ( clamped === pz.zoom ) return;
        const panX = pz.x + ( pz.zoom - clamped ) * anchor.x;
        const panY = pz.y + ( pz.zoom - clamped ) * anchor.y;
        set( { panzoom: { x: panX, y: panY, zoom: clamped } } );
    },

    // viewBox
    viewBox: { w: 800, h: 600 },
    setViewBox: ( w, h ) => set( { viewBox: { w, h } } ),

    // Entidades
    nodes: [],
    actions: [],
    conditions: [],
    edges: [],
    nextId: 1,
    nextActionId: 1,
    nextEdgeId: 1,

    // Selección
    selection: new Set<NodeId>(),
    selectionActions: new Set<ActionId>(),
    selectionConds: new Set<ConditionId>(),

    clearSelection: () =>
        set( {
            selection: new Set<NodeId>(),
            selectionActions: new Set<ActionId>(),
            selectionConds: new Set<ConditionId>(),
        } ),

    // Crear nodo en (worldX, worldY)
    createNodeAt: ( worldX, worldY ) => {
        const id = get().nextId;
        const node: NodeBox = {
            id,
            x: worldX,
            y: worldY,
            title: `Node ${id}`,
            wrap: 22,
            colorFill: DEFAULT_NODE_FILL,
            colorStroke: DEFAULT_NODE_STROKE,
            colorText: DEFAULT_NODE_TEXT,
        };
        set( ( s ) => ( {
            nodes: [ ...s.nodes, node ],
            selection: new Set<NodeId>( [ id ] ),
            selectionActions: new Set<ActionId>(),
            selectionConds: new Set<ConditionId>(),
            nextId: id + 1,
        } ) );
    },

    // Crear acción para un nodo y arista node->action (sólida)
    addActionForNode: ( nodeId ) => {
        const node = get().nodes.find( ( n ) => n.id === nodeId );
        if ( !node ) return;

        const actionId = get().nextActionId;
        const title = "action";
        const wrap = 22;
        const m = measureActionOval( title, wrap );

        const ax = node.x + 60 + m.w / 2;
        const ay = node.y + 24 + m.h / 2;

        const action: ActionLabel = {
            id: actionId,
            originNodeId: nodeId,
            x: ax,
            y: ay,
            title,
            wrap,
            // herencia por copia (fondo/borde) desde el nodo
            colorFill: node.colorFill ?? DEFAULT_LABEL_FILL,
            colorStroke: node.colorStroke ?? DEFAULT_LABEL_STROKE,
            colorText: DEFAULT_LABEL_TEXT,
        };

        const edgeId = get().nextEdgeId;
        const edge: Edge = {
            id: edgeId,
            from: { kind: "node", id: nodeId },
            to: { kind: "action", id: actionId },
            style: "solid",
        };

        set( ( s ) => ( {
            actions: [ ...s.actions, action ],
            edges: [ ...s.edges, edge ],
            nextActionId: actionId + 1,
            nextEdgeId: edgeId + 1,
        } ) );
    },

    // Crear condición desde acción (y conversión si hay arista directa)
    handleCreateCondition: ( actionId ) => {
        const { edges, actions, conditions, nextId, nextEdgeId, nodes } = get();
        const action = actions.find( ( a ) => a.id === actionId );
        if ( !action ) return;

        const originNode = nodes.find( ( n ) => n.id === action.originNodeId );
        const inheritFill = originNode?.colorFill ?? DEFAULT_LABEL_FILL;
        const inheritStroke = originNode?.colorStroke ?? DEFAULT_LABEL_STROKE;

        let newEdges = [ ...edges ];
        const newConditions = [ ...conditions ];
        let idCursor = nextId;
        let edgeCursor = nextEdgeId;

        // ¿Existe arista directa action->node?
        const direct = newEdges.find(
            ( e ) => e.from.kind === "action" && e.from.id === actionId && e.to.kind === "node"
        );

        if ( direct ) {
            const nodeTargetId = direct.to.id;
            // eliminar arista directa
            newEdges = newEdges.filter( ( e ) => e !== direct );

            // condición "empty" para conversión (hereda colores del nodo origen)
            const condId = idCursor++;
            newConditions.push( {
                id: condId,
                originActionId: actionId,
                title: "empty",
                x: action.x + 40,
                y: action.y,
                wrap: 22,
                colorFill: inheritFill,
                colorStroke: inheritStroke,
                colorText: DEFAULT_LABEL_TEXT,
            } );

            // action->cond (dashed2) y cond->nodeTarget (dashed1)
            newEdges.push(
                { id: edgeCursor++, from: { kind: "action", id: actionId }, to: { kind: "condition", id: condId }, style: "dashed2" },
                { id: edgeCursor++, from: { kind: "condition", id: condId }, to: { kind: "node", id: nodeTargetId }, style: "dashed1" },
            );
        }

        // Siempre crear nueva condición "empty" para rubber-banding (hereda colores)
        const newCondId = idCursor++;
        newConditions.push( {
            id: newCondId,
            originActionId: actionId,
            title: "empty",
            x: action.x + 40,
            y: action.y + 40,
            wrap: 22,
            colorFill: inheritFill,
            colorStroke: inheritStroke,
            colorText: DEFAULT_LABEL_TEXT,
        } );

        newEdges.push( {
            id: edgeCursor++,
            from: { kind: "action", id: actionId },
            to: { kind: "condition", id: newCondId },
            style: "dashed2",
        } );

        set( {
            conditions: newConditions,
            edges: newEdges,
            nextId: idCursor,
            nextEdgeId: edgeCursor,
        } );

        // Rubber-band desde la nueva condición
        get().beginRubberFromCondition( newCondId );
    },

    // Rubber-banding
    pendingConnect: null,

    beginGoToTarget: ( actionId ) => {
        // “Go to target” solo si no hay aristas salientes desde la acción
        const hasOutgoing = get().edges.some( ( e ) => e.from.kind === "action" && e.from.id === actionId );
        if ( hasOutgoing ) return;

        const act = get().actions.find( ( a ) => a.id === actionId );
        if ( !act ) return;

        set( {
            pendingConnect: {
                mode: "action-to-target",
                fromActionId: actionId,
                mouse: { x: act.x, y: act.y },
            },
        } );
    },

    beginRubberFromCondition: ( conditionId ) => {
        const cond = get().conditions.find( ( c ) => c.id === conditionId );
        if ( !cond ) return;

        set( {
            pendingConnect: {
                mode: "condition-to-target",
                fromConditionId: conditionId,
                mouse: { x: cond.x, y: cond.y },
            },
        } );
    },

    updatePendingMouse: ( world ) => {
        const p = get().pendingConnect;
        if ( !p ) return;
        set( { pendingConnect: { ...p, mouse: { x: world.x, y: world.y } } } );
    },

    commitTargetToNode: ( nodeId ) => {
        const p = get().pendingConnect;
        if ( !p ) return;

        let from: EdgeEndpoint;
        if ( p.mode === "action-to-target" ) from = { kind: "action", id: p.fromActionId };
        else from = { kind: "condition", id: p.fromConditionId };

        const edgeId = get().nextEdgeId;
        const edge: Edge = { id: edgeId, from, to: { kind: "node", id: nodeId }, style: "dashed1" };

        set( ( s ) => ( {
            edges: [ ...s.edges, edge ],
            nextEdgeId: edgeId + 1,
            pendingConnect: null,
        } ) );
    },

    cancelPending: () => set( { pendingConnect: null } ),

    // Selección nodos
    selectSingleOrKeep: ( id, keep ) => {
        const sel = new Set( get().selection );
        if ( keep && sel.has( id ) ) {
            set( { selection: sel } );
            return;
        }
        sel.clear();
        sel.add( id );
        set( {
            selection: sel,
            selectionActions: new Set<ActionId>(),
            selectionConds: new Set<ConditionId>(),
        } );
    },

    toggleSelect: ( id ) => {
        const sel = new Set( get().selection );
        if ( sel.has( id ) ) sel.delete( id );
        else sel.add( id );
        set( { selection: sel } );
    },

    // Selección acciones
    selectSingleOrKeepAction: ( id, keep ) => {
        const sel = new Set( get().selectionActions );
        if ( keep && sel.has( id ) ) {
            set( { selectionActions: sel } );
            return;
        }
        sel.clear();
        sel.add( id );
        set( {
            selectionActions: sel,
            selection: new Set<NodeId>(),
            selectionConds: new Set<ConditionId>(),
        } );
    },

    toggleSelectAction: ( id ) => {
        const sel = new Set( get().selectionActions );
        if ( sel.has( id ) ) sel.delete( id );
        else sel.add( id );
        set( { selectionActions: sel } );
    },

    // Selección condiciones
    selectSingleOrKeepCondition: ( id, keep ) => {
        const sel = new Set( get().selectionConds );
        if ( keep && sel.has( id ) ) {
            set( { selectionConds: sel } );
            return;
        }
        sel.clear();
        sel.add( id );
        set( {
            selectionConds: sel,
            selection: new Set<NodeId>(),
            selectionActions: new Set<ActionId>(),
        } );
    },

    toggleSelectCondition: ( id ) => {
        const sel = new Set( get().selectionConds );
        if ( sel.has( id ) ) sel.delete( id );
        else sel.add( id );
        set( { selectionConds: sel } );
    },

    // Drag combinado
    drag: {
        active: false,
        anchor: { x: 0, y: 0 },
        startNodes: new Map(),
        startActions: new Map(),
        startConds: new Map(),
    },

    beginCombinedDrag: ( anchor, nodeIds, actionIds, condIds ) => {
        const startNodes = new Map<NodeId, { x: number; y: number }>();
        const startActions = new Map<ActionId, { x: number; y: number }>();
        const startConds = new Map<ConditionId, { x: number; y: number }>();

        get().nodes.forEach( ( n ) => { if ( nodeIds.has( n.id ) ) startNodes.set( n.id, { x: n.x, y: n.y } ); } );
        get().actions.forEach( ( a ) => { if ( actionIds.has( a.id ) ) startActions.set( a.id, { x: a.x, y: a.y } ); } );
        get().conditions.forEach( ( c ) => { if ( condIds.has( c.id ) ) startConds.set( c.id, { x: c.x, y: c.y } ); } );

        set( { drag: { active: true, anchor, startNodes, startActions, startConds } } );
    },

    updateCombinedDrag: ( current ) => {
        const { drag, nodes, actions, conditions } = get();
        if ( !drag.active ) return;

        const dx = current.x - drag.anchor.x;
        const dy = current.y - drag.anchor.y;

        const nextNodes = nodes.map( ( n ) => {
            const start = drag.startNodes.get( n.id );
            return start ? { ...n, x: start.x + dx, y: start.y + dy } : n;
        } );

        const nextActions = actions.map( ( a ) => {
            const start = drag.startActions.get( a.id );
            return start ? { ...a, x: start.x + dx, y: start.y + dy } : a;
        } );

        const nextConds = conditions.map( ( c ) => {
            const start = drag.startConds.get( c.id );
            return start ? { ...c, x: start.x + dx, y: start.y + dy } : c;
        } );

        set( { nodes: nextNodes, actions: nextActions, conditions: nextConds } );
    },

    endCombinedDrag: () =>
        set( {
            drag: {
                active: false,
                anchor: { x: 0, y: 0 },
                startNodes: new Map(),
                startActions: new Map(),
                startConds: new Map(),
            },
        } ),

    // Edición
    renameNode: ( id, title ) => {
        const t = title.trim();
        if ( !t ) return;
        set( ( s ) => ( { nodes: s.nodes.map( ( n ) => ( n.id === id ? { ...n, title: t } : n ) ) } ) );
    },

    renameAction: ( id, title ) => {
        const t = title.trim();
        if ( !t ) return;
        set( ( s ) => ( { actions: s.actions.map( ( a ) => ( a.id === id ? { ...a, title: t } : a ) ) } ) );
    },

    renameCondition: ( id, title ) => {
        const t = title.trim();
        if ( !t ) return;
        set( ( s ) => ( { conditions: s.conditions.map( ( c ) => ( c.id === id ? { ...c, title: t } : c ) ) } ) );
    },

    deleteSelected: () => {
        const selNodes = get().selection;
        const selActions = get().selectionActions;
        const selConds = get().selectionConds;

        if ( selNodes.size === 0 && selActions.size === 0 && selConds.size === 0 ) return;

        set( ( s ) => {
            const remainingNodes = s.nodes.filter( ( n ) => !selNodes.has( n.id ) );
            const remainingNodeIds = new Set( remainingNodes.map( ( n ) => n.id ) );

            const remainingActions = s.actions.filter(
                ( a ) => !selActions.has( a.id ) && remainingNodeIds.has( a.originNodeId )
            );
            const remainingActionIds = new Set( remainingActions.map( ( a ) => a.id ) );

            const remainingConds = s.conditions.filter(
                ( c ) => !selConds.has( c.id ) && remainingActionIds.has( c.originActionId )
            );
            const remainingCondIds = new Set( remainingConds.map( ( c ) => c.id ) );

            const remainingEdges = s.edges.filter( ( e ) => {
                const okFrom =
                    e.from.kind === "node"
                        ? remainingNodeIds.has( e.from.id )
                        : e.from.kind === "action"
                            ? remainingActionIds.has( e.from.id )
                            : remainingCondIds.has( e.from.id );

                const okTo =
                    e.to.kind === "node"
                        ? remainingNodeIds.has( e.to.id )
                        : e.to.kind === "action"
                            ? remainingActionIds.has( e.to.id )
                            : remainingCondIds.has( e.to.id );

                return okFrom && okTo;
            } );

            return {
                nodes: remainingNodes,
                actions: remainingActions,
                conditions: remainingConds,
                edges: remainingEdges,
                selection: new Set<NodeId>(),
                selectionActions: new Set<ActionId>(),
                selectionConds: new Set<ConditionId>(),
            };
        } );
    },

    // Colores:
    // - Actualiza el nodo
    // - Propaga (por copia) a TODAS las actions de ese nodo
    // - Propaga (por copia) a TODAS las conditions de esas actions
    setNodeColors: ( id, colors ) => {
        set( ( s ) => {
            // 1) actualizar nodo
            const nextNodes = s.nodes.map( ( n ) =>
                n.id !== id
                    ? n
                    : {
                        ...n,
                        colorFill: colors.fill ?? n.colorFill,
                        colorStroke: colors.stroke ?? n.colorStroke,
                        colorText: colors.text ?? n.colorText,
                    }
            );

            // 2) acciones del nodo
            const affectedActions = new Set<ActionId>(
                s.actions.filter( ( a ) => a.originNodeId === id ).map( ( a ) => a.id )
            );

            const nextActions = s.actions.map( ( a ) =>
                affectedActions.has( a.id )
                    ? {
                        ...a,
                        colorFill: colors.fill ?? a.colorFill,
                        colorStroke: colors.stroke ?? a.colorStroke,
                        // text lo dejamos intacto (por ahora)
                    }
                    : a
            );

            // 3) condiciones de esas acciones
            const nextConds = s.conditions.map( ( c ) =>
                affectedActions.has( c.originActionId )
                    ? {
                        ...c,
                        colorFill: colors.fill ?? c.colorFill,
                        colorStroke: colors.stroke ?? c.colorStroke,
                        // text lo dejamos intacto (por ahora)
                    }
                    : c
            );

            return { nodes: nextNodes, actions: nextActions, conditions: nextConds };
        } );
    },
} ) );
