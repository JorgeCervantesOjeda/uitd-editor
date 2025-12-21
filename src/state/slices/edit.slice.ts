import { measureActionOval, measureConditionOval } from "../../layout/measurement";
import type { ActionId, AppState, ConditionId, NodeId } from "../types";
import type { UiVerb } from "../../model/types";

function isValidComplement( raw: string ): boolean {
    const t = ( raw ?? "" ).trim();
    if ( !t ) return false;
    if ( t.includes( `"` ) ) return false;
    if ( t.includes( "\\" ) ) return false;
    return true;
}

function makeActionTitle( verb: UiVerb, complement: string ) {
    return `${verb} "${( complement ?? "" ).trim()}"`;
}

export const editSlice = ( set: any, get: () => AppState ) =>
( {
    // === NODO (rectángulo) ===
    editNodeMeta: ( id: NodeId, patch: { displayId?: string; title?: string } ) => {
        // (igual que tu versión)
        get().captureDelta( [ "nodes" ], () => {
            const s = get();
            const current = s.nodes.find( n => n.id === id );
            if ( !current ) return;

            const incomingDispRaw = patch.displayId;
            const incomingDisp = incomingDispRaw !== undefined ? incomingDispRaw.trim() : undefined;
            const incomingTitle = patch.title !== undefined ? patch.title.trim() : undefined;

            let inheritFrom: typeof current | undefined;
            if ( incomingDisp !== undefined && incomingDisp.length > 0 ) {
                inheritFrom = s.nodes.find( n =>
                    n.id !== id && ( ( n.displayId ?? "" ).trim() === incomingDisp )
                );
            }

            let next = { ...current };

            if ( incomingDisp !== undefined ) {
                if ( incomingDisp.length === 0 ) {
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
                if ( incomingTitle === undefined ) {
                    next.title = inheritFrom.title;
                }
            }

            if ( incomingTitle !== undefined ) {
                next.title = incomingTitle;
            }

            const targetDisplayId = (
                incomingDisp !== undefined
                    ? ( incomingDisp.length > 0 ? incomingDisp : ( next.displayId ?? "" ).trim() )
                    : ( current.displayId ?? "" ).trim()
            );

            let groupIds = s.nodes
                .filter( n => ( n.displayId ?? "" ).trim() === targetDisplayId )
                .map( n => n.id );

            if ( !groupIds.includes( id ) ) groupIds.push( id );

            let nextNodes = s.nodes;
            let affectedIds: number[] = [];

            if ( incomingTitle !== undefined ) {
                const idSet = new Set( groupIds );
                nextNodes = s.nodes.map( n => {
                    if ( !idSet.has( n.id ) ) return n;
                    const base = ( n.id === id ) ? next : n;
                    const { w, h, ...rest } = base;
                    return { ...rest, id: n.id, title: incomingTitle };
                } );
                affectedIds = groupIds.slice();
            } else {
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
            const ordered = Array.from( allContainers )
                .sort( ( a, b ) => ( levels.get( b )! - levels.get( a )! ) );

            for ( const cid of ordered ) {
                get().relayoutContainer( cid );
            }
        } );
    },

    renameNode: ( id: number, title: string ) => {
        get().editNodeMeta( id as NodeId, { title } );
    },

    // ✅ Nuevo: edición estructurada de acción
    editActionVerbComplement: ( id: ActionId, verb: UiVerb, complement: string ) => {
        get().captureDelta( [ "actions" ], () => {
            const s = get();
            const a = s.actions.find( x => x.id === id );
            if ( !a ) return;

            // verb es case sensitive por tipo (UiVerb), pero igual lo aplicamos tal cual
            const comp = ( complement ?? "" ).trim();
            if ( !isValidComplement( comp ) ) return;

            const title = makeActionTitle( verb, comp );
            const wrap = a.wrap ?? 22;
            const m = measureActionOval( title, wrap );

            set( {
                actions: s.actions.map( x =>
                    x.id === id
                        ? { ...x, verb, complement: comp, title, w: m.w, h: m.h }
                        : x
                ),
            } );
        } );
    },

    // (compat) si alguna parte vieja llama renameAction("clicks X"), intentamos mapear.
    // Si no es parseable o deja complemento vacío, no hacemos nada.
    renameAction: ( id: number, title: string ) => {
        get().captureDelta( [ "actions" ], () => {
            const raw = ( title ?? "" ).trim();
            if ( !raw ) return;

            const s = get();
            const a = s.actions.find( x => x.id === id );
            if ( !a ) return;

            // Intento simple: si empieza por uno de los verbos exactos, el resto es complemento.
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
                actions: s.actions.map( x =>
                    x.id === id
                        ? { ...x, verb: maybeVerb, complement: comp, title: finalTitle, w: m.w, h: m.h }
                        : x
                ),
            } );
        } );
    },

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
        // (igual que tu versión)
        const s = get();

        const selNodes = new Set( s.selection ?? new Set<number>() );
        const selActions = new Set( s.selectionActions ?? new Set<number>() );
        const selConds = new Set( s.selectionConds ?? new Set<number>() );

        if ( selNodes.size === 0 && selActions.size === 0 && selConds.size === 0 ) {
            return;
        }

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

        const dropEdge = ( e: { from: any; to: any } ) => {
            const hit = ( ep: { kind: "node" | "action" | "condition"; id: number } ) => {
                if ( ep.kind === "node" ) return selNodes.has( ep.id );
                if ( ep.kind === "action" ) return selActions.has( ep.id );
                return selConds.has( ep.id );
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
            selection: new Set<number>(),
            selectionActions: new Set<number>(),
            selectionConds: new Set<number>(),
        } );

        const { getLevelsMap, relayoutContainer } = get();
        const levels = getLevelsMap();

        const ordered = Array.from( affectedAncestors ).sort(
            ( a, b ) => ( levels.get( b )! - levels.get( a )! )
        );

        for ( const pid of ordered ) {
            relayoutContainer( pid );
        }
    },
} satisfies Partial<AppState> );
