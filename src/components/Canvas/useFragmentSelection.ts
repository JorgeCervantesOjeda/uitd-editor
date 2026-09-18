// src/components/Canvas/useFragmentSelection.ts
// Derives whole-fragment highlights without changing the editable selection sets.

import { useMemo } from "react";
import { buildFragmentGroups } from "../../fragments/fragmentModel";
import { useAppStore } from "../../state/store";

export function useFragmentSelection() {
    const nodes = useAppStore( s => s.nodes );
    const actions = useAppStore( s => s.actions );
    const conditions = useAppStore( s => s.conditions );
    const edges = useAppStore( s => s.edges );
    const selection = useAppStore( s => s.selection );
    const selectionActions = useAppStore( s => s.selectionActions );
    const selectionConds = useAppStore( s => s.selectionConds );
    const groups = useMemo(
        () => buildFragmentGroups( { nodes, actions, conditions, edges } ),
        [ nodes, actions, conditions, edges ]
    );

    return useMemo( () => {
        const fragmentIds = new Set<string>();
        const nodeIds = new Set<number>();
        const actionIds = new Set<number>();
        const conditionIds = new Set<number>();
        for ( const group of groups ) {
            const isSelected = group.nodeIds.every( id => selection.has( id ) ) &&
                group.actionIds.every( id => selectionActions.has( id ) ) &&
                group.conditionIds.every( id => selectionConds.has( id ) );
            if ( !isSelected ) continue;
            fragmentIds.add( group.id );
            group.nodeIds.forEach( id => nodeIds.add( id ) );
            group.actionIds.forEach( id => actionIds.add( id ) );
            group.conditionIds.forEach( id => conditionIds.add( id ) );
        }
        return { fragmentIds, nodeIds, actionIds, conditionIds };
    }, [ groups, selection, selectionActions, selectionConds ] );
}
