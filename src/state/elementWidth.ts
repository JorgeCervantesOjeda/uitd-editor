// src/state/elementWidth.ts
// Applies horizontal text resizing while keeping the left edge anchored.
import type { DiagramFocusTarget } from "./types";
import type { NodeBox } from "../model/types";
import { PAD_X, TITLE_CHAR_W, CONTAINER_PAD_X, CONTAINER_CHILDREN_BOTTOM_PAD } from "../model/types";
import {
    getNodeSizeCached, getActionSizeCached, getConditionSizeCached,
    measureNodeBox, measureActionLabel, measureConditionLabel,
} from "../layout/measurement";
import { useAppStore } from "./store";

function fitNodeAroundChildren( node: NodeBox, nodes: NodeBox[] ): NodeBox {
    const children = nodes.filter( item => item.parentId === node.id );
    if ( children.length === 0 ) return node;
    const size = getNodeSizeCached( node );
    const left = node.x - size.w / 2;
    const top = node.y - size.h / 2;
    const header = measureNodeBox( node );
    const w = Math.max( size.w, header.w, ...children.map( child =>
        child.x + getNodeSizeCached( child ).w / 2 + CONTAINER_PAD_X - left ) );
    const h = Math.max( size.h, ...children.map( child =>
        child.y + getNodeSizeCached( child ).h / 2 + CONTAINER_CHILDREN_BOTTOM_PAD - top ) );
    return { ...node, w, h, x: left + w / 2, y: top + h / 2 };
}

function resizedNodes( nodes: NodeBox[], id: number, width: number, wrap: number ): NodeBox[] {
    const current = nodes.find( node => node.id === id )!;
    const size = getNodeSizeCached( current );
    const header = measureNodeBox( current );
    const nextHeader = measureNodeBox( { ...current, wrap } );
    const left = current.x - size.w / 2;
    const top = current.y - size.h / 2;
    const deltaHeight = nextHeader.h - header.h;
    const descendants = new Set<number>( [ id ] );
    let grew = true;
    while ( grew ) {
        grew = false;
        for ( const node of nodes ) {
            if ( node.parentId != null && descendants.has( node.parentId ) && !descendants.has( node.id ) ) {
                descendants.add( node.id );
                grew = true;
            }
        }
    }
    const hasChildren = descendants.size > 1;
    const h = hasChildren ? Math.max( nextHeader.h, size.h + deltaHeight ) : nextHeader.h;
    let nextNodes = nodes.map( node => node.id === id
        ? { ...node, wrap, w: width, h, x: left + width / 2, y: top + h / 2 }
        : descendants.has( node.id ) ? { ...node, y: node.y + deltaHeight } : node );
    let ancestorId: number | null = id;
    const visited = new Set<number>();
    while ( ancestorId != null && !visited.has( ancestorId ) ) {
        visited.add( ancestorId );
        const ancestor = nextNodes.find( node => node.id === ancestorId );
        if ( !ancestor ) break;
        const fitted = fitNodeAroundChildren( ancestor, nextNodes );
        nextNodes = nextNodes.map( node => node.id === ancestor.id ? fitted : node );
        ancestorId = ancestor.parentId ?? null;
    }
    return nextNodes;
}

export function resizeElementWidth( target: NonNullable<DiagramFocusTarget>, width: number ): void {
    const state = useAppStore.getState();
    if ( !Number.isFinite( width ) || state.isCanvasLockedByUITDLLiveSync ) return;
    const node = target.kind === "node" ? state.nodes.find( item => item.id === target.id ) : undefined;
    const action = target.kind === "action" ? state.actions.find( item => item.id === target.id ) : undefined;
    const condition = target.kind === "condition" ? state.conditions.find( item => item.id === target.id ) : undefined;
    const item = node ?? action ?? condition;
    if ( !item ) return;
    const text = ( node ? `${node.displayId ?? ""} ${node.title}` : item.title ).trim().replace( /\s+/g, " " );
    const maxChars = Math.max( 1, text.length );
    const minChars = Math.max( 1, ...text.split( " " ).map( word => word.length ) );
    const measure = ( wrap: number ) => node ? measureNodeBox( { ...node, wrap } )
        : action ? measureActionLabel( { ...action, wrap } ) : measureConditionLabel( { ...condition!, wrap } );
    const currentSize = node ? getNodeSizeCached( node ) : action ? getActionSizeCached( action ) : getConditionSizeCached( condition! );
    const left = item.x - currentSize.w / 2;
    const top = item.y - currentSize.h / 2;
    const childWidth = node ? Math.max( 0, ...state.nodes.filter( child => child.parentId === node.id )
        .map( child => child.x + getNodeSizeCached( child ).w / 2 + CONTAINER_PAD_X - left ) ) : 0;
    const minWidth = Math.max( measure( minChars ).w, childWidth );
    const maxWidth = Math.max( measure( maxChars ).w, minWidth );
    const w = Math.min( maxWidth, Math.max( minWidth, width ) );
    const padding = 2 * PAD_X + ( condition ? 16 : 0 );
    const wrap = Math.min( maxChars, Math.max( minChars, Math.floor( ( w - padding ) / TITLE_CHAR_W ) ) );
    const { h } = measure( wrap );
    state.captureDelta( [ node ? "nodes" : action ? "actions" : "conditions" ], () => {
        if ( node ) {
            useAppStore.setState( { nodes: resizedNodes( state.nodes, node.id, w, wrap ) } );
        } else if ( action ) {
            useAppStore.setState( { actions: state.actions.map( current => current.id === action.id
                ? { ...current, wrap, w, h, x: left + w / 2, y: top + h / 2 } : current ) } );
        } else if ( condition ) {
            useAppStore.setState( { conditions: state.conditions.map( current => current.id === condition.id
                ? { ...current, wrap, w, h, x: left + w / 2, y: top + h / 2 } : current ) } );
        }
    } );
}
