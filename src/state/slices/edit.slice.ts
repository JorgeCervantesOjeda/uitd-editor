// src/state/slices/edit.slice.ts
import { measureActionOval, measureConditionOval } from "../../layout/measurement";
import type { ActionId, AppState, ConditionId, NodeId } from "../types";

export const editSlice = ( set: any, get: () => AppState ) =>
( {
    // === NODO (rectángulo) ===
    editNodeMeta: ( id: NodeId, patch: { displayId?: string; title?: string } ) => {
        get().captureDelta( [ "nodes" ], () => {
            const s = get();
            const current = s.nodes.find( n => n.id === id );
            if ( !current ) return;

            // Normalización de entradas
            const incomingDispRaw = patch.displayId;
            const incomingDisp = incomingDispRaw !== undefined ? incomingDispRaw.trim() : undefined;
            const incomingTitle = patch.title !== undefined ? patch.title.trim() : undefined;

            // Buscar herencia si el nuevo displayId coincide con otro existente
            let inheritFrom: typeof current | undefined;
            if ( incomingDisp !== undefined && incomingDisp.length > 0 ) {
                inheritFrom = s.nodes.find( n =>
                    n.id !== id && ( ( n.displayId ?? "" ).trim() === incomingDisp )
                );
            }

            // Construir "next" con reglas:
            // - Nunca persistir displayId vacío.
            // - Si hay inheritFrom, heredar colores y (si no nos pasaron title en el patch) también título.
            let next = { ...current };

            if ( incomingDisp !== undefined ) {
                if ( incomingDisp.length === 0 ) {
                    // No permitir vacío: conservar el actual válido o usar String(id)
                    next.displayId =
                        ( current.displayId && current.displayId.trim().length > 0 )
                            ? current.displayId.trim()
                            : String( current.id );
                } else {
                    next.displayId = incomingDisp;
                }
            }

            if ( inheritFrom ) {
                next.colorFill = inheritFrom.colorFill;
                next.colorStroke = inheritFrom.colorStroke;
                next.colorText = inheritFrom.colorText;
                // Si no se envía title explícitamente, adopta el del grupo destino
                if ( incomingTitle === undefined ) {
                    next.title = inheritFrom.title;
                }
            }

            if ( incomingTitle !== undefined ) {
                // Propaga incluso si es cadena vacía
                next.title = incomingTitle;
            }

            // Clave de grupo destino (para propagación de título)
            const targetDisplayId = (
                incomingDisp !== undefined
                    ? ( incomingDisp.length > 0 ? incomingDisp : ( next.displayId ?? "" ).trim() )
                    : ( current.displayId ?? "" ).trim()
            );

            // Todos los nodos con ese displayId en el estado actual
            let groupIds = s.nodes
                .filter( n => ( n.displayId ?? "" ).trim() === targetDisplayId )
                .map( n => n.id );

            // Asegurar incluir al propio nodo editado si está cambiando de grupo
            if ( !groupIds.includes( id ) ) groupIds.push( id );

            // Construcción final de nodes + affectedIds
            let nextNodes = s.nodes;
            let affectedIds: number[] = [];

            if ( incomingTitle !== undefined ) {
                // Propagar título a TODO el grupo (invalidar w/h)
                const idSet = new Set( groupIds );
                nextNodes = s.nodes.map( n => {
                    if ( !idSet.has( n.id ) ) return n;
                    const base = ( n.id === id ) ? next : n;
                    const { w, h, ...rest } = base; // invalidar medición cacheada
                    return { ...rest, id: n.id, title: incomingTitle };
                } );
                affectedIds = groupIds.slice();
            } else {
                // No hay título en patch: solo actualizar el nodo editado (pudo cambiar displayId)
                const { w, h, ...rest } = next; // invalidar medición cacheada
                nextNodes = s.nodes.map( n => ( n.id === id ? { ...rest } : n ) );
                affectedIds = [ id ];
            }

            set( { nodes: nextNodes } );

            // Propagar colores a actions si heredamos
            if ( inheritFrom ) {
                const colorPatch: { fill?: string; stroke?: string; text?: string } = {};
                if ( inheritFrom.colorFill !== undefined ) colorPatch.fill = inheritFrom.colorFill;
                if ( inheritFrom.colorStroke !== undefined ) colorPatch.stroke = inheritFrom.colorStroke;
                if ( inheritFrom.colorText !== undefined ) colorPatch.text = inheritFrom.colorText;
                if ( Object.keys( colorPatch ).length > 0 ) {
                    s.setNodeColors( id, colorPatch );
                }
            }

            // === Re-layout robusto: contenedores afectados + ancestros, en orden bottom-up ===
            const hasChildren = ( nid: number ) => get().nodes.some( n => ( n.parentId ?? null ) === nid );

            const baseContainers = new Set<number>();
            for ( const nid of affectedIds ) if ( hasChildren( nid ) ) baseContainers.add( nid );

            const parentOf = ( nid: number ): number | null => {
                const hit = get().nodes.find( n => n.id === nid );
                return hit ? ( hit.parentId ?? null ) : null;
            };

            const allContainers = new Set<number>( baseContainers );
            for ( const nid of affectedIds ) {
                let p = parentOf( nid );
                while ( p != null ) { allContainers.add( p ); p = parentOf( p ); }
            }

            const levels = get().getLevelsMap();
            const ordered = Array.from( allContainers ).sort( ( a, b ) => ( levels.get( a )! - levels.get( b )! ) );

            for ( const cid of ordered ) {
                get().relayoutContainer( cid );
            }
        } );
    },

    // (opcional) renameNode redirige a editNodeMeta
    renameNode: ( id: number, title: string ) => {
        get().editNodeMeta( id as NodeId, { title } );
    },

    // === ACTION (óvalo) ===
    renameAction: ( id: number, title: string ) => {
        get().captureDelta( [ "actions" ], () => {
            const t = ( title ?? "" ).trim(); if ( !t ) return;
            const s = get(); const a = s.actions.find( x => x.id === id ); if ( !a ) return;

            const m = measureActionOval( t, a.wrap ?? 22 );
            set( {
                actions: s.actions.map( x => x.id === id ? { ...x, title: t, w: m.w, h: m.h } : x ),
            } );
        } );
    },

    // === CONDITION (óvalo) ===
    renameCondition: ( id: number, title: string ) => {
        get().captureDelta( [ "conditions" ], () => {
            const t = ( title ?? "" ).trim(); if ( !t ) return;
            const s = get(); const c = s.conditions.find( x => x.id === id ); if ( !c ) return;

            const m = measureConditionOval( t, c.wrap ?? 22 );
            set( {
                conditions: s.conditions.map( x => x.id === id ? { ...x, title: t, w: m.w, h: m.h } : x ),
            } );
        } );
    },

    deleteSelected: () => {
        const selNodes = get().selection;
        const selActions = get().selectionActions;
        const selConds = get().selectionConds;

        if ( selNodes.size === 0 && selActions.size === 0 && selConds.size === 0 ) return;

        get().captureDelta( [ "nodes", "actions", "conditions", "edges" ], () => {
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
        } );
    },
} satisfies Partial<AppState> );
