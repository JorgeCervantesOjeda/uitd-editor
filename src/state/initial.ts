// src/state/initial.ts
import type { AppState, NodeId, ActionId, ConditionId } from "./types";

export const initialState: Pick<
    AppState,
    | "panzoom" | "viewBox" | "nodes" | "actions" | "conditions" | "edges"
    | "nextId" | "nextActionId" | "nextEdgeId"
    | "selection" | "selectionActions" | "selectionConds"
    | "pendingConnect" | "drag" | "dragGuides" | "dragHoverParent"
> = {
    panzoom: { x: 0, y: 0, zoom: 1 },
    viewBox: { w: 800, h: 600 },

    nodes: [],
    actions: [],
    conditions: [],
    edges: [],

    nextId: 1,
    nextActionId: 1,
    nextEdgeId: 1,

    selection: new Set<NodeId>(),
    selectionActions: new Set<ActionId>(),
    selectionConds: new Set<ConditionId>(),

    pendingConnect: null,

    drag: {
        active: false,
        anchor: { x: 0, y: 0 },
        startNodes: new Map(),
        startActions: new Map(),
        startConds: new Map(),
    },

    dragGuides: { enabled: false, x: undefined, y: undefined },
    dragHoverParent: null,
};
