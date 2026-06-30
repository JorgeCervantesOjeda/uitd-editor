// src/import/uitdl/fragmentConnectivity.ts
// Rejects textual UITDL fragments whose DRAW and transitions form disconnected components.

import { parseUITDL } from "./parser";
import type { ParseIssue, UiRef } from "./types";

function finalKey( reference: UiRef ): string {
    return reference.children.length > 0 ? finalKey( reference.children[ 0 ] ) : reference.key;
}

function collectDrawConnections(
    reference: UiRef,
    keys: Set<string>,
    neighborsByKey: Map<string, Set<string>>
) {
    keys.add( reference.key );
    if ( !neighborsByKey.has( reference.key ) ) {
        neighborsByKey.set( reference.key, new Set<string>() );
    }
    for ( const child of reference.children ) {
        keys.add( child.key );
        const parentNeighbors = neighborsByKey.get( reference.key )!;
        const childNeighbors = neighborsByKey.get( child.key ) ?? new Set<string>();
        parentNeighbors.add( child.key );
        childNeighbors.add( reference.key );
        neighborsByKey.set( child.key, childNeighbors );
        collectDrawConnections( child, keys, neighborsByKey );
    }
}

function connect(
    fromKey: string,
    toKey: string,
    neighborsByKey: Map<string, Set<string>>
) {
    const fromNeighbors = neighborsByKey.get( fromKey ) ?? new Set<string>();
    const toNeighbors = neighborsByKey.get( toKey ) ?? new Set<string>();
    fromNeighbors.add( toKey );
    toNeighbors.add( fromKey );
    neighborsByKey.set( fromKey, fromNeighbors );
    neighborsByKey.set( toKey, toNeighbors );
}

function findComponents(
    keys: Set<string>,
    neighborsByKey: Map<string, Set<string>>
): string[][] {
    const visited = new Set<string>();
    const components: string[][] = [];
    for ( const key of keys ) {
        if ( visited.has( key ) ) continue;
        const component: string[] = [];
        const pending = [ key ];
        while ( pending.length > 0 ) {
            const current = pending.pop()!;
            if ( visited.has( current ) ) continue;
            visited.add( current );
            component.push( current );
            for ( const neighbor of neighborsByKey.get( current ) ?? [] ) {
                if ( !visited.has( neighbor ) ) pending.push( neighbor );
            }
        }
        component.sort( ( first, second ) => first.localeCompare( second, undefined, { numeric: true } ) );
        components.push( component );
    }
    return components;
}

export function validateFragmentConnectivity( text: string ): ParseIssue[] {
    const document = parseUITDL( text );
    const issues: ParseIssue[] = [];

    for ( const fragment of document.fragments ) {
        const keys = new Set<string>();
        const neighborsByKey = new Map<string, Set<string>>();
        for ( const reference of fragment.draw ) {
            collectDrawConnections( reference, keys, neighborsByKey );
        }
        for ( const transition of fragment.transitions ) {
            connect( finalKey( transition.from ), finalKey( transition.to ), neighborsByKey );
        }

        const components = findComponents( keys, neighborsByKey );
        if ( components.length <= 1 ) continue;
        const componentLabels = components
            .map( component => `{ ${component.map( key => `UI ${key}` ).join( ", " )} }` )
            .join( "; " );
        issues.push( {
            kind: "error",
            message: `Fragment "${fragment.name}" is disconnected. Components: ${componentLabels}. Remove unrelated UIs from DRAW or connect them through inclusion or a transition.`,
        } );
    }

    return issues;
}
