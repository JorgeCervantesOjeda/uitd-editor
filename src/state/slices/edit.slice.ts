// src/state/slices/edit.slice.ts
import type { StateCreator } from "zustand";
import {
    measureActionOval,
    measureConditionOval,
    measureNodeSizeWithId,
} from "../../layout/measurement";
import type {
    ActionId,
    AppState,
    ConditionId,
    NodeId,
    Edge,
    ActionLabel,
    ConditionLabel,
} from "../types";
import type { UiVerb } from "../../model/types";

// ----------------- helpers locales -----------------
function isValidComplement( raw: string ): boolean {
    const t = ( raw ?? "" ).trim();
    if ( !t ) return false;
    if ( t.includes( `"` ) ) return false;
    if ( t.includes( `\\` ) ) return false;
    return true;
}

function makeActionTitle( verb: UiVerb, complement: string ) {
    return `${verb} "${( complement ?? "" ).trim()}"`;
}

// ----------------- API del slice -----------------
type EditActionMetaPatch = {
    title?: string;
    wrap?: number;
};
type EditConditionMetaPatch = {
    title?: string;
    wrap?: number;
};

export type EditSlice = {
    // Nodo
    editNodeMeta: ( id: NodeId, patch: { displayId?: string; title?: string; wrap?: number } ) => void;
    renameNode: ( id: number, title: string ) => void;

    // Acción
    editActionVerbComplement: ( id: ActionId, verb: UiVerb, complement: string ) => void;
    renameAction: ( id: number, title: string ) => void;
    editActionMeta: ( id: ActionId, patch: EditActionMetaPatch ) => void;

    // Condición
    editConditionMeta: ( id: ConditionId, patch: EditConditionMetaPatch ) => void;
    renameCondition: ( id: number, title: string ) => void;

    // Borrado
    deleteSelected: () => void;
};

// ----------------- implementación -----------------
export const editSlice: StateCreator<AppState, [], [], EditSlice> = ( set, get ) => ( {
    // === NODO (rectángulo) ===
    editNodeMeta: ( id, patch ) => {
        get().captureDelta( [ "nodes" ], () => {
            const s = get();
            const current = s.nodes.find( ( n ) => n.id === id );
            if ( !current ) return;

            const incomingDispRaw = patch.displayId;
            const incomingDisp =
                incomingDispRaw !== undefined ? incomingDispRaw.trim() : undefined;
            const incomingTitle =
                patch.title !== undefined ? patch.title.trim() : undefined;

            // wrap (opcional, clamp 6..80)
            const incomingWrap =
                typeof patch.wrap === "number" && Number.isFinite( patch.wrap )
                    ? Math.max( 6, Math.min( 80, Math.round( patch.wrap ) ) )
                    : undefined;

            let inheritFrom: typeof current | undefined;
            if ( incomingDisp !== undefined && incomingDisp.length > 0 ) {
                inheritFrom = s.nodes.find(
                    ( n ) => n.id !== id && ( ( n.displayId ?? "" ).trim() === incomingDisp )
                );
            }

            // Base "next" partiendo del actual
            let next = { ...current };

            // displayId
            if ( incomingDisp !== undefined ) {
                if ( incomingDisp.length === 0 ) {
                    next.displayId =
                        current.displayId && current.displayId.trim().length > 0
                            ? current.displayId.trim()
                            : String( current.id );
                } else {
                    next.displayId = incomingDisp;
                }
            }

            // herencia de colores (y título si no vino explícito)
            if ( inheritFrom ) {
                next.colorFill = inheritFrom.colorFill;
                next.colorStroke = inheritFrom.colorStroke;
                next.colorText = inheritFrom.colorText;
                if ( incomingTitle === undefined ) {
                    next.title = inheritFrom.title;
                }
            }

            // título
            if ( incomingTitle !== undefined ) {
                next.title = incomingTitle;
            }

            // wrap (NO se propaga por displayId; sólo el nodo editado)
            if ( incomingWrap !== undefined ) {
                next.wrap = incomingWrap;
            }

            const targetDisplayId =
                incomingDisp !== undefined
                    ? incomingDisp.length > 0
                        ? incomingDisp
                        : ( next.displayId ?? "" ).trim()
                    : ( current.displayId ?? "" ).trim();

            let groupIds = s.nodes
                .filter( ( n ) => ( n.displayId ?? "" ).trim() === targetDisplayId )
                .map( ( n ) => n.id );

            if ( !groupIds.includes( id ) ) groupIds.push( id );

            let nextNodes = s.nodes;
            let affectedIds: number[] = [];

            // Si cambia el título, se propaga al grupo (como antes).
            // El wrap NO se propaga.
            if ( incomingTitle !== undefined ) {
                const idSet = new Set( groupIds );
                nextNodes = s.nodes.map( ( n ) => {
                    if ( !idSet.has( n.id ) ) return n;
                    const base = n.id === id ? next : n;

                    // Nuevo tamaño medido con idHeader + title; wrap por nodo (si lo tiene)
                    const idHeader = ( base.displayId ?? base.id );
                    const wrapForMeasure = base.wrap ?? n.wrap; // respeta wrap por nodo si existe
                    const m = measureNodeSizeWithId( idHeader, incomingTitle, wrapForMeasure );

                    return {
                        ...base,
                        id: n.id,
                        title: incomingTitle,
                        w: m.w,
                        h: m.h,
                    };
                } );
                affectedIds = groupIds.slice();
            } else {
                // Sólo este nodo (p.ej. cambio de wrap o displayId)
                const idHeader = ( next.displayId ?? next.id );
                const wrapForMeasure = next.wrap ?? current.wrap;
                const titleForMeasure = next.title ?? current.title ?? "";
                const m = measureNodeSizeWithId( idHeader, titleForMeasure, wrapForMeasure );

                next = { ...next, w: m.w, h: m.h };
                nextNodes = s.nodes.map( ( n ) => ( n.id === id ? next : n ) );
                affectedIds = [ id ];
            }

            set( { nodes: nextNodes } );

            if ( inheritFrom ) {
                const colorPatch: { fill?: string; stroke?: string; text?: string } = {};
                if ( inheritFrom.colorFill !== undefined )
                    colorPatch.fill = inheritFrom.colorFill;
                if ( inheritFrom.colorStroke !== undefined )
                    colorPatch.stroke = inheritFrom.colorStroke;
                if ( inheritFrom.colorText !== undefined )
                    colorPatch.text = inheritFrom.colorText;
                if ( Object.keys( colorPatch ).length > 0 ) {
                    s.setNodeColors( id, colorPatch );
                }
            }

            // Relayout: ancestros de nodos afectados
            const hasChildren = ( nid: number ) =>
                get().nodes.some( ( n ) => ( n.parentId ?? null ) === nid );

            const baseContainers = new Set<number>();
            for ( const nid of affectedIds ) if ( hasChildren( nid ) ) baseContainers.add( nid );

            const parentOf = ( nid: number ): number | null => {
                const hit = get().nodes.find( ( n ) => n.id === nid );
                return hit ? ( hit.parentId ?? null ) : null;
            };

            const allContainers = new Set<number>( baseContainers );
            for ( const nid of affectedIds ) {
                let p = parentOf( nid );
                while ( p != null ) {
                    allContainers.add( p );
                    p = parentOf( p );
                }
            }

            const levels = get().getLevelsMap();
            const ordered = Array.from( allContainers ).sort(
                ( a, b ) => levels.get( b )! - levels.get( a )!
            );

            for ( const cid of ordered ) {
                get().relayoutContainer( cid );
            }
        } );
    },

    renameNode: ( id, title ) => {
        get().editNodeMeta( id as NodeId, { title } );
    },

    // === ACCIÓN (verb + complement => title y tamaño) ===
    editActionVerbComplement: ( id, verb, complement ) => {
        get().captureDelta( [ "actions" ], () => {
            const s = get();
            const a = s.actions.find( ( x ) => x.id === id );
            if ( !a ) return;

            const comp = ( complement ?? "" ).trim();
            if ( !isValidComplement( comp ) ) return;

            const title = makeActionTitle( verb, comp );
            const wrap = a.wrap ?? 22;
            const m = measureActionOval( title, wrap );

            set( {
                actions: s.actions.map( ( x ) =>
                    x.id === id
                        ? { ...x, verb, complement: comp, title, w: m.w, h: m.h }
                        : x
                ),
            } );

            // relayout del nodo contenedor si existe
            const origin = a.originNodeId;
            get().relayoutAncestors?.( origin );
        } );
    },

    // (compat) renameAction("clicks X")
    renameAction: ( id, title ) => {
        get().captureDelta( [ "actions" ], () => {
            const raw = ( title ?? "" ).trim();
            if ( !raw ) return;

            const s = get();
            const a = s.actions.find( ( x ) => x.id === id );
            if ( !a ) return;

            const parts = raw.split( /\s+/ );
            const maybeVerb = parts[ 0 ] as UiVerb;
            const allowed: UiVerb[] = [
                "clicks", "submits", "selects", "types", "toggles",
                "uploads", "downloads", "saves", "deletes", "waits",
            ];
            if ( !allowed.includes( maybeVerb ) ) return;

            const comp = parts.slice( 1 ).join( " " ).trim();
            if ( !isValidComplement( comp ) ) return;

            const finalTitle = makeActionTitle( maybeVerb, comp );
            const wrap = a.wrap ?? 22;
            const m = measureActionOval( finalTitle, wrap );

            set( {
                actions: s.actions.map( ( x ) =>
                    x.id === id
                        ? { ...x, verb: maybeVerb, complement: comp, title: finalTitle, w: m.w, h: m.h }
                        : x
                ),
            } );

            get().relayoutAncestors?.( a.originNodeId );
        } );
    },

    // === NUEVO: meta de acción (title y/o wrap) ===
    editActionMeta: ( id, patch ) => {
        get().captureDelta( [ "actions" ], () => {
            const s = get();
            const idx = s.actions.findIndex( ( a ) => a.id === id );
            if ( idx < 0 ) return;

            const current = s.actions[ idx ];
            const next: ActionLabel = { ...current };

            if ( typeof patch.title === "string" ) {
                next.title = patch.title;
            }
            if ( typeof patch.wrap === "number" && Number.isFinite( patch.wrap ) ) {
                const w = Math.max( 6, Math.min( 80, Math.round( patch.wrap ) ) );
                next.wrap = w;
            }

            const titleForMeasure = next.title ?? current.title ?? "";
            const wrapForMeasure = next.wrap ?? current.wrap ?? 22;
            const m = measureActionOval( titleForMeasure, wrapForMeasure );
            next.w = m.w;
            next.h = m.h;

            const actions = s.actions.slice();
            actions[ idx ] = next;
            set( { actions } );

            get().relayoutAncestors?.( next.originNodeId );
        } );
    },

    // === CONDICIÓN ===
    editConditionMeta: ( id, patch ) => {
        get().captureDelta( [ "conditions" ], () => {
            const s = get();
            const idx = s.conditions.findIndex( ( c ) => c.id === id );
            if ( idx < 0 ) return;

            const current = s.conditions[ idx ];
            const next: ConditionLabel = { ...current };

            if ( typeof patch.title === "string" ) {
                next.title = patch.title;
            }
            if ( typeof patch.wrap === "number" && Number.isFinite( patch.wrap ) ) {
                const w = Math.max( 6, Math.min( 80, Math.round( patch.wrap ) ) );
                next.wrap = w;
            }

            const titleForMeasure = next.title ?? current.title ?? "";
            const wrapForMeasure = next.wrap ?? current.wrap ?? 22;
            const m = measureConditionOval( titleForMeasure, wrapForMeasure );
            next.w = m.w;
            next.h = m.h;

            const conditions = s.conditions.slice();
            conditions[ idx ] = next;
            set( { conditions } );

            // Si la condición vive dentro de algún contenedor, re-layout de ancestros.
            // (Si tienes un campo como originNodeId/originActionId, úsalo aquí.)
            // get().relayoutAncestors?.( /* id del contenedor si aplica */ );
        } );
    },

    renameCondition: ( id, title ) => {
        get().captureDelta( [ "conditions" ], () => {
            const t = ( title ?? "" ).trim();
            if ( !t ) return;

            const s = get();
            const c = s.conditions.find( ( x ) => x.id === id );
            if ( !c ) return;

            const m = measureConditionOval( t, c.wrap ?? 22 );
            set( {
                conditions: s.conditions.map( ( x ) =>
                    x.id === id ? { ...x, title: t, w: m.w, h: m.h } : x
                ),
            } );
        } );
    },

    // === BORRADO SELECCIÓN ===
    deleteSelected: () => {
        const s = get();

        const selNodes = new Set( s.selection ?? new Set<number>() );
        const selActions = new Set( s.selectionActions ?? new Set<number>() );
        const selConds = new Set( s.selectionConds ?? new Set<number>() );

        if ( selNodes.size === 0 && selActions.size === 0 && selConds.size === 0 ) {
            return;
        }

        const nodesById = new Map( s.nodes.map( ( n ) => [ n.id, n ] ) );
        const ancestorsOf = ( nid: number ): number[] => {
            const out: number[] = [];
            const seen = new Set<number>();
            let cur = nodesById.get( nid )?.parentId ?? null;
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

        const dropEdge = ( e: Edge ) => {
            const hit = ( ep: Edge[ "from" ] | Edge[ "to" ] ) => {
                if ( ep.kind === "node" ) return selNodes.has( ep.id );
                if ( ep.kind === "action" ) return selActions.has( ep.id );
                return selConds.has( ep.id );
            };
            return hit( e.from ) || hit( e.to );
        };

        const nextNodes = s.nodes.filter( ( n ) => !selNodes.has( n.id ) );
        const nextActions = s.actions.filter( ( a ) => !selActions.has( a.id ) );
        const nextConds = s.conditions.filter( ( c ) => !selConds.has( c.id ) );
        const nextEdges = s.edges.filter( ( e ) => !dropEdge( e ) );

        set( {
            nodes: nextNodes,
            actions: nextActions,
            conditions: nextConds,
            edges: nextEdges,
            selection: new Set<number>(),
            selectionActions: new Set<number>(),
            selectionConds: new Set<number>(),
        } );

        const { getLevelsMap, relayoutContainer } = get();
        const levels = getLevelsMap();

        const ordered = Array.from( affectedAncestors ).sort(
            ( a, b ) => levels.get( b )! - levels.get( a )!
        );

        for ( const pid of ordered ) {
            relayoutContainer( pid );
        }
    },
} );
