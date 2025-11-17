// Tipos de estado de la aplicación
// state/types.ts
import type {
    Point, NodeBox, NodeId, ActionLabel, ActionId, ConditionLabel, ConditionId, Edge,
    NodeColorPatch,
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
    updateCombinedDrag: ( current: Point ) => void;
    endCombinedDrag: () => void;

    // Edición
    editNodeMeta: ( id: NodeId, patch: { displayId?: string; title?: string } ) => void;

    renameNode: ( id: NodeId, title: string ) => void;
    renameAction: ( id: ActionId, title: string ) => void;
    renameCondition: ( id: ConditionId, title: string ) => void;
    deleteSelected: () => void;

    // Colores
    setNodeColors: ( id: NodeId, colors: NodeColorPatch ) => void;
    // ⬇️ NUEVO: Recolorear todo por displayId (aleatorio, con reglas)
    recolorAllNodesRandomly: () => void;
    // ====== NUEVO: jerarquía, layout y hover de drop ======
    setParent: ( child: NodeId, parent: NodeId | null ) => void;
    relayoutContainer: ( containerId: NodeId ) => void;
    relayoutAncestors: ( nodeId: NodeId ) => void;
    getLevelsMap: () => Map<NodeId, number>;

    dragHoverParent: NodeId | null;
    setDragHoverParent: ( id: NodeId | null ) => void;
    getDropTargetFor: ( childId: NodeId ) => NodeId | null;
} & HistoryState;

// Reexportes
export type {
    Point, NodeBox, NodeId, ActionLabel, ActionId, ConditionLabel, ConditionId, Edge, EdgeEndpoint,
} from "../model/types";
