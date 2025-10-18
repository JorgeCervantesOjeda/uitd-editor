// imports
import { measureActionOval, measureConditionOval } from "../../layout/measurement";
import type { ActionId, AppState, ConditionId, NodeId } from "../types";


export const editSlice = ( set: any, get: () => AppState ) => ( {
    // === NODO (rectángulo) ===
    editNodeMeta: ( id: NodeId, patch: { displayId?: string; title?: string } ) => {
        const s = get();
        const current = s.nodes.find( n => n.id === id );
        if ( !current ) return;

        // Normalizamos el displayId nuevo (si viene en el patch)
        const incomingDisp = patch.displayId !== undefined ? patch.displayId.trim() : undefined;

        // Si nos pasan displayId, buscamos si hay otro nodo con ese displayId (normalizado)
        let inheritFrom: typeof current | undefined;
        if ( incomingDisp !== undefined && incomingDisp.length > 0 ) {
            inheritFrom = s.nodes.find( n =>
                n.id !== id &&
                ( ( n.displayId ?? String( n.id ) ).trim() === incomingDisp )
            );
        }

        // Construimos el nuevo nodo
        let next = { ...current };

        if ( incomingDisp !== undefined ) {
            next.displayId = incomingDisp;
        }
        if ( patch.title !== undefined ) {
            next.title = patch.title;
        }

        // Si hay un nodo del que heredar, imponemos su título y colores
        if ( inheritFrom ) {
            next.title = inheritFrom.title;
            next.colorFill = inheritFrom.colorFill;
            next.colorStroke = inheritFrom.colorStroke;
            next.colorText = inheritFrom.colorText;
        }

        // Escribimos el nodo en el array
        const nextNodes = s.nodes.map( n => ( n.id === id ? next : n ) );
        set( { nodes: nextNodes } );

        // Si heredamos colores, usa la ruta oficial para propagar a acciones
        if ( inheritFrom ) {
            const colorPatch: { fill?: string; stroke?: string; text?: string } = {};
            if ( inheritFrom.colorFill !== undefined ) colorPatch.fill = inheritFrom.colorFill;
            if ( inheritFrom.colorStroke !== undefined ) colorPatch.stroke = inheritFrom.colorStroke;
            if ( inheritFrom.colorText !== undefined ) colorPatch.text = inheritFrom.colorText;
            if ( Object.keys( colorPatch ).length > 0 ) {
                // Propaga a todas las acciones del nodo editado y a otros nodos con el mismo displayId
                s.setNodeColors( id, colorPatch );
            }
        }

        // Recalcular tamaño del nodo (por cambios de título/displayId) y relayout de ancestros
        // (Si ya tienes utilidades de medida cacheada, esto suele ser suficiente)
        s.relayoutAncestors( id );
    },
    
    // (opcional) deja renameNode redirigiendo a editNodeMeta:
    renameNode: ( id: number, title: string ) => {
        const s = get();
        const n = s.nodes.find( x => x.id === id );
        if ( !n ) return;
        get().editNodeMeta( id, { displayId: n.displayId ?? String( n.id ), title } );
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
