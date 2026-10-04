// src/validation/uitdlCanonical/utils.js
// Canonical project-owned UITDL parser and semantic validator.

export const getInnermostUIStr = ( uiRefStr ) => {
    const parts = uiRefStr.split( /\[|\]|\(|\)/ );

    return parts[ parts.length - 1 ] === '' ?
        parts[ parts.length - 2 ] :
        parts[ parts.length - 1 ];
};

export function getInnermostUIRef( uiRef ) {
    if( uiRef.nested && uiRef.nested.length > 0 ) {
        return getInnermostUIRef( uiRef.nested[ uiRef.nested.length - 1 ] );
    }

    return uiRef.id;
}

export const formatUIRef = ( uiRef ) => {
    if( uiRef.nested.length > 0 ) {
        return `${uiRef.id}(${uiRef.nested.map( nestedRef => formatUIRef( nestedRef ) )
            .join( ',' )})`;
    }

    return uiRef.id;
};

export const formatDrawRef = ( uiRef ) => {
    if( uiRef.nested.length > 0 ) {
        return `${uiRef.id}[${uiRef.nested.map( nestedRef => formatDrawRef( nestedRef ) )
            .join( ', ' )}]`;
    }

    return uiRef.id;
};

export const formatDrawRefUsingParsedSyntax = ( uiRef ) => {
    if( uiRef.nested.length === 0 ) {
        return uiRef.id;
    }

    const openingDelimiter = uiRef.drawDelimiter === '(' ? '(' : '[';
    const closingDelimiter = openingDelimiter === '(' ? ')' : ']';

    return `${uiRef.id}${openingDelimiter}${uiRef.nested.map( nestedRef => formatDrawRefUsingParsedSyntax( nestedRef ) )
        .join( ', ' )}${closingDelimiter}`;
};

export const debounce = ( func, delay ) => {
    let timeoutId;

    return ( ...args ) => {
        clearTimeout( timeoutId );
        timeoutId = setTimeout( () => {
            func( ...args );
        }, delay );
    };
};


