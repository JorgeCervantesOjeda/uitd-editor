// src/validation/sharedUITDLRules.js
// Source-independent UITDL rules shared by text and canvas validators.

export const hasLeadingZeroUIID = ( value ) => /^0\d+$/.test( String( value ) );

export const leadingZeroUIIDMessage = ( value ) =>
    `Invalid UIID "${value}": UI IDs must not contain leading zeros.`;

export const isPositiveInteger = ( value ) =>
    Number.isInteger( value ) && value > 0;

export const normalizeComparableText = ( value = "" ) =>
    ( value == null ? "" : String( value ) )
        .replace( /\s+/g, " " )
        .trim()
        .toLowerCase();

export const duplicateCaseSensitiveValues = ( values ) => {
    const firstIndexByValue = new Map();
    const duplicates = [];

    values.forEach( ( value, index ) => {
        if( firstIndexByValue.has( value ) ) {
            duplicates.push( {
                value,
                index,
                firstIndex: firstIndexByValue.get( value ),
            } );
            return;
        }

        firstIndexByValue.set( value, index );
    } );

    return duplicates;
};

const transitionKey = ( transition, includeScope ) => [
    includeScope ? transition.scope || "" : "",
    transition.from,
    transition.verb,
    transition.complement,
    normalizeComparableText( transition.condition ),
    transition.to,
].join( "\u0000" );

const actionKey = ( transition ) => [
    transition.from,
    transition.verb,
    transition.complement,
].join( "\u0000" );

export const analyzeTransitionSet = ( transitions ) => {
    const uniqueIndices = [];
    const duplicateIndices = [];
    const seenTransitionKeys = new Set();

    transitions.forEach( ( transition, index ) => {
        const key = transitionKey( transition, Boolean( transition.scope ) );
        if( seenTransitionKeys.has( key ) ) {
            duplicateIndices.push( index );
            return;
        }

        seenTransitionKeys.add( key );
        uniqueIndices.push( index );
    } );

    const transitionsByAction = new Map();
    uniqueIndices.forEach( index => {
        const transition = transitions[ index ];
        const key = actionKey( transition );
        const group = transitionsByAction.get( key ) || [];
        group.push( index );
        transitionsByAction.set( key, group );
    } );

    const mixedActionGroups = [];
    const multipleDestinationGroups = [];

    transitionsByAction.forEach( ( indices ) => {
        const hasConditional = indices.some( index => normalizeComparableText( transitions[ index ].condition ) );
        const hasUnconditional = indices.some( index => !normalizeComparableText( transitions[ index ].condition ) );

        if( hasConditional && hasUnconditional ) {
            mixedActionGroups.push( { indices } );
        }

        const destinationsByCondition = new Map();
        indices.forEach( index => {
            const transition = transitions[ index ];
            const condition = normalizeComparableText( transition.condition );
            const destinations = destinationsByCondition.get( condition ) || new Set();
            destinations.add( transition.to );
            destinationsByCondition.set( condition, destinations );
        } );

        destinationsByCondition.forEach( ( destinations, condition ) => {
            if( destinations.size <= 1 ) return;
            multipleDestinationGroups.push( {
                condition,
                destinations: Array.from( destinations ),
                indices: indices.filter( index =>
                    normalizeComparableText( transitions[ index ].condition ) === condition
                ),
            } );
        } );
    } );

    return {
        uniqueIndices,
        duplicateIndices,
        mixedActionGroups,
        multipleDestinationGroups,
    };
};
