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

        // Si el nuevo displayId coincide con otro nodo, heredamos colores/título de ese primero
        let inheritFrom: typeof current | undefined;
        if ( incomingDisp !== undefined && incomingDisp.length > 0 ) {
            inheritFrom = s.nodes.find( n =>
                n.id !== id && ( ( n.displayId ?? "" ).trim() === incomingDisp )
            );
        }

        // Construimos el nodo editado
        let next = { ...current };
        if ( incomingDisp !== undefined ) next.displayId = incomingDisp;
        if ( inheritFrom ) {
            next.colorFill = inheritFrom.colorFill;
            next.colorStroke = inheritFrom.colorStroke;
            next.colorText = inheritFrom.colorText;
            // si además quieres heredar título cuando se cambia displayId:
            if ( inheritFrom.title !== undefined ) next.title = inheritFrom.title;
        }
        if ( incomingTitle !== undefined ) {
            // Propaga incluso si es cadena vacía
            next.title = incomingTitle;
        }

        // Clave de grupo sobre la que propagaremos (usa el displayId destino)
        const targetDisplayId = ( incomingDisp !== undefined
            ? incomingDisp
            : ( current.displayId ?? "" ).trim() );

        // Todos los nodos del grupo
        const groupIds = s.nodes
            .filter( n => ( n.displayId ?? "" ).trim() === targetDisplayId )
            .map( n => n.id );

        // Construye nextNodes y marca affectedIds correctamente
        let nextNodes = s.nodes;
        let affectedIds: number[] = [];

        if ( incomingTitle !== undefined ) {
            // Propaga título a todo el grupo (invalida w/h)
            const idSet = new Set( groupIds );
            nextNodes = s.nodes.map( n => {
                if ( !idSet.has( n.id ) ) return n;
                const base = ( n.id === id ) ? next : n;
                const { w, h, ...rest } = base; // invalidar medición cacheada
                return { ...rest, id: n.id, title: incomingTitle };
            } );
            affectedIds = groupIds.slice();  // <= CLAVE
        } else {
            // Sin título en patch: actualiza solo el nodo editado (pudo cambiar displayId)
            const { w, h, ...rest } = next;  // invalidar medición cacheada
            nextNodes = s.nodes.map( n => ( n.id === id ? { ...rest } : n ) );
            affectedIds = [ id ];              // <= CLAVE (el header cambió por displayId)
        }

        set( { nodes: nextNodes } );

        // Propagación de colores a actions si heredaste
        if ( inheritFrom ) {
            const colorPatch: { fill?: string; stroke?: string; text?: string } = {};
            if ( inheritFrom.colorFill !== undefined ) colorPatch.fill = inheritFrom.colorFill;
            if ( inheritFrom.colorStroke !== undefined ) colorPatch.stroke = inheritFrom.colorStroke;
            if ( inheritFrom.colorText !== undefined ) colorPatch.text = inheritFrom.colorText;
            if ( Object.keys( colorPatch ).length > 0 ) {
                s.setNodeColors( id, colorPatch );
            }
        }

        // === Re-layout robusto (siempre ejecuta porque affectedIds ya NO está vacío) ===
        const hasChildren = ( nid: number ) => get().nodes.some( n => ( n.parentId ?? null ) === nid );

        // contenedores base: nodos afectados que tienen hijos
        const baseContainers = new Set<number>();
        for ( const nid of affectedIds ) if ( hasChildren( nid ) ) baseContainers.add( nid );

        // ancestros de todos los afectados
        const parentOf = ( nid: number ): number | null => {
            const hit = get().nodes.find( n => n.id === nid );
            return hit ? ( hit.parentId ?? null ) : null;
        };
        const allContainers = new Set<number>( baseContainers );
        for ( const nid of affectedIds ) {
            let p = parentOf( nid );
            while ( p != null ) { allContainers.add( p ); p = parentOf( p ); }
        }

        // Orden bottom-up por nivel
        const levels = get().getLevelsMap();
        const ordered = Array.from( allContainers ).sort( ( a, b ) => ( levels.get( a )! - levels.get( b )! ) );

        // Ejecutar relayout en orden ascendente de nivel
        for ( const cid of ordered ) {
            get().relayoutContainer( cid );
        }
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
