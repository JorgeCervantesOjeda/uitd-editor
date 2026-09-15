// src/state/initial.ts
import type { AppState, NodeId, ActionId, ConditionId } from "./types";

export const initialState: Pick<
    AppState,
    | "panzoom" | "viewBox" | "nodes" | "actions" | "conditions" | "edges" | "fragmentTitles"
    | "nextId" | "nextActionId" | "nextEdgeId"
    | "selection" | "selectionActions" | "selectionConds" | "focusTarget" | "keyboardMarquee" | "marqueeSeed"
    | "canvasDark" | "isCanvasLockedByUITDLLiveSync"
    | "pendingConnect" | "drag" | "dragGuides" | "dragHoverParent"
> = {
    panzoom: { x: 0, y: 0, zoom: 1 },
    viewBox: { w: 800, h: 600 },

    nodes: [],
    actions: [],
    conditions: [],
    edges: [],
    fragmentTitles: {},

    nextId: 1,
    nextActionId: 1,
    nextEdgeId: 1,

    selection: new Set<NodeId>(),
    selectionActions: new Set<ActionId>(),
    selectionConds: new Set<ConditionId>(),
    focusTarget: null,
    keyboardMarquee: null,
    marqueeSeed: null,

    canvasDark: false,
    isCanvasLockedByUITDLLiveSync: false,

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
