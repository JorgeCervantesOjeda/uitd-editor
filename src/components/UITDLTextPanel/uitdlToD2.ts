// src/components/UITDLTextPanel/uitdlToD2.ts
// Translates validated UITDL into deterministic, editable D2 presentation source.

import { parseUITDL } from "../../import/uitdl/parser";
import type { FragmentAST, TransitionAST, UiRef } from "../../import/uitdl/types";

export type D2UIColors = {
    fill: string;
    stroke: string;
    text: string;
};

type D2TranslationOptions = {
    colorsByUIID?: ReadonlyMap<string, D2UIColors>;
};

const DEFAULT_UI_COLORS: D2UIColors = {
    fill: "#f1f5f9",
    stroke: "#94a3b8",
    text: "#334155",
};

function escapeD2Text( value: string ): string {
    return value
        .replace( /\\/g, "\\\\" )
        .replace( /"/g, "\\\"" )
        .replace( /\r\n/g, "\\n" )
        .replace( /\n/g, "\\n" )
        .replace( /\r/g, "\\n" );
}

function d2Identifier( key: string ): string {
    return `ui_${key.replace( /[^a-zA-Z0-9_]/g, "_" )}`;
}

function formatReference( reference: UiRef ): string {
    const current = d2Identifier( reference.key );
    if ( reference.children.length === 0 ) return current;
    return `${current}.${formatReference( reference.children[ 0 ] )}`;
}

function wrapWords( value: string, width: number ): string {
    if ( width <= 0 ) return value;
    const lines: string[] = [];
    let line = "";
    for ( const word of value.split( /\s+/ ).filter( Boolean ) ) {
        if ( line && `${line} ${word}`.length > width ) {
            lines.push( line );
            line = word;
        } else {
            line = line ? `${line} ${word}` : word;
        }
    }
    if ( line ) lines.push( line );
    return lines.join( "\n" );
}

function renderReference(
    reference: UiRef,
    nameByKey: Map<string, string>,
    colorsByUIID: ReadonlyMap<string, D2UIColors>,
    depth: number
): string[] {
    const indentation = "  ".repeat( depth );
    const identifier = d2Identifier( reference.key );
    const label = escapeD2Text( `${reference.key} ${nameByKey.get( reference.key ) ?? `UI ${reference.key}`}` );
    const colors = colorsByUIID.get( reference.key ) ?? DEFAULT_UI_COLORS;
    const lines = [ `${indentation}${identifier}: "${label}" {` ];
    lines.push( `${indentation}  style.fill: "${escapeD2Text( colors.fill )}"` );
    lines.push( `${indentation}  style.stroke: "${escapeD2Text( colors.stroke )}"` );
    lines.push( `${indentation}  style.font-color: "${escapeD2Text( colors.text )}"` );
    for ( const child of reference.children ) {
        lines.push( ...renderReference( child, nameByKey, colorsByUIID, depth + 1 ) );
    }
    lines.push( `${indentation}}` );
    return lines;
}

function transitionLabel( transition: TransitionAST, fragment: FragmentAST ): string {
    const source = [
        `${transition.verb} "${transition.complement}"`,
        transition.condLabel ? `AND "${transition.condLabel}"` : "",
    ].filter( Boolean ).join( " " );
    return wrapWords( source, transition.width ?? fragment.widthDefault ?? 40 );
}

export function translateUITDLToD2( text: string, options: D2TranslationOptions = {} ): string {
    const document = parseUITDL( text );
    const colorsByUIID = options.colorsByUIID ?? new Map<string, D2UIColors>();
    const nameByKey = new Map(
        document.uiBlocks.map( ui => [ ui.key, ui.name ?? `UI ${ui.key}` ] )
    );
    const lines = [
        "# Generated from validated UITDL. D2 edits do not modify the UITDL model.",
        "direction: right",
        "",
        `uitd: "${escapeD2Text( document.title )}" {`,
    ];

    document.fragments.forEach( ( fragment, indexOfFragment ) => {
        const fragmentIdentifier = `fragment_${indexOfFragment + 1}`;
        lines.push( `  ${fragmentIdentifier}: "${escapeD2Text( fragment.name )}" {` );
        for ( const reference of fragment.draw ) {
            lines.push( ...renderReference( reference, nameByKey, colorsByUIID, 2 ) );
        }
        if ( fragment.draw.length > 0 && fragment.transitions.length > 0 ) lines.push( "" );
        for ( const transition of fragment.transitions ) {
            const from = formatReference( transition.from );
            const to = formatReference( transition.to );
            const label = escapeD2Text( transitionLabel( transition, fragment ) );
            lines.push( `    ${from} -> ${to}: "${label}"` );
        }
        lines.push( "  }" );
    } );

    lines.push( "}", "" );
    return lines.join( "\n" );
}
