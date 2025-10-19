// imports
import { measureActionOval, measureConditionOval } from "../../layout/measurement";
import type { ActionId, AppState, ConditionId, NodeId } from "../types";


export const editSlice = ( set: any, get: () => AppState ) => ( {
    // === NODO (rectángulo) ===
    editNodeMeta: ( id: NodeId, patch: { displayId?: string; title?: string } ) => {
        const s = get();
        const current = s.nodes.find( n => n.id === id );
        if ( !current ) return;

        const incomingDisp = patch.displayId !== undefined ? patch.displayId.trim() : undefined;
        const incomingTitle = patch.title !== undefined ? patch.title.trim() : undefined;

        let inheritFrom = undefined as typeof current | undefined;
        if ( incomingDisp !== undefined && incomingDisp.length > 0 ) {
            inheritFrom = s.nodes.find( n =>
                n.id !== id && ( ( n.displayId ?? "" ).trim() === incomingDisp )
            );
        }

        let next = { ...current };
        if ( incomingDisp !== undefined ) {
            next.displayId = incomingDisp;
        }
        if ( inheritFrom ) {
            next.colorFill = inheritFrom.colorFill;
            next.colorStroke = inheritFrom.colorStroke;
            next.colorText = inheritFrom.colorText;
        }

        const targetDisplayId = ( next.displayId ?? current.displayId ?? "" ).trim();

        let nextNodes = s.nodes;
        let affectedIds: number[] = [];

        if ( incomingTitle !== undefined ) {
            const groupIds = s.nodes
                .filter( n => ( n.displayId ?? "" ).trim() === targetDisplayId )
                .map( n => n.id );

            const t = incomingTitle;
            next.title = t;

            const idSet = new Set( groupIds );

            nextNodes = s.nodes.map( n => {
                if ( idSet.has( n.id ) || n.id === id ) {
                    const base = ( n.id === id ) ? next : n;   // ← usar `next` para el nodo editado
                    const { w, h, ...rest } = base;          // ← invalidar medición
                    return { ...rest, id: n.id, title: t };
                }
                return n;
            } );
        } else {
            // Sin título en patch: actualizamos solo el nodo editado
            const { w, h, ...rest } = next;
            nextNodes = s.nodes.map( n => ( n.id === id ? { ...rest } : n ) );
            affectedIds = [ id ];
        }

        set( { nodes: nextNodes } );

        if ( inheritFrom ) {
            const colorPatch: { fill?: string; stroke?: string; text?: string } = {};
            if ( inheritFrom.colorFill !== undefined ) colorPatch.fill = inheritFrom.colorFill;
            if ( inheritFrom.colorStroke !== undefined ) colorPatch.stroke = inheritFrom.colorStroke;
            if ( inheritFrom.colorText !== undefined ) colorPatch.text = inheritFrom.colorText;
            if ( Object.keys( colorPatch ).length > 0 ) {
                s.setNodeColors( id, colorPatch );
            }
        }

        const uniq = Array.from( new Set( affectedIds ) );
        for ( const nid of uniq ) s.relayoutAncestors( nid );
    },

    // (opcional) deja renameNode redirigiendo a editNodeMeta:
    renameNode: ( id: number, title: string ) => {
        const s = get();
        const n = s.nodes.find( x => x.id === id );
        if ( !n ) return;
        // El displayId se toma del diálogo; aquí solo propagamos título.
        get().editNodeMeta( id, { title } );
    },

    // === ACTION (óvalo) ===
    renameAction: ( id: number, title: string ) => {
        const t = ( title ?? "" ).trim(); if ( !t ) return;
        const s = get(); const a = s.actions.find( x => x.id === id ); if ( !a ) return;

        const m = measureActionOval( t, a.wrap ?? 22 );
        set( {
            actions: s.actions.map( x => x.id === id ? { ...x, title: t, w: m.w, h: m.h } : x ),
        } );
    },

    // === CONDITION (óvalo) ===
    renameCondition: ( id: number, title: string ) => {
        const t = ( title ?? "" ).trim(); if ( !t ) return;
        const s = get(); const c = s.conditions.find( x => x.id === id ); if ( !c ) return;

        const m = measureConditionOval( t, c.wrap ?? 22 );
        set( {
            conditions: s.conditions.map( x => x.id === id ? { ...x, title: t, w: m.w, h: m.h } : x ),
        } );
    },


    deleteSelected: () => {
        const selNodes = get().selection;
        const selActions = get().selectionActions;
        const selConds = get().selectionConds;

        if ( selNodes.size === 0 && selActions.size === 0 && selConds.size === 0 ) return;

        set( ( s: AppState ) => {
            const remainingNodes = s.nodes.filter( n => !selNodes.has( n.id ) );
            const remainingNodeIds = new Set( remainingNodes.map( n => n.id ) );

            const remainingActions = s.actions.filter(
                a => !selActions.has( a.id ) && remainingNodeIds.has( a.originNodeId )
            );
            const remainingActionIds = new Set( remainingActions.map( a => a.id ) );

            const remainingConds = s.conditions.filter(
                c => !selConds.has( c.id ) && remainingActionIds.has( c.originActionId )
            );
            const remainingCondIds = new Set( remainingConds.map( c => c.id ) );

            const remainingEdges = s.edges.filter( e => {
                const okFrom =
                    e.from.kind === "node"
                        ? remainingNodeIds.has( e.from.id )
                        : e.from.kind === "action"
                            ? remainingActionIds.has( e.from.id )
                            : remainingCondIds.has( e.from.id );

                const okTo =
                    e.to.kind === "node"
                        ? remainingNodeIds.has( e.to.id )
                        : e.to.kind === "action"
                            ? remainingActionIds.has( e.to.id )
                            : remainingCondIds.has( e.to.id );

                return okFrom && okTo;
            } );

            return {
                nodes: remainingNodes,
                actions: remainingActions,
                conditions: remainingConds,
                edges: remainingEdges,
                selection: new Set<NodeId>(),
                selectionActions: new Set<ActionId>(),
                selectionConds: new Set<ConditionId>(),
            };
        } );
    },
} satisfies Partial<AppState> );
