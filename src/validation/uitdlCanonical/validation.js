// src/validation/uitdlCanonical/validation.js
// Canonical project-owned UITDL parser and semantic validator.

import {
    getInnermostUIRef,
    getInnermostUIStr,
    formatUIRef,
    formatDrawRef,
    formatDrawRefUsingParsedSyntax
} from './utils.js';
import {
    analyzeTransitionSet,
    duplicateCaseSensitiveValues,
    hasLeadingZeroUIID,
    isPositiveInteger,
    leadingZeroUIIDMessage,
    normalizeComparableText,
} from '../sharedUITDLRules.js';

const buildPathRef = ( pathIds ) =>
    pathIds.reduceRight(
        ( nested, id ) => ( nested === null ? id : `${id}(${nested})` ),
        null
    );

const buildNestedRefWithAncestors = ( ancestors, ref ) =>
    ancestors.reduceRight(
        ( nested, id ) => `${id}(${nested})`,
        formatUIRef( ref )
    );

const collectDrawnUIRefs = ( uiRefs ) => {
    const drawnUIRefs = new Set();

    const visit = ( ref, ancestors = [] ) => {
        const currentPath = [ ...ancestors, ref.id.toString() ];

        drawnUIRefs.add( buildPathRef( currentPath ) );
        drawnUIRefs.add( buildNestedRefWithAncestors( ancestors, ref ) );

        ref.nested.forEach( nestedRef => visit( nestedRef, currentPath ) );
    };

    uiRefs.forEach( ref => visit( ref ) );

    return drawnUIRefs;
};

const addInclusionEdge = ( inclusionGraph, parentId, childId ) => {
    if( !inclusionGraph.has( parentId ) ) {
        inclusionGraph.set( parentId, new Set() );
    }

    inclusionGraph.get( parentId )
        .add( childId );
};

const buildInclusionGraph = ( fragments ) => {
    const inclusionGraph = new Map();

    const visit = ( ref ) => {
        ref.nested.forEach( nestedRef => {
            addInclusionEdge(
                inclusionGraph,
                ref.id.toString(),
                nestedRef.id.toString()
            );
            visit( nestedRef );
        } );
    };

    fragments.forEach( fragment => {
        fragment.draws.forEach( draw => {
            draw.uiRefs.forEach( ref => visit( ref ) );
        } );
    } );

    return inclusionGraph;
};

const getDescendantUIIds = ( inclusionGraph, rootId ) => {
    const descendants = new Set();
    const pending = [ rootId ];

    while( pending.length > 0 ) {
        const currentId = pending.pop();
        const childIds = inclusionGraph.get( currentId ) || new Set();

        childIds.forEach( childId => {
            if( descendants.has( childId ) ) return;
            descendants.add( childId );
            pending.push( childId );
        } );
    }

    return descendants;
};

const collectStandaloneDrawnUIIds = ( uiRefs ) => {
    const standaloneUIIds = new Set();

    uiRefs.forEach( ref => {
        standaloneUIIds.add( ref.id.toString() );
    } );

    return standaloneUIIds;
};

const collectDrawKeys = ( uiRefs, keys = new Set() ) => {
    const visit = ( ref ) => {
        keys.add( ref.id.toString() );
        ref.nested.forEach( nestedRef => visit( nestedRef ) );
    };

    uiRefs.forEach( ref => visit( ref ) );

    return keys;
};

const connectKeys = ( neighborsByKey, fromKey, toKey ) => {
    const fromNeighbors = neighborsByKey.get( fromKey ) || new Set();
    const toNeighbors = neighborsByKey.get( toKey ) || new Set();

    fromNeighbors.add( toKey );
    toNeighbors.add( fromKey );
    neighborsByKey.set( fromKey, fromNeighbors );
    neighborsByKey.set( toKey, toNeighbors );
};

const connectDrawKeys = ( neighborsByKey, ref ) => {
    if( !neighborsByKey.has( ref.id.toString() ) ) {
        neighborsByKey.set( ref.id.toString(), new Set() );
    }

    ref.nested.forEach( nestedRef => {
        connectKeys( neighborsByKey, ref.id.toString(), nestedRef.id.toString() );
        connectDrawKeys( neighborsByKey, nestedRef );
    } );
};

const findConnectedComponents = ( keys, neighborsByKey ) => {
    const visited = new Set();
    const components = [];

    keys.forEach( key => {
        if( visited.has( key ) ) return;
        const component = [];
        const pending = [ key ];

        while( pending.length > 0 ) {
            const current = pending.pop();
            if( visited.has( current ) ) continue;
            visited.add( current );
            component.push( current );

            ( neighborsByKey.get( current ) || new Set() )
                .forEach( neighbor => {
                    if( !visited.has( neighbor ) ) {
                        pending.push( neighbor );
                    }
                } );
        }

        component.sort( ( first, second ) => first.localeCompare( second, undefined, { numeric: true } ) );
        components.push( component );
    } );

    return components;
};

const collectReusableUIIds = ( fragments ) => {
    const containerIdsByChildId = new Map();

    const visit = ( ref ) => {
        ref.nested.forEach( nestedRef => {
            const parentId = ref.id.toString();
            const childId = nestedRef.id.toString();
            const containerIds = containerIdsByChildId.get( childId ) || new Set();

            containerIds.add( parentId );
            containerIdsByChildId.set( childId, containerIds );
            visit( nestedRef );
        } );
    };

    fragments.forEach( fragment => {
        fragment.draws.forEach( draw => {
            draw.uiRefs.forEach( ref => visit( ref ) );
        } );
    } );

    return new Set(
        [ ...containerIdsByChildId.entries() ]
            .filter( ( [ , containerIds ] ) => containerIds.size >= 2 )
            .map( ( [ childId ] ) => childId )
    );
};

const comparePositions = ( left, right ) => {
    if( left.line !== right.line ) {
        return left.line - right.line;
    }

    return left.column - right.column;
};

const quote = ( value ) => `"${value}"`;

const pushLeadingZeroMarker = ( markers, uiRef ) => {
    if( !hasLeadingZeroUIID( uiRef.id ) ) return;

    const line = uiRef.idLine || uiRef.line;
    const column = uiRef.idColumn || uiRef.column;

    markers.push( {
        severity: 8,
        startLineNumber: line,
        startColumn: column,
        endLineNumber: line,
        endColumn: column + uiRef.id.toString().length,
        message: leadingZeroUIIDMessage( uiRef.id ),
        code: 'invalid-uiid'
    } );
};

const pushLeadingZeroMarkersForRef = ( markers, uiRef ) => {
    pushLeadingZeroMarker( markers, uiRef );
    uiRef.nested.forEach( nestedRef => pushLeadingZeroMarkersForRef( markers, nestedRef ) );
};

const collectLegacyDrawSyntaxMarkers = ( ref, draw ) => {
    const markers = [];

    if( ref.drawDelimiter === '(' ) {
        const legacyRef = formatDrawRefUsingParsedSyntax( ref );
        const preferredRef = formatDrawRef( ref );
        const startColumn = ref.column || draw.column;

        markers.push( {
            severity: 4,
            startLineNumber: ref.line || draw.line,
            startColumn,
            endLineNumber: ref.line || draw.line,
            endColumn: startColumn + legacyRef.length,
            message: `DRAW reference ${quote( legacyRef )} uses legacy parentheses. Prefer square brackets in DRAW, for example ${quote( preferredRef )}.`,
            code: 'legacy-draw-parentheses'
        } );
    }

    ref.nested.forEach( nestedRef => {
        const nestedMarkers = collectLegacyDrawSyntaxMarkers( nestedRef, draw );
        markers.push( ...nestedMarkers );
    } );

    return markers;
};

export const validateData = ( parsedData ) => {
    const markers = [];
    const uiNames = new Set();
    const uiIds = new Set();
    const uiDeclarations = new Map();
    const inclusionGraph = buildInclusionGraph( parsedData.fragments );
    const reusableUIIds = collectReusableUIIds( parsedData.fragments );
    const transitionsByOriginUI = new Map();

    if( parsedData.uis.length === 0 ) {
        markers.push( {
            severity: 8,
            startLineNumber: 0,
            startColumn: 0,
            endLineNumber: 0,
            endColumn: 1,
            message: 'There are no UIs defined.',
        } );
    }

    const firstFragmentDeclaration = ( parsedData.declarations || [] )
        .find( declaration => declaration.type === 'FRAGMENT' );

    parsedData.uis.forEach( ui => {
        pushLeadingZeroMarker( markers, ui );

        if( uiIds.has( ui.id.toString() ) ) {
            markers.push( {
                severity: 8,
                startLineNumber: ui.line,
                startColumn: ui.column,
                endLineNumber: ui.line,
                endColumn: ui.column + ui.name.length,
                message: `Duplicate UI ID: ${quote( ui.id.toString() )}.`,
            } );
        } else {
            uiIds.add( ui.id.toString() );
            uiDeclarations.set( ui.id.toString(), {
                line: ui.line,
                column: ui.column,
            } );
        }

        if( uiNames.has( ui.name ) ) {
            markers.push( {
                severity: 8,
                startLineNumber: ui.line,
                startColumn: ui.column,
                endLineNumber: ui.line,
                endColumn: ui.column + ui.name.length,
                message: `Duplicate UI name: ${quote( ui.name )}.`,
            } );
        } else {
            uiNames.add( ui.name );
        }

        if( firstFragmentDeclaration && comparePositions(
            { line: ui.line, column: ui.column },
            { line: firstFragmentDeclaration.line, column: firstFragmentDeclaration.column }
        ) > 0 ) {
            markers.push( {
                severity: 8,
                startLineNumber: ui.line,
                startColumn: ui.column,
                endLineNumber: ui.line,
                endColumn: ui.column + 3 + ui.id.toString().length,
                message: `UI ${quote( ui.id )} is declared after a FRAGMENT. Define all UI blocks before any fragment references them.`,
                code: 'ui-after-fragment'
            } );
        }
    } );

    const fragmentNameDuplicates = duplicateCaseSensitiveValues(
        parsedData.fragments.map( fragment => fragment.name )
    );
    fragmentNameDuplicates.forEach( duplicate => {
        const fragment = parsedData.fragments[ duplicate.index ];
        if( fragment ) {
            markers.push( {
                severity: 8,
                startLineNumber: fragment.line,
                startColumn: fragment.column,
                endLineNumber: fragment.line,
                endColumn: fragment.column + fragment.name.length,
                message: `Duplicate fragment name: ${quote( fragment.name )}.`,
                code: 'duplicate-fragment-name',
            } );
        }
    } );

    parsedData.fragments.forEach( fragment => {
        fragment.transitions.forEach( transition => {
            const originUIId = getInnermostUIRef( transition.from )
                .toString();
            const currentList = transitionsByOriginUI.get( originUIId ) || [];
            currentList.push( transition );
            transitionsByOriginUI.set( originUIId, currentList );
        } );
    } );

    const sourceTransitions = parsedData.fragments.flatMap( fragment => fragment.transitions );
    const sharedTransitionAnalysis = analyzeTransitionSet( sourceTransitions.map( transition => ( {
        from: getInnermostUIRef( transition.from ).toString(),
        to: getInnermostUIRef( transition.to ).toString(),
        verb: transition.action,
        complement: transition.target,
        condition: transition.condition,
    } ) ) );

    sharedTransitionAnalysis.mixedActionGroups.forEach( group => {
        group.indices.forEach( index => {
            const transition = sourceTransitions[ index ];
            if( !transition ) return;
            markers.push( {
                severity: 8,
                startLineNumber: transition.line,
                startColumn: transition.verbColumn,
                endLineNumber: transition.line,
                endColumn: transition.verbColumn + transition.action.length + 1 + 1 + transition.target.length + 1,
                message: `Action ${quote( `${transition.action} "${transition.target}"` )} from UI ${quote( getInnermostUIRef( transition.from ) )} mixes conditional and unconditional transitions.`,
                code: 'nondeterministic-transition'
            } );
        } );
    } );

    sharedTransitionAnalysis.multipleDestinationGroups.forEach( group => {
        const condition = group.condition;
        const branch = condition ? `condition ${quote( condition )}` : 'the unconditional branch';
        group.indices.forEach( index => {
            const transition = sourceTransitions[ index ];
            if( !transition ) return;
            markers.push( {
                severity: 8,
                startLineNumber: transition.line,
                startColumn: transition.verbColumn,
                endLineNumber: transition.line,
                endColumn: transition.verbColumn + transition.action.length + 1 + 1 + transition.target.length + 1,
                message: `Action ${quote( `${transition.action} "${transition.target}"` )} from UI ${quote( getInnermostUIRef( transition.from ) )} has multiple destinations for ${branch}.`,
                code: 'nondeterministic-transition'
            } );
        } );
    } );

    parsedData.fragments.forEach( fragment => {
        if( fragment.width !== null && !isPositiveInteger( fragment.width ) ) {
            markers.push( {
                severity: 8,
                startLineNumber: fragment.line,
                startColumn: fragment.column,
                endLineNumber: fragment.line,
                endColumn: fragment.column + fragment.name.length,
                message: `Fragment ${quote( fragment.name )} has invalid WIDTH ${quote( fragment.width )}. WIDTH must be a positive integer.`,
                code: 'invalid-width'
            } );
        }

        const connectivityKeys = collectDrawKeys( fragment.draws.flatMap( draw => draw.uiRefs ) );
        const connectivityNeighbors = new Map();

        fragment.draws.forEach( draw => {
            draw.uiRefs.forEach( uiRef => connectDrawKeys( connectivityNeighbors, uiRef ) );
        } );

        fragment.transitions.forEach( transition => {
            connectKeys(
                connectivityNeighbors,
                getInnermostUIRef( transition.from )
                    .toString(),
                getInnermostUIRef( transition.to )
                    .toString()
            );
        } );

        const connectivityComponents = findConnectedComponents( connectivityKeys, connectivityNeighbors );

        if( connectivityComponents.length > 1 ) {
            const componentLabels = connectivityComponents
                .map( component => `{ ${component.map( key => `UI ${key}` )
                    .join( ', ' )} }` )
                .join( '; ' );

            markers.push( {
                severity: 8,
                startLineNumber: fragment.line,
                startColumn: fragment.column,
                endLineNumber: fragment.line,
                endColumn: fragment.column + fragment.name.length,
                message: `Fragment ${quote( fragment.name )} is disconnected. Components: ${componentLabels}. Remove unrelated UIs from DRAW or connect them through inclusion or a transition.`,
                code: 'disconnected-fragment'
            } );
        }

        const reusableOriginUIIds = [
            ...new Set( fragment.transitions
                .map( transition => getInnermostUIRef( transition.from )
                    .toString() )
                .filter( uiId => reusableUIIds.has( uiId ) ) )
        ];

        if( reusableOriginUIIds.length === 0 ) return;

        const standaloneDrawnUIIds = collectStandaloneDrawnUIIds(
            fragment.draws.flatMap( draw => draw.uiRefs )
        );

        if( reusableOriginUIIds.length > 1 ) {
            markers.push( {
                severity: 4,
                startLineNumber: fragment.line,
                startColumn: fragment.column,
                endLineNumber: fragment.line,
                endColumn: fragment.column + fragment.name.length,
                message: `Fragment ${quote( fragment.name )} mixes transitions from multiple reusable UIs (${reusableOriginUIIds.map( quote )
                    .join( ', ' )}). Prefer a dedicated fragment for each reusable UI when it improves clarity.`,
                code: 'mixed-reusable-fragment'
            } );
        }

        const dedicatedReusableUIId = reusableOriginUIIds[ 0 ];
        const hasTransitionsFromOtherUIs = fragment.transitions.some( transition =>
            getInnermostUIRef( transition.from )
                .toString() !== dedicatedReusableUIId );

        if( hasTransitionsFromOtherUIs ) {
            markers.push( {
                severity: 4,
                startLineNumber: fragment.line,
                startColumn: fragment.column,
                endLineNumber: fragment.line,
                endColumn: fragment.column + fragment.name.length,
                message: `Fragment ${quote( fragment.name )} contains transitions from reusable UI ${quote( dedicatedReusableUIId )} and other UIs. Prefer keeping dedicated reusable UI fragments focused on the reusable UI when it improves readability.`,
                code: 'mixed-reusable-fragment'
            } );
        }

        if( !standaloneDrawnUIIds.has( dedicatedReusableUIId ) ) {
            markers.push( {
                severity: 8,
                startLineNumber: fragment.line,
                startColumn: fragment.column,
                endLineNumber: fragment.line,
                endColumn: fragment.column + fragment.name.length,
                message: `Fragment ${quote( fragment.name )} documents transitions from reusable UI ${quote( dedicatedReusableUIId )} but does not draw that UI as a standalone reference. Dedicated reusable UI fragments must draw the reusable UI standalone.`,
                code: 'missing-reusable-standalone-draw'
            } );
        }
    } );

    parsedData.fragments.forEach( fragment => {
        const drawnUIRefs = collectDrawnUIRefs( fragment.draws.flatMap( draw => draw.uiRefs ) );
        const drawnExactRefs = new Set();
        const uniqueTransitions = new Set();
        const transitionsByAction = new Map();

        fragment.draws
            .flatMap( draw => draw.uiRefs.map( uiRef => ( {
                key: formatDrawRefUsingParsedSyntax( uiRef ),
                line: uiRef.line,
                column: uiRef.column
            } ) ) )
            .forEach( drawRef => {
                if( drawnExactRefs.has( drawRef.key ) ) {
                    markers.push( {
                        severity: 8,
                        startLineNumber: drawRef.line,
                        startColumn: drawRef.column,
                        endLineNumber: drawRef.line,
                        endColumn: drawRef.column + drawRef.key.length,
                        message: `Duplicate DRAW reference ${quote( drawRef.key )} in fragment ${quote( fragment.name )}. Remove the repeated reference.`,
                        code: 'duplicate-draw-reference'
                    } );
                    return;
                }

                drawnExactRefs.add( drawRef.key );
            } );

        fragment.transitions.forEach( transition => {
            const fromRef = formatUIRef( transition.from );
            const actionKey = `${fromRef}:${transition.action}:${transition.target}`;
            const list = transitionsByAction.get( actionKey ) || [];
            list.push( transition );
            transitionsByAction.set( actionKey, list );
        } );

        transitionsByAction.forEach( ( list, actionKey ) => {
            if( list.length < 2 ) return;
            const hasUnconditional = list.some( transition => !( transition.condition || '' ).trim() );
            const hasConditional = list.some( transition => ( transition.condition || '' ).trim() );

            if( !hasUnconditional || !hasConditional ) return;

            list.forEach( transition => {
                markers.push( {
                    severity: 8,
                    startLineNumber: transition.line,
                    startColumn: transition.verbColumn,
                    endLineNumber: transition.line,
                    endColumn: transition.verbColumn + transition.action.length + 1 + 1 + transition.target.length + 1,
                    message: `Ambiguous transitions for ${quote( actionKey )}: an unconditional transition overlaps with conditional transition(s).`,
                    code: 'ambiguous-transition'
                } );
            } );
        } );

        fragment.transitions.forEach( transition => {
            pushLeadingZeroMarkersForRef( markers, transition.from );
            pushLeadingZeroMarkersForRef( markers, transition.to );

            const fromUI = getInnermostUIRef( transition.from );
            const toUI = getInnermostUIRef( transition.to );
            const fromRef = formatUIRef( transition.from );
            const toRef = formatUIRef( transition.to );
            const actionKey = `${fromRef}:${toRef}:${transition.action}:${transition.target}:${transition.condition || ''}`;

            if( transition.width !== null && !isPositiveInteger( transition.width ) ) {
                markers.push( {
                    severity: 8,
                    startLineNumber: transition.line,
                    startColumn: transition.column,
                    endLineNumber: transition.line,
                    endColumn: transition.column + 20,
                    message: `Transition from ${quote( fromRef )} to ${quote( toRef )} has invalid WIDTH ${quote( transition.width )}. WIDTH must be a positive integer.`,
                    code: 'invalid-width'
                } );
            }

            if( uniqueTransitions.has( actionKey ) ) {
                markers.push( {
                    severity: 8,
                    startLineNumber: transition.line,
                    startColumn: transition.column,
                    endLineNumber: transition.line,
                    endColumn: transition.column + 20,
                    message: `Duplicate transition found from ${quote( fromRef )} to ${quote( toRef )}, action ${quote( `${transition.action} "${transition.target}"` )}` +
                        ( transition.condition ? ` AND "${transition.condition}"` : '' ) + '.',
                } );
            } else {
                uniqueTransitions.add( actionKey );
            }

            const checkUI = ( uiRef ) => {
                const uiRefString = formatUIRef( uiRef );

                if( !drawnUIRefs.has( uiRefString ) ) {
                    const onlyDrawnNested = !uiRefString.includes( '(' ) &&
                        [ ...drawnUIRefs ].some( drawnRef =>
                            drawnRef !== uiRefString && getInnermostUIStr( drawnRef ) === uiRefString );

                    markers.push( {
                        severity: 8,
                        startLineNumber: transition.line,
                        startColumn: uiRef.column || transition.column,
                        endLineNumber: transition.line,
                        endColumn: ( uiRef.column || transition.column ) + uiRefString.length,
                        message: onlyDrawnNested
                            ? `Undrawn UI ${quote( uiRefString )} referenced in transition. UI ${quote( uiRefString )} is only drawn as a nested instance in this fragment; draw it standalone to use it in transitions.`
                            : `Undrawn UI ${quote( uiRefString )} referenced in transition.`,
                    } );
                }
            };

            checkUI( transition.from );
            checkUI( transition.to );

            const fromUIExists = uiIds.has( fromUI );
            const toUIExists = uiIds.has( toUI );
            const fromDeclaration = uiDeclarations.get( fromUI );
            const toDeclaration = uiDeclarations.get( toUI );

            if( !fromUIExists ) {
                markers.push( {
                    severity: 8,
                    startLineNumber: transition.from.line || transition.line,
                    startColumn: transition.from.column || transition.column,
                    endLineNumber: transition.from.line || transition.line,
                    endColumn: ( transition.from.column || transition.column ) + fromRef.length,
                    message: `Referenced "from" UI ${quote( fromRef )} does not exist.`,
                } );
            }

            if( !toUIExists ) {
                markers.push( {
                    severity: 8,
                    startLineNumber: transition.to.line || transition.line,
                    startColumn: transition.to.column || transition.column,
                    endLineNumber: transition.to.line || transition.line,
                    endColumn: ( transition.to.column || transition.column ) + toRef.length,
                    message: `Referenced "to" UI ${quote( toRef )} does not exist.`,
                } );
            }

            if( fromDeclaration && comparePositions(
                fromDeclaration,
                { line: transition.line, column: transition.column }
            ) > 0 ) {
                markers.push( {
                    severity: 8,
                    startLineNumber: transition.from.line || transition.line,
                    startColumn: transition.from.column || transition.column,
                    endLineNumber: transition.from.line || transition.line,
                    endColumn: ( transition.from.column || transition.column ) + fromRef.length,
                    message: `Referenced "from" UI ${quote( fromRef )} is used before its UI declaration.`,
                    code: 'forward-ui-reference'
                } );
            }

            if( toDeclaration && comparePositions(
                toDeclaration,
                { line: transition.line, column: transition.column }
            ) > 0 ) {
                markers.push( {
                    severity: 8,
                    startLineNumber: transition.to.line || transition.line,
                    startColumn: transition.to.column || transition.column,
                    endLineNumber: transition.to.line || transition.line,
                    endColumn: ( transition.to.column || transition.column ) + toRef.length,
                    message: `Referenced "to" UI ${quote( toRef )} is used before its UI declaration.`,
                    code: 'forward-ui-reference'
                } );
            }

            const originUI = parsedData.uis.find( ui => ui.id.toString() === fromUI );

            if( !originUI || !originUI.actions.some( action =>
                action.verb === transition.action && action.target === transition.target ) ) {
                const uiRefString = formatUIRef( transition.from );
                markers.push( {
                    severity: 8,
                    startLineNumber: transition.line,
                    startColumn: transition.verbColumn,
                    endLineNumber: transition.line,
                    endColumn: transition.verbColumn + transition.action.length + 1 + 1 + transition.target.length + 1,
                    message: `Action ${quote( `${transition.action} "${transition.target}"` )} in transition is not defined in UI ${quote( uiRefString )}.`,
                    code: 'invalid-action'
                } );
            }

            const descendantUIIds = getDescendantUIIds(
                inclusionGraph,
                fromUI.toString()
            );
            const duplicatedByInclusion = [ ...descendantUIIds ].find( descendantUIId => {
                const inheritedTransitions = transitionsByOriginUI.get( descendantUIId ) || [];

                return inheritedTransitions.some( inheritedTransition =>
                    inheritedTransition !== transition &&
                    inheritedTransition.action === transition.action &&
                    inheritedTransition.target === transition.target &&
                    normalizeComparableText( inheritedTransition.condition ) === normalizeComparableText( transition.condition ) &&
                    getInnermostUIRef( inheritedTransition.to )
                        .toString() === toUI.toString() );
            } );

            if( duplicatedByInclusion ) {
                markers.push( {
                    severity: 8,
                    startLineNumber: transition.line,
                    startColumn: transition.column,
                    endLineNumber: transition.line,
                    endColumn: transition.column + 20,
                    message: `Transition from UI ${quote( fromUI )} duplicates an inherited transition from included UI ${quote( duplicatedByInclusion )} for action ${quote( `${transition.action} "${transition.target}"` )} to UI ${quote( toUI )}. Remove the duplicate from UI ${quote( fromUI )}; the transition from UI ${quote( duplicatedByInclusion )} is already available by inclusion.`,
                    code: 'duplicate-inclusion-transition'
                } );
            }
        } );

        fragment.draws.forEach( draw => {
            draw.uiRefs.forEach( uiRef => {
                pushLeadingZeroMarkersForRef( markers, uiRef );

                const legacyDrawMarkers = collectLegacyDrawSyntaxMarkers( uiRef, draw );
                markers.push( ...legacyDrawMarkers );

                const checkUIExists = ( ref ) => {
                    const currentId = ref.id.toString();
                    const uiRefString = formatUIRef( ref );

                    if( !uiIds.has( currentId ) ) {
                        markers.push( {
                            severity: 8,
                            startLineNumber: ref.line || draw.line,
                            startColumn: ref.column || draw.column,
                            endLineNumber: ref.line || draw.line,
                            endColumn: ( ref.column || draw.column ) + uiRefString.length,
                            message: `Referenced UI ${quote( uiRefString )} in DRAW does not exist.`,
                        } );
                    }

                    const declaration = uiDeclarations.get( currentId );

                    if( declaration && comparePositions(
                        declaration,
                        { line: draw.line, column: draw.column }
                    ) > 0 ) {
                        markers.push( {
                            severity: 8,
                            startLineNumber: ref.line || draw.line,
                            startColumn: ref.column || draw.column,
                            endLineNumber: ref.line || draw.line,
                            endColumn: ( ref.column || draw.column ) + uiRefString.length,
                            message: `Referenced UI ${quote( uiRefString )} in DRAW is used before its UI declaration.`,
                            code: 'forward-ui-reference'
                        } );
                    }

                    ref.nested.forEach( nestedRef => checkUIExists( nestedRef ) );
                };

                checkUIExists( uiRef );
            } );
        } );
    } );

    parsedData.uis.forEach( ui => {
        ui.actions.forEach( action => {
            const used = parsedData.fragments.some( fragment =>
                fragment.transitions.some( transition =>
                    getInnermostUIRef( transition.from ) === ui.id.toString() &&
                    transition.action === action.verb &&
                    transition.target === action.target ) );

            if( !used ) {
                markers.push( {
                    severity: 4,
                    startLineNumber: action.line,
                    startColumn: action.column,
                    endLineNumber: action.line,
                    endColumn: action.column + 1 + action.verb.length + 1 + action.target.length + 1,
                    message: `Unused action: ${quote( `${action.verb} "${action.target}"` )} in UI ${quote( ui.id )}.`,
                } );
            }
        } );
    } );

    parsedData.uis.forEach( ui => {
        const isDrawn = parsedData.fragments.some( fragment =>
            fragment.draws.some( draw =>
                draw.uiRefs.some( ref => {
                    const checkNestedUIRefs = ( uiRef ) => {
                        if( uiRef.id.toString() === ui.id.toString() ) {
                            return true;
                        }

                        return uiRef.nested.some( nestedRef => checkNestedUIRefs( nestedRef ) );
                    };

                    return checkNestedUIRefs( ref );
                } ) ) );

        if( !isDrawn ) {
            markers.push( {
                severity: 4,
                startLineNumber: ui.line,
                startColumn: ui.column,
                endLineNumber: ui.line,
                endColumn: ui.column + ui.name.length,
                message: `UI ${quote( ui.id )} is not drawn in any fragment.`,
            } );
        }
    } );

    parsedData.uis.forEach( ui => {
        const directTransitions = transitionsByOriginUI.get( ui.id.toString() ) || [];
        const descendantUIIds = getDescendantUIIds(
            inclusionGraph,
            ui.id.toString()
        );
        const hasInheritedTransitions = [ ...descendantUIIds ]
            .some( descendantUIId => ( transitionsByOriginUI.get( descendantUIId ) || [] ).length > 0 );
        const hasEffectiveOutgoingTransitions = directTransitions.length > 0 || hasInheritedTransitions;

        if( !hasEffectiveOutgoingTransitions ) {
            markers.push( {
                severity: 4,
                startLineNumber: ui.line,
                startColumn: ui.column,
                endLineNumber: ui.line,
                endColumn: ui.column + 3 + ui.id.toString().length,
                message: `UI ${quote( ui.id )} has no effective outgoing transitions.`,
            } );
        }

        if( reusableUIIds.has( ui.id.toString() ) ) {
            const hasDedicatedReusableFragment = parsedData.fragments.some( fragment => {
                const standaloneDrawnUIIds = collectStandaloneDrawnUIIds(
                    fragment.draws.flatMap( draw => draw.uiRefs )
                );

                return fragment.transitions.length > 0 &&
                    standaloneDrawnUIIds.has( ui.id.toString() ) &&
                    fragment.transitions.every( transition =>
                        getInnermostUIRef( transition.from )
                            .toString() === ui.id.toString() );
            } );

            if( !hasDedicatedReusableFragment ) {
                markers.push( {
                    severity: 4,
                    startLineNumber: ui.line,
                    startColumn: ui.column,
                    endLineNumber: ui.line,
                    endColumn: ui.column + ui.name.length,
                    message: `Reusable UI ${quote( ui.id )} should have a dedicated fragment that draws it standalone and focuses on its outgoing transitions.`,
                    code: 'missing-reusable-fragment'
                } );
            }
        }
    } );

    return markers;
};


