// src/state/types.ts
import type {
    Point, NodeBox, NodeId,
    ActionLabel, ActionId,
    ConditionLabel, ConditionId,
    Edge,
    NodeColorPatch,
    UiVerb,
} from "../model/types";
import type { HistoryState } from "./slices/history.slice";

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
    nextId: number;
    nextActionId: number;
    nextEdgeId: number;

    // Selección
    selection: Set<NodeId>;
    selectionActions: Set<ActionId>;
    selectionConds: Set<ConditionId>;
    clearSelection: () => void;

    // Creación
    createNodeAt: ( worldX: number, worldY: number ) => void;
    addActionForNode: ( nodeId: NodeId ) => void;

    // Condiciones
    handleCreateCondition: ( actionId: ActionId ) => void;

    // Conexiones
    pendingConnect: PendingConnect;
    beginGoToTarget: ( actionId: ActionId ) => void;
    beginRubberFromCondition: ( conditionId: ConditionId ) => void;
    retargetCondition: ( conditionId: ConditionId ) => void;
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
    updateCombinedDrag: ( current: Point, shiftKey: boolean ) => void;
    endCombinedDrag: () => void;
    dragGuides: { enabled: boolean; x?: number; y?: number };

    // Edición (nodos)
    editNodeMeta: ( id: NodeId, patch: { displayId?: string; title?: string } ) => void;
    renameNode: ( id: NodeId, title: string ) => void;

    // Edición (acciones/condiciones)
    renameAction: ( id: ActionId, title: string ) => void;          // legacy (si aún se usa)
    renameCondition: ( id: ConditionId, title: string ) => void;    // legacy (si aún se usa)
    editConditionMeta: ( id: ConditionId, patch: { title?: string; wrap?: number } ) => void;

    // ✅ NUEVO: edición “real” de acción (verb + complement)
    editActionVerbComplement: ( id: ActionId, verb: UiVerb, complement: string ) => void;

    deleteSelected: () => void;

    // Colores
    setNodeColors: ( id: NodeId, colors: NodeColorPatch ) => void;
    recolorAllNodesRandomly: () => void;

    // Jerarquía/layout
    setParent: ( child: NodeId, parent: NodeId | null ) => void;
    relayoutContainer: ( containerId: NodeId ) => void;
    relayoutAncestors: ( nodeId: NodeId ) => void;
    getLevelsMap: () => Map<NodeId, number>;

    dragHoverParent: NodeId | null;
    setDragHoverParent: ( id: NodeId | null ) => void;
    getDropTargetFor: ( childId: NodeId ) => NodeId | null;

    // Utilidades de proyecto / persistencia
    resetProjectToBlank: () => void;
    clearSavedProject: () => void;

    getSimulationSelectedNodes: () => Set<NodeId>;

} & HistoryState;

// Reexportes
export type {
    Point, NodeBox, NodeId,
    ActionLabel, ActionId,
    ConditionLabel, ConditionId,
    Edge, EdgeEndpoint,
    UiVerb,
} from "../model/types";
