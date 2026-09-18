// src/state/trimElementText.ts
// Normalizes boundary whitespace without remeasuring text or moving resized elements.

import { useAppStore } from "./store";
import type { DiagramFocusTarget } from "./types";

export function trimElementText( target: NonNullable<DiagramFocusTarget> ): void {
    const state = useAppStore.getState();
    const key = target.kind === "node" ? "nodes" : target.kind === "action" ? "actions" : "conditions";
    state.captureDelta( [ key ], () => {
        if ( target.kind === "node" ) {
            const node = state.nodes.find( item => item.id === target.id );
            if ( !node ) return;
            useAppStore.setState( { nodes: state.nodes.map( item =>
                ( item.id === node.id || item.displayId === node.displayId ) && item.title.trim() === node.title.trim()
                    ? { ...item, title: item.title.trim() } : item ) } );
        } else if ( target.kind === "action" ) {
            useAppStore.setState( { actions: state.actions.map( item => item.id === target.id
                ? { ...item, complement: item.complement.trim(), title: `${item.verb} "${item.complement.trim()}"` } : item ) } );
        } else {
            useAppStore.setState( { conditions: state.conditions.map( item => item.id === target.id
                ? { ...item, title: item.title.trim() } : item ) } );
        }
    } );
}
