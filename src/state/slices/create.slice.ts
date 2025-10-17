import { measureActionOval, measureNodeSizeWithId } from "../../layout/measurement";
import {
    DEFAULT_LABEL_FILL, DEFAULT_LABEL_STROKE, DEFAULT_LABEL_TEXT,
    DEFAULT_NODE_FILL, DEFAULT_NODE_STROKE, DEFAULT_NODE_TEXT,
} from "../constants";
import type { AppState, ActionId, Edge, NodeBox, NodeId, ConditionId } from "../types";

export const createSlice = ( set: any, get: () => AppState ) =>
( {
    createNodeAt: ( worldX: number, worldY: number ) => {
        const id = get().nextId;
        const wrap = 22;
        const displayId = String( id );
        const m = measureNodeSizeWithId( displayId, `Node ${id}`, wrap, { bottomPad: 4, minH: 40 } );

        const node: NodeBox = {
            id,
            x: worldX,
            y: worldY,
            title: `Node ${id}`,
            wrap,
            displayId, // NUEVO
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
            nextId: id + 1,
        } ) );
    },

    addActionForNode: ( nodeId: NodeId ) => {
        const node = get().nodes.find( n => n.id === nodeId );
        if ( !node ) return;

        const actionId = get().nextActionId;
        const title = "action";
        const wrap = 22;
        const m = measureActionOval( title, wrap );

        const ax = node.x + 60 + m.w / 2 + Math.random() * 100;
        const ay = node.y + 24 + m.h / 2 + Math.random() * 100;

        const action = {
            id: actionId,
            originNodeId: nodeId,
            x: ax,
            y: ay,
            title,
            wrap,
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

        set( ( s: AppState ) => ( {
            actions: [ ...s.actions, action ],
            edges: [ ...s.edges, edge ],
            nextActionId: actionId + 1,
            nextEdgeId: edgeId + 1,
        } ) );
    },
} satisfies Partial<AppState> );
