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
        const s = get();

        // --- 1) Conjuntos seleccionados actuales ---
        const selNodes = new Set( s.selection ?? new Set<number>() );
        const selActions = new Set( s.selectionActions ?? new Set<number>() );
        const selConds = new Set( s.selectionConds ?? new Set<number>() );

        // Si no hay nada seleccionado, no hacemos nada
        if ( selNodes.size === 0 && selActions.size === 0 && selConds.size === 0 ) {
            return;
        }

        // --- 2) Ancestros (en el estado ANTES de borrar) de los nodos seleccionados ---
        const nodesById = new Map( s.nodes.map( n => [ n.id, n ] ) );
        const ancestorsOf = ( id: number ): number[] => {
            const out: number[] = [];
            const seen = new Set<number>();
            let cur = nodesById.get( id )?.parentId ?? null;
            while ( cur != null && !seen.has( cur ) ) {
                out.push( cur );
                seen.add( cur );
                cur = nodesById.get( cur )?.parentId ?? null;
            }
            return out;
        };

        const affectedAncestors = new Set<number>();
        for ( const nid of selNodes ) {
            for ( const a of ancestorsOf( nid ) ) affectedAncestors.add( a );
        }

        // --- 3) Borrado de entidades + edges que las toquen ---
        const dropEdge = ( e: { from: any; to: any } ) => {
            const hit = ( ep: { kind: "node" | "action" | "condition"; id: number } ) => {
                if ( ep.kind === "node" ) return selNodes.has( ep.id );
                if ( ep.kind === "action" ) return selActions.has( ep.id );
                return selConds.has( ep.id ); // condition
            };
            return hit( e.from ) || hit( e.to );
        };

        const nextNodes = s.nodes.filter( n => !selNodes.has( n.id ) );
        const nextActions = s.actions.filter( a => !selActions.has( a.id ) );
        const nextConds = s.conditions.filter( c => !selConds.has( c.id ) );
        const nextEdges = s.edges.filter( e => !dropEdge( e ) );

        set( {
            nodes: nextNodes,
            actions: nextActions,
            conditions: nextConds,
            edges: nextEdges,
            // limpia selección tras borrar
            selection: new Set<number>(),
            selectionActions: new Set<number>(),
            selectionConds: new Set<number>(),
        } );

        // --- 4) Re-layout bottom-up de TODOS los ancestros afectados ---
        // Ordenamos de más profundo a más superficial para que el layout se propague correctamente.
        const { getLevelsMap, relayoutContainer } = get();
        const levels = getLevelsMap();

        const ordered = Array.from( affectedAncestors ).sort(
            ( a, b ) => ( levels.get( b )! - levels.get( a )! ) // descendente por nivel
        );

        for ( const pid of ordered ) {
            relayoutContainer( pid );
        }
    },
} satisfies Partial<AppState> );
