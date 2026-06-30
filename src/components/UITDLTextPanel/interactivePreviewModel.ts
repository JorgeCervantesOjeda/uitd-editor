// src/components/UITDLTextPanel/interactivePreviewModel.ts
// Builds navigable UI states from validated UITDL, including inherited transitions.

import { parseUITDL } from "../../import/uitdl/parser";
import type { TransitionAST, UiRef } from "../../import/uitdl/types";

export type PreviewUI = {
    key: string;
    name: string;
};

export type PreviewTransition = {
    key: string;
    fromKey: string;
    fromName: string;
    toKey: string;
    toName: string;
    verb: string;
    complement: string;
    condition?: string;
};

export type PreviewAction = {
    key: string;
    verb: string;
    complement: string;
    transitions: PreviewTransition[];
};

export type PreviewActionMode = "conditional" | "unconditional" | "invalid";

export type InteractivePreviewModel = {
    title: string;
    uis: PreviewUI[];
    containedKeysByUI: Map<string, Set<string>>;
    transitions: PreviewTransition[];
};

function finalKey( ref: UiRef ): string {
    return ref.children.length > 0 ? finalKey( ref.children[ 0 ] ) : ref.key;
}

function collectContainment( ref: UiRef, containedKeysByUI: Map<string, Set<string>> ) {
    if ( ref.children.length === 0 ) return;
    const children = containedKeysByUI.get( ref.key ) ?? new Set<string>();
    for ( const child of ref.children ) {
        children.add( child.key );
        collectContainment( child, containedKeysByUI );
    }
    containedKeysByUI.set( ref.key, children );
}

function transitionKey( transition: TransitionAST ): string {
    return [
        finalKey( transition.from ),
        finalKey( transition.to ),
        transition.verb,
        transition.complement,
        transition.condLabel ?? "",
    ].join( "\u0000" );
}

export function buildInteractivePreviewModel( text: string ): InteractivePreviewModel {
    const document = parseUITDL( text );
    const nameByKey = new Map(
        document.uiBlocks.map( ui => [ ui.key, ui.name ?? `UI ${ui.key}` ] )
    );
    const containedKeysByUI = new Map<string, Set<string>>();
    for ( const fragment of document.fragments ) {
        for ( const drawReference of fragment.draw ) {
            collectContainment( drawReference, containedKeysByUI );
        }
    }

    const seenTransitions = new Set<string>();
    const transitions: PreviewTransition[] = [];
    for ( const fragment of document.fragments ) {
        for ( const transition of fragment.transitions ) {
            const key = transitionKey( transition );
            if ( seenTransitions.has( key ) ) continue;
            seenTransitions.add( key );
            const fromKey = finalKey( transition.from );
            const toKey = finalKey( transition.to );
            transitions.push( {
                key,
                fromKey,
                fromName: nameByKey.get( fromKey ) ?? `UI ${fromKey}`,
                toKey,
                toName: nameByKey.get( toKey ) ?? `UI ${toKey}`,
                verb: transition.verb,
                complement: transition.complement,
                condition: transition.condLabel,
            } );
        }
    }

    return {
        title: document.title,
        uis: document.uiBlocks.map( ui => ( {
            key: ui.key,
            name: ui.name ?? `UI ${ui.key}`,
        } ) ),
        containedKeysByUI,
        transitions,
    };
}

export function effectiveUIKeys(
    currentKey: string,
    containedKeysByUI: Map<string, Set<string>>
): Set<string> {
    const effectiveKeys = new Set<string>();
    const pendingKeys = [ currentKey ];
    while ( pendingKeys.length > 0 ) {
        const key = pendingKeys.pop()!;
        if ( effectiveKeys.has( key ) ) continue;
        effectiveKeys.add( key );
        for ( const childKey of containedKeysByUI.get( key ) ?? [] ) {
            pendingKeys.push( childKey );
        }
    }
    return effectiveKeys;
}

export function effectiveTransitions(
    model: InteractivePreviewModel,
    currentKey: string
): PreviewTransition[] {
    const availableKeys = effectiveUIKeys( currentKey, model.containedKeysByUI );
    return model.transitions.filter( transition => availableKeys.has( transition.fromKey ) );
}

export function groupPreviewActions( transitions: PreviewTransition[] ): PreviewAction[] {
    const actionsByKey = new Map<string, PreviewAction>();
    for ( const transition of transitions ) {
        const key = `${transition.verb}\u0000${transition.complement}`;
        const action = actionsByKey.get( key ) ?? {
            key,
            verb: transition.verb,
            complement: transition.complement,
            transitions: [],
        };
        action.transitions.push( transition );
        actionsByKey.set( key, action );
    }
    return [ ...actionsByKey.values() ];
}

export function previewActionMode( action: PreviewAction ): PreviewActionMode {
    const conditionalCount = action.transitions.filter(
        transition => transition.condition !== undefined
    ).length;
    if ( conditionalCount === action.transitions.length ) return "conditional";
    if ( conditionalCount === 0 && action.transitions.length === 1 ) return "unconditional";
    return "invalid";
}
