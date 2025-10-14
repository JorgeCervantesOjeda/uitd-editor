import { create } from "zustand";
import type { NodeBox, NodeId, ActionLabel, ActionId, Edge } from "../model/types";
import { measureActionOval } from "../layout/measurement";

export type AppState = {
    // cámara
    panzoom: { x: number; y: number; zoom: number };
    setPan: ( dx: number, dy: number ) => void;
    setZoomAnchored: ( newZoom: number, anchorWorld: { x: number; y: number } ) => void;

    // tamaño del lienzo (para viewBox)
    viewBox: { w: number; h: number };
    setViewBox: ( w: number, h: number ) => void;

    // --- Nodos / Acciones / Aristas ---
    nodes: NodeBox[];
    actions: ActionLabel[];
    edges: Edge[];

    nextId: number;        // para NodeId
    nextActionId: number;  // para ActionId
    nextEdgeId: number;

    // --- Selección (combinada) ---
    selection: Set<NodeId>;         // nodos seleccionados
    selectionActions: Set<ActionId>; // acciones seleccionadas

    // Crear
    createNodeAt: ( worldX: number, worldY: number ) => void;
    addActionForNode: ( nodeId: NodeId ) => void;

    // Rubber-banding: acción -> destino (nodo)
    pendingConnect:
    | { mode: "action-to-target"; fromActionId: ActionId; mouse: { x: number; y: number } }
    | null;
    beginGoToTarget: ( actionId: ActionId ) => void;
    updatePendingMouse: ( world: { x: number; y: number } ) => void;
    commitTargetToNode: ( nodeId: NodeId ) => void;
    cancelPending: () => void;

    // --- Selección: nodos ---
    selectSingleOrKeep: ( id: NodeId, keepIfAlreadySelected: boolean ) => void;
    toggleSelect: ( id: NodeId ) => void;

    // --- Selección: acciones ---
    selectSingleOrKeepAction: ( id: ActionId, keepIfAlreadySelected: boolean ) => void;
    toggleSelectAction: ( id: ActionId ) => void;

    // Limpiar selección
    clearSelection: () => void;

    // --- Drag combinado (nodos + acciones) ---
    drag: {
        active: boolean;
        anchor: { x: number; y: number };
        startNodes: Map<NodeId, { x: number; y: number }>;
        startActions: Map<ActionId, { x: number; y: number }>;
    };
    beginCombinedDrag: (
        anchor: { x: number; y: number },
        nodeIds: Set<NodeId>,
        actionIds: Set<ActionId>
    ) => void;
    updateCombinedDrag: ( current: { x: number; y: number } ) => void;
    endCombinedDrag: () => void;

    // edición
    renameNode: ( id: NodeId, title: string ) => void;
    deleteSelected: () => void;
};

export const useAppStore = create<AppState>( ( set, get ) => ( {
    // cámara
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
    viewBox: { w: 600, h: 400 },
    setViewBox: ( w, h ) => set( { viewBox: { w, h } } ),

    // datos
    nodes: [],
    actions: [],
    edges: [],
    nextId: 1,
    nextActionId: 1,
    nextEdgeId: 1,

    // selección
    selection: new Set<NodeId>(),
    selectionActions: new Set<ActionId>(),

    // crear nodo centrado en (worldX, worldY) según tamaño (medición se hace al render)
    createNodeAt: ( worldX, worldY ) => {
        const id = get().nextId;
        const title = `Node ${id}`;
        const wrap = 22;
        const node: NodeBox = { id, x: worldX, y: worldY, title, wrap };
        set( ( s ) => ( {
            nodes: [ ...s.nodes, node ],
            selection: new Set<NodeId>( [ id ] ),
            selectionActions: new Set<ActionId>(),
            nextId: id + 1,
        } ) );
    },

    // crea acción (óvalo) junto a un nodo y arista node->action (solid)
    addActionForNode: ( nodeId ) => {
        const node = get().nodes.find( n => n.id === nodeId );
        if ( !node ) return;
        const actionId = get().nextActionId;
        const title = "action";
        const wrap = 22;
        const m = measureActionOval( title, wrap );
        // posición por defecto: a la derecha-arriba del nodo (offset 24)
        const ax = node.x + 24 + m.w / 2;
        const ay = node.y + 24 + m.h / 2;
        const action: ActionLabel = { id: actionId, originNodeId: nodeId, x: ax, y: ay, title, wrap };
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
            // deja la selección como estaba
        } ) );
    },

    // rubber-banding acción -> (nodo)
    pendingConnect: null,

    beginGoToTarget: ( actionId ) => {
        const act = get().actions.find( a => a.id === actionId );
        if ( !act ) return;
        set( { pendingConnect: { mode: "action-to-target", fromActionId: actionId, mouse: { x: act.x, y: act.y } } } );
    },

    updatePendingMouse: ( world ) => {
        const p = get().pendingConnect;
        if ( !p ) return;
        set( { pendingConnect: { ...p, mouse: { x: world.x, y: world.y } } } );
    },

    commitTargetToNode: ( nodeId ) => {
        const p = get().pendingConnect;
        if ( !p || p.mode !== "action-to-target" ) return;
        const newEdgeId = get().nextEdgeId;
        const edge: Edge = {
            id: newEdgeId,
            from: { kind: "action", id: p.fromActionId },
            to: { kind: "node", id: nodeId },
            style: "dashed1",
        };
        set( ( s ) => ( {
            edges: [ ...s.edges, edge ],
            nextEdgeId: newEdgeId + 1,
            pendingConnect: null,
        } ) );
    },

    cancelPending: () => set( { pendingConnect: null } ),

    // --- selección nodos ---
    selectSingleOrKeep: ( id, keepIfAlreadySelected ) => {
        const sel = new Set( get().selection );
        if ( keepIfAlreadySelected && sel.has( id ) ) {
            set( { selection: sel } );
            return;
        }
        sel.clear();
        sel.add( id );
        set( { selection: sel, selectionActions: new Set<ActionId>() } ); // si seleccionas nodo único, limpiamos acciones
    },

    toggleSelect: ( id ) => {
        const sel = new Set( get().selection );
        if ( sel.has( id ) ) sel.delete( id );
        else sel.add( id );
        set( { selection: sel } );
    },

    // --- selección acciones ---
    selectSingleOrKeepAction: ( id, keepIfAlreadySelected ) => {
        const selA = new Set( get().selectionActions );
        if ( keepIfAlreadySelected && selA.has( id ) ) {
            set( { selectionActions: selA } );
            return;
        }
        selA.clear();
        selA.add( id );
        set( { selectionActions: selA, selection: new Set<NodeId>() } ); // seleccionas acción única -> limpiamos nodos
    },

    toggleSelectAction: ( id ) => {
        const selA = new Set( get().selectionActions );
        if ( selA.has( id ) ) selA.delete( id );
        else selA.add( id );
        set( { selectionActions: selA } );
    },

    clearSelection: () => set( { selection: new Set<NodeId>(), selectionActions: new Set<ActionId>() } ),

    // --- drag combinado ---
    drag: { active: false, anchor: { x: 0, y: 0 }, startNodes: new Map(), startActions: new Map() },

    beginCombinedDrag: ( anchor, nodeIds, actionIds ) => {
        const startNodes = new Map<NodeId, { x: number; y: number }>();
        const startActions = new Map<ActionId, { x: number; y: number }>();
        get().nodes.forEach( ( n ) => { if ( nodeIds.has( n.id ) ) startNodes.set( n.id, { x: n.x, y: n.y } ); } );
        get().actions.forEach( ( a ) => { if ( actionIds.has( a.id ) ) startActions.set( a.id, { x: a.x, y: a.y } ); } );
        set( { drag: { active: true, anchor, startNodes, startActions } } );
    },

    updateCombinedDrag: ( current ) => {
        const { drag, nodes, actions } = get();
        if ( !drag.active ) return;
        const dx = current.x - drag.anchor.x;
        const dy = current.y - drag.anchor.y;

        const nextNodes = nodes.map( ( n ) => {
            const start = drag.startNodes.get( n.id );
            if ( !start ) return n;
            return { ...n, x: start.x + dx, y: start.y + dy };
        } );

        const nextActions = actions.map( ( a ) => {
            const start = drag.startActions.get( a.id );
            if ( !start ) return a;
            return { ...a, x: start.x + dx, y: start.y + dy };
        } );

        set( { nodes: nextNodes, actions: nextActions } );
    },

    endCombinedDrag: () =>
        set( { drag: { active: false, anchor: { x: 0, y: 0 }, startNodes: new Map(), startActions: new Map() } } ),

    // edición
    renameNode: ( id, title ) => {
        const t = title.trim();
        if ( !t ) return;
        set( ( s ) => ( { nodes: s.nodes.map( ( n ) => ( n.id === id ? { ...n, title: t } : n ) ) } ) );
    },

    deleteSelected: () => {
        const selNodes = get().selection;
        const selActions = get().selectionActions;
        if ( selNodes.size === 0 && selActions.size === 0 ) return;

        set( ( s ) => {
            const remainingNodes = s.nodes.filter( ( n ) => !selNodes.has( n.id ) );
            const remainingNodeIds = new Set( remainingNodes.map( n => n.id ) );

            const remainingActions = s.actions.filter( ( a ) => !selActions.has( a.id ) && remainingNodeIds.has( a.originNodeId ) );
            const remainingActionIds = new Set( remainingActions.map( a => a.id ) );

            const remainingEdges = s.edges.filter( e => {
                const okFrom =
                    e.from.kind === "node" ? remainingNodeIds.has( e.from.id ) : remainingActionIds.has( e.from.id );
                const okTo =
                    e.to.kind === "node" ? remainingNodeIds.has( e.to.id ) : remainingActionIds.has( e.to.id );
                return okFrom && okTo;
            } );

            return {
                nodes: remainingNodes,
                actions: remainingActions,
                edges: remainingEdges,
                selection: new Set<NodeId>(),
                selectionActions: new Set<ActionId>(),
            };
        } );
    },
} ) );
