// src/state/slices/create.slice.ts
// Creates nodes and actions, selecting and scheduling each new element for arrangement.
import { withMeasuredActionLabel, withMeasuredNodeBox } from "../../layout/measurement";
import {
    DEFAULT_LABEL_FILL,
    DEFAULT_LABEL_STROKE,
    DEFAULT_LABEL_TEXT,
    DEFAULT_NODE_FILL,
    DEFAULT_NODE_STROKE,
    DEFAULT_NODE_TEXT,
} from "../constants";
import { NODE_WRAP_DEFAULT } from "../../model/types";
import type { AppState, Edge, NodeId } from "../types";
import { newElementSelection } from "../newElementSelection";
import { newElementPosition } from "../newElementPosition";
import type { UiVerb } from "../../model/types";
import { colorsForNewElement } from "../../colors/colorMode";

function makeActionTitle( verb: UiVerb, complement: string ) {
    const c = ( complement ?? "" ).trim();
    return `${verb} "${c}"`;
}

type SetState = ( partial: Partial<AppState> | ( ( s: AppState ) => Partial<AppState> ) ) => void;

export const createSlice = ( set: SetState, get: () => AppState ) => ( {
    createNodeAt: ( worldX: number, worldY: number ) => {
        get().normalizeColorModeSettings();
        get().captureDelta( [ "nodes" ], () => {
            const id = get().nextId;
            const wrap = NODE_WRAP_DEFAULT;
            const displayId = String( id );
            const colors = colorsForNewElement( "ui", get() );

            const node = withMeasuredNodeBox( {
                id,
                x: worldX,
                y: worldY,
                title: `Node ${id}`,
                wrap,
                displayId,
                colorFill: colors?.fill ?? DEFAULT_NODE_FILL,
                colorStroke: colors?.stroke ?? DEFAULT_NODE_STROKE,
                colorText: colors?.text ?? DEFAULT_NODE_TEXT,
                parentId: null,
            } );

            set( ( s: AppState ) => ( {
                nodes: [ ...s.nodes, node ],
                ...newElementSelection( { kind: "node", id } ),
                autoArrangeQueue: [ ...s.autoArrangeQueue, { kind: "node", id } ],
                nextId: id + 1,
            } ) );
        } );
    },

    addActionForNode: ( nodeId: NodeId ) => {
        get().normalizeColorModeSettings();
        get().captureDelta( [ "actions", "edges" ], () => {
            const node = get().nodes.find( ( n ) => n.id === nodeId );
            if ( !node ) return;

            const actionId = get().nextActionId;

            const verb: UiVerb = "clicks";
            const complement = "X"; // default no vacío
            const title = makeActionTitle( verb, complement );

            const wrap = 22;
            const position = newElementPosition( node );
            const colors = colorsForNewElement( "action", get() );

            const action = withMeasuredActionLabel( {
                id: actionId,
                originNodeId: nodeId,
                ...position,
                verb,
                complement,
                title,
                wrap,
                colorFill: colors?.fill ?? node.colorFill ?? DEFAULT_LABEL_FILL,
                colorStroke: colors?.stroke ?? node.colorStroke ?? DEFAULT_LABEL_STROKE,
                colorText: colors?.text ?? node.colorText ?? DEFAULT_LABEL_TEXT,
            } );

            const edgeId = get().nextEdgeId;
            const edge: Edge = {
                id: edgeId,
                from: { kind: "node", id: nodeId },
                to: { kind: "action", id: actionId },
                style: "solid",
            };

            set( ( s: AppState ) => ( {
                actions: [ ...s.actions, action ],
                ...newElementSelection( { kind: "action", id: actionId } ),
                autoArrangeQueue: [ ...s.autoArrangeQueue, { kind: "action", id: actionId } ],
                edges: [ ...s.edges, edge ],
                nextActionId: actionId + 1,
                nextEdgeId: edgeId + 1,
            } ) );
        } );
    },
} );
