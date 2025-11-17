// src/state/slices/create.slice.ts
// Slice para creación de nodos y acciones

import { measureActionOval, measureNodeSizeWithId } from "../../layout/measurement";
import {
    DEFAULT_LABEL_FILL, DEFAULT_LABEL_STROKE, DEFAULT_LABEL_TEXT,
    DEFAULT_NODE_FILL, DEFAULT_NODE_STROKE, DEFAULT_NODE_TEXT,
} from "../constants";
import {
    NODE_WRAP_DEFAULT, NODE_MIN_H, NODE_BOTTOM_PAD
} from "../../model/types";
import type { AppState, ActionId, Edge, NodeBox, NodeId, ConditionId } from "../types";
// import HistoryKey/HistoryState si quieres, pero no es necesario

export const createSlice = ( set: any, get: () => AppState ) => ( {
    createNodeAt: ( worldX: number, worldY: number ) => {
        get().captureDelta( [ "nodes" ], () => {
            const id = get().nextId;
            const wrap = NODE_WRAP_DEFAULT;
            const displayId = String( id );
            const m = measureNodeSizeWithId( displayId, `Node ${id}`, wrap, {
                bottomPad: NODE_BOTTOM_PAD,
                minH: NODE_MIN_H,
            } );

            const node: NodeBox = {
                id,
                x: worldX,
                y: worldY,
                title: `Node ${id}`,
                wrap,
                displayId,
                w: m.w,
                h: m.h,
                colorFill: DEFAULT_NODE_FILL,
                colorStroke: DEFAULT_NODE_STROKE,
                colorText: DEFAULT_NODE_TEXT,
                parentId: null,
            };

            set( ( s: AppState ) => ( {
                nodes: [ ...s.nodes, node ],
                selection: new Set<NodeId>( [ id ] ),
                selectionActions: new Set<ActionId>(),
                selectionConds: new Set<ConditionId>(),
                nextId: id + 1, // nextId no entra en delta (no lo hacemos undo)
            } ) );
        } );
    },

    addActionForNode: ( nodeId: NodeId ) => {
        get().captureDelta( [ "actions", "edges" ], () => {
            const node = get().nodes.find( ( n ) => n.id === nodeId );
            if ( !node ) return;

            const actionId = get().nextActionId;
            const title = "action";
            const wrap = 22;
            const m = measureActionOval( title, wrap );

            const ax = node.x + 60 + Math.random() * 100;
            const ay = node.y + 24 + Math.random() * 100;

            const action = {
                id: actionId,
                originNodeId: nodeId,
                x: ax,
                y: ay,
                title,
                wrap,
                colorFill: node.colorFill ?? DEFAULT_LABEL_FILL,
                colorStroke: node.colorStroke ?? DEFAULT_LABEL_STROKE,
                colorText: node.colorText ?? DEFAULT_LABEL_TEXT,
            };

            const edgeId = get().nextEdgeId;
            const edge: Edge = {
                id: edgeId,
                from: { kind: "node", id: nodeId },
                to: { kind: "action", id: actionId },
                style: "solid",
            };

            set( ( s: AppState ) => ( {
                actions: [ ...s.actions, action ],
                edges: [ ...s.edges, edge ],
                nextActionId: actionId + 1,
                nextEdgeId: edgeId + 1,
            } ) );
        } );
    },
} );
