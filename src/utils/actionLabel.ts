// src/utils/actionLabel.ts
// Normalización y validación de etiquetas de acción: VERB + "COMPLEMENT"

import type { UiVerb } from "../model/uiVerbs";
import { isUiVerb } from "../model/uiVerbs";

/**
 * Complemento:
 * - no vacío (trim)
 * - no permite comillas dobles "
 * - no permite backslash \
 * Porque NO queremos cosas tipo \" en el diagrama.
 */
export function validateComplement( complement: string ): { ok: true } | { ok: false; reason: string } {
    const c = ( complement ?? "" ).trim();
    if ( !c ) return { ok: false, reason: "El complemento no puede quedar vacío." };
    if ( c.includes( `"` ) ) return { ok: false, reason: `El complemento no puede contener comillas dobles (").` };
    if ( c.includes( "\\" ) ) return { ok: false, reason: `El complemento no puede contener backslash (\\).` };
    return { ok: true };
}

/** title visible (con comillas). complement DEBE venir sin comillas. */
export function buildActionTitle( verb: UiVerb, complement: string ): string {
    const c = ( complement ?? "" ).trim();
    return `${verb} "${c}"`;
}

/**
 * Parse tolerante de títulos existentes:
 * - Formato ideal:  verb "complement"
 * - Formato legacy: verb complement
 */
export function parseActionTitle( title: string ): { verb: string; complement: string } | null {
    const t = ( title ?? "" ).trim();
    if ( !t ) return null;

    const mQuoted = /^(\S+)\s+"([^"]*)"$/.exec( t );
    if ( mQuoted ) return { verb: mQuoted[ 1 ], complement: mQuoted[ 2 ] };

    const parts = t.split( /\s+/ );
    if ( parts.length >= 2 ) {
        const verb = parts[ 0 ];
        const complement = parts.slice( 1 ).join( " " );
        return { verb, complement };
    }

    return null;
}

/** Normaliza un title existente a verb "complement" si es posible y válido. */
export function normalizeActionTitle( title: string ): string | null {
    const parsed = parseActionTitle( title );
    if ( !parsed ) return null;

    if ( !isUiVerb( parsed.verb ) ) return null;

    const vComp = validateComplement( parsed.complement );
    if ( !vComp.ok ) return null;

    return buildActionTitle( parsed.verb, parsed.complement );
}

/** Helper para validar verb+complement juntos (útil para parser/build/UI). */
export function validateActionParts(
    verb: string,
    complement: string
): { ok: true; verb: UiVerb; complement: string } | { ok: false; reason: string } {
    if ( !isUiVerb( verb ) ) return { ok: false, reason: `Unknown verb '${verb}'. Verbs are case-sensitive.` };

    const chk = validateComplement( complement );
    if ( !chk.ok ) return { ok: false, reason: chk.reason };

    return { ok: true, verb, complement: ( complement ?? "" ).trim() };
}
