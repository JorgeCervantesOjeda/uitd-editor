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

const DEFAULT_FRAGMENT_FILL = "#f7f7f7";
const INCOMPLETE_UI_STROKE_DASH = 4;
const NODE_STROKE_WIDTH = 6;
const ACTION_STROKE_WIDTH = 6;

type DrawnReference = {
    key: string;
    identifier: string;
};

function escapeD2Text( value: string ): string {
    return value
        .replace( /\\/g, "\\\\" )
        .replace( /"/g, "\\\"" )
        .replace( /\r\n/g, "\\n" )
        .replace( /\n/g, "\\n" )
        .replace( /\r/g, "\\n" );
}

function d2Identifier( prefix: string, key: string ): string {
    return `${prefix}_${key.replace( /[^a-zA-Z0-9_]/g, "_" )}`;
}

function d2UIIdentifier( key: string ): string {
    return d2Identifier( "ui", key );
}

function formatReference( reference: UiRef ): string {
    const current = d2UIIdentifier( reference.key );
    if ( reference.children.length === 0 ) return current;
    return `${current}.${formatReference( reference.children[ 0 ] )}`;
}

function innermostKeyOfReference( reference: UiRef ): string {
    let current = reference;
    while ( current.children.length > 0 ) current = current.children[ 0 ];
    return current.key;
}

function innermostIdentifierOfReference( reference: UiRef ): string {
    return d2UIIdentifier( innermostKeyOfReference( reference ) );
}

function incidentTransitionSignature( from: string, to: string, transition: TransitionAST ): string {
    return [
        from,
        to,
        transition.verb,
        transition.complement,
        transition.condLabel ?? "",
    ].join( "\u0000" );
}

function collectDrawnReferences( reference: UiRef, parentIdentifier?: string ): DrawnReference[] {
    const identifier = parentIdentifier
        ? `${parentIdentifier}.${d2UIIdentifier( reference.key )}`
        : d2UIIdentifier( reference.key );
    const references: DrawnReference[] = [ { key: reference.key, identifier } ];

    for ( const child of reference.children ) {
        references.push( ...collectDrawnReferences( child, identifier ) );
    }

    return references;
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
    incompleteInstanceIdentifiers: ReadonlySet<string>,
    depth: number,
    parentIdentifier?: string
): string[] {
    const indentation = "  ".repeat( depth );
    const identifier = d2UIIdentifier( reference.key );
    const pathIdentifier = parentIdentifier ? `${parentIdentifier}.${identifier}` : identifier;
    const label = escapeD2Text( `${reference.key} ${nameByKey.get( reference.key ) ?? `UI ${reference.key}`}` );
    const colors = colorsByUIID.get( reference.key ) ?? DEFAULT_UI_COLORS;
    const lines = [ `${indentation}${identifier}: "${label}" {` ];
    lines.push( `${indentation}  style.fill: "${escapeD2Text( colors.fill )}"` );
    lines.push( `${indentation}  style.stroke: "${escapeD2Text( colors.stroke )}"` );
    lines.push( `${indentation}  style.stroke-width: ${NODE_STROKE_WIDTH}` );
    lines.push( `${indentation}  style.font-color: "${escapeD2Text( colors.text )}"` );
    if ( incompleteInstanceIdentifiers.has( pathIdentifier ) ) {
        lines.push( `${indentation}  style.stroke-dash: ${INCOMPLETE_UI_STROKE_DASH}` );
    }
    for ( const child of reference.children ) {
        lines.push( ...renderReference(
            child,
            nameByKey,
            colorsByUIID,
            incompleteInstanceIdentifiers,
            depth + 1,
            pathIdentifier
        ) );
    }
    lines.push( `${indentation}}` );
    return lines;
}

function addSignature( signaturesByIdentifier: Map<string, Set<string>>, identifier: string, signature: string ) {
    const signatures = signaturesByIdentifier.get( identifier ) ?? new Set<string>();
    signatures.add( signature );
    signaturesByIdentifier.set( identifier, signatures );
}

function buildIncidentSignaturesByUIIdentifier( fragments: FragmentAST[] ): Map<string, Set<string>> {
    const signaturesByUIIdentifier = new Map<string, Set<string>>();

    for ( const fragment of fragments ) {
        for ( const transition of fragment.transitions ) {
            const from = innermostIdentifierOfReference( transition.from );
            const to = innermostIdentifierOfReference( transition.to );
            const signature = incidentTransitionSignature( from, to, transition );
            addSignature( signaturesByUIIdentifier, from, signature );
            addSignature( signaturesByUIIdentifier, to, signature );
        }
    }

    return signaturesByUIIdentifier;
}

function buildIncidentSignaturesByInstance( fragment: FragmentAST ): Map<string, Set<string>> {
    const signaturesByInstance = new Map<string, Set<string>>();

    for ( const transition of fragment.transitions ) {
        const from = formatReference( transition.from );
        const to = formatReference( transition.to );
        const signature = incidentTransitionSignature( from, to, transition );
        addSignature( signaturesByInstance, from, signature );
        addSignature( signaturesByInstance, to, signature );
    }

    return signaturesByInstance;
}

function hasEqualSizeOfSignatures(
    requiredSignatures: ReadonlySet<string>,
    availableSignatures: ReadonlySet<string> | undefined
): boolean {
    return requiredSignatures.size > 0 && requiredSignatures.size === ( availableSignatures?.size ?? 0 );
}

function incompleteInstanceIdentifiersOfFragment(
    fragment: FragmentAST,
    incidentSignaturesByUIIdentifier: ReadonlyMap<string, ReadonlySet<string>>
): Set<string> {
    const incidentSignaturesByInstance = buildIncidentSignaturesByInstance( fragment );
    const incompleteIdentifiers = new Set<string>();

    for ( const reference of fragment.draw ) {
        for ( const drawnReference of collectDrawnReferences( reference ) ) {
            const requiredSignatures = incidentSignaturesByUIIdentifier.get( d2UIIdentifier( drawnReference.key ) );
            if ( !requiredSignatures || requiredSignatures.size === 0 ) continue;
            const availableSignatures = incidentSignaturesByInstance.get( drawnReference.identifier );
            if ( !hasEqualSizeOfSignatures( requiredSignatures, availableSignatures ) ) {
                incompleteIdentifiers.add( drawnReference.identifier );
            }
        }
    }

    return incompleteIdentifiers;
}

function actionLabel( transition: TransitionAST, fragment: FragmentAST ): string {
    return wrapWords(
        `${transition.verb} "${transition.complement}"`,
        transition.width ?? fragment.widthDefault ?? 40
    );
}

function conditionLabel( transition: TransitionAST, fragment: FragmentAST ): string {
    return wrapWords(
        transition.condLabel ?? "",
        transition.width ?? fragment.widthDefault ?? 40
    );
}

function renderActionNode( identifier: string, label: string, colors: D2UIColors ): string[] {
    return [
        `  ${identifier}: "${escapeD2Text( label )}" {`,
        "    shape: oval",
        `    style.fill: "${escapeD2Text( colors.fill )}"`,
        `    style.stroke: "${escapeD2Text( colors.stroke )}"`,
        `    style.stroke-width: ${ACTION_STROKE_WIDTH}`,
        `    style.font-color: "${escapeD2Text( colors.text )}"`,
        "  }",
    ];
}

function renderConditionNode( identifier: string, label: string ): string[] {
    return [
        `  ${identifier}: "${escapeD2Text( label )}" {`,
        "    shape: hexagon",
        "  }",
    ];
}

function renderDottedUIEdge( from: string, to: string ): string[] {
    return [
        `  ${from} -> ${to}: {`,
        "    style.stroke-dash: 4",
        "  }",
    ];
}

export function translateUITDLToD2( text: string, options: D2TranslationOptions = {} ): string {
    const document = parseUITDL( text );
    const colorsByUIID = options.colorsByUIID ?? new Map<string, D2UIColors>();
    const nameByKey = new Map(
        document.uiBlocks.map( ui => [ ui.key, ui.name ?? `UI ${ui.key}` ] )
    );
    const incidentSignaturesByUIIdentifier = buildIncidentSignaturesByUIIdentifier( document.fragments );
    const lines = [
        "# Generated from validated UITDL. D2 edits do not modify the UITDL model.",
        "direction: right",
        "",
        `# UITD: ${escapeD2Text( document.title )}`,
    ];

    document.fragments.forEach( ( fragment, indexOfFragment ) => {
        const fragmentIdentifier = `fragment_${indexOfFragment + 1}`;
        const actionIdByKey = new Map<string, string>();
        const incompleteInstanceIdentifiers = incompleteInstanceIdentifiersOfFragment(
            fragment,
            incidentSignaturesByUIIdentifier
        );
        let countOfActions = 0;
        let countOfConditions = 0;

        lines.push( ``, `${fragmentIdentifier}: "${escapeD2Text( fragment.name )}" {` );
        lines.push( `  style.fill: "${DEFAULT_FRAGMENT_FILL}"` );
        for ( const reference of fragment.draw ) {
            lines.push( ...renderReference(
                reference,
                nameByKey,
                colorsByUIID,
                incompleteInstanceIdentifiers,
                1
            ) );
        }
        if ( fragment.draw.length > 0 && fragment.transitions.length > 0 ) lines.push( "" );
        for ( const transition of fragment.transitions ) {
            const from = formatReference( transition.from );
            const to = formatReference( transition.to );
            const action = actionLabel( transition, fragment );
            const actionKey = `${from}\u0000${transition.verb}\u0000${transition.complement}`;
            let actionIdentifier = actionIdByKey.get( actionKey );

            if ( !actionIdentifier ) {
                countOfActions += 1;
                actionIdentifier = d2Identifier( "action", String( countOfActions ) );
                actionIdByKey.set( actionKey, actionIdentifier );
                lines.push( ...renderActionNode(
                    actionIdentifier,
                    action,
                    colorsByUIID.get( innermostKeyOfReference( transition.from ) ) ?? DEFAULT_UI_COLORS
                ) );
                lines.push( `  ${from} -> ${actionIdentifier}` );
            }

            if ( transition.condLabel ) {
                countOfConditions += 1;
                const conditionIdentifier = d2Identifier( "condition", String( countOfConditions ) );
                lines.push( ...renderConditionNode( conditionIdentifier, conditionLabel( transition, fragment ) ) );
                lines.push( `  ${actionIdentifier} -> ${conditionIdentifier}` );
                lines.push( ...renderDottedUIEdge( conditionIdentifier, to ) );
            } else {
                lines.push( ...renderDottedUIEdge( actionIdentifier, to ) );
            }
        }
        lines.push( "}" );
    } );

    lines.push( "" );
    return lines.join( "\n" );
}
