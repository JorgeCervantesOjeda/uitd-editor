// Validates that every textual UITDL action resolves to one deterministic branch.

import { parseUITDL } from "./parser";
import type { ParseIssue, TransitionAST, UiRef } from "./types";

function finalKey( reference: UiRef ): string {
    return reference.children.length > 0 ? finalKey( reference.children[ 0 ] ) : reference.key;
}

function normalize( value: string ): string {
    return value.trim().replace( /\s+/g, " " ).toLowerCase();
}

function actionKey( transition: TransitionAST ): string {
    return [
        finalKey( transition.from ),
        transition.verb,
        normalize( transition.complement ),
    ].join( "\u0000" );
}

function transitionKey( transition: TransitionAST ): string {
    return [
        actionKey( transition ),
        normalize( transition.condLabel ?? "" ),
        finalKey( transition.to ),
    ].join( "\u0000" );
}

export function validateTransitionDeterminism( text: string ): ParseIssue[] {
    const document = parseUITDL( text );
    const uniqueTransitions = new Map<string, TransitionAST>();

    for ( const fragment of document.fragments ) {
        for ( const transition of fragment.transitions ) {
            uniqueTransitions.set( transitionKey( transition ), transition );
        }
    }

    const transitionsByAction = new Map<string, TransitionAST[]>();
    for ( const transition of uniqueTransitions.values() ) {
        const key = actionKey( transition );
        const transitions = transitionsByAction.get( key ) ?? [];
        transitions.push( transition );
        transitionsByAction.set( key, transitions );
    }

    const issues: ParseIssue[] = [];
    for ( const transitions of transitionsByAction.values() ) {
        const representative = transitions[ 0 ];
        const origin = finalKey( representative.from );
        const action = `${representative.verb} "${representative.complement}"`;
        const hasConditional = transitions.some( transition => transition.condLabel !== undefined );
        const hasUnconditional = transitions.some( transition => transition.condLabel === undefined );

        if ( hasConditional && hasUnconditional ) {
            issues.push( {
                kind: "error",
                message: `Action ${action} from UI ${origin} mixes conditional and unconditional transitions.`,
            } );
        }

        const destinationsByCondition = new Map<string, Set<string>>();
        for ( const transition of transitions ) {
            const condition = normalize( transition.condLabel ?? "" );
            const destinations = destinationsByCondition.get( condition ) ?? new Set<string>();
            destinations.add( finalKey( transition.to ) );
            destinationsByCondition.set( condition, destinations );
        }

        for ( const [ condition, destinations ] of destinationsByCondition ) {
            if ( destinations.size <= 1 ) continue;
            const branch = condition
                ? `condition "${condition}"`
                : "the unconditional branch";
            issues.push( {
                kind: "error",
                message: `Action ${action} from UI ${origin} has multiple destinations for ${branch}.`,
            } );
        }
    }

    return issues;
}
