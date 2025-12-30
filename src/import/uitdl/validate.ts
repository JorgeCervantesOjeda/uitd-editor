// src/import/uitdl/validate.ts
import type {
    UITDLDoc,
    ParseIssue,
    UiBlock,
    UiRef,
    FragmentAST,
    TransitionAST,
    UiActionDecl,
} from "./types";

/**
 * Canonical semantic validation for UITDL AST (App 1).
 *
 * Policy (agreed):
 * - Unused action = ERROR
 * - UI never used as FROM = ERROR
 * - Duplicate transition = ERROR
 * - Duplicate UI title with different displayId = ERROR
 * - Same displayId with different title = ERROR (mostly import-level; editor prevents it)
 *
 * Notes:
 * - This validator is AST-level (import-time), not editor-graph-level.
 * - Editor-only checks (color collision, whitespace in displayId) are NOT here.
 */
export function validateUITDLDoc( doc: UITDLDoc ): ParseIssue[] {
    const issues: ParseIssue[] = [];

    const uiById = new Map<string, UiBlock>();
    const uiTitleById = new Map<string, string>(); // raw title (as written / parsed)

    // --- helpers ---
    const error = ( message: string ): void => { issues.push( { kind: "error", message } ); };
    const warn = ( message: string ): void => { issues.push( { kind: "warning", message } ); };

    const normalizeTitle = ( s: string ): string =>
        s
            .trim()
            .replace( /\s+/g, " " )
            .toLowerCase();

    const innermostKey = ( r: UiRef ): string => {
        let cur: UiRef = r;
        while ( cur.children && cur.children.length > 0 ) cur = cur.children[ cur.children.length - 1 ];
        return cur.key;
    };

    type InstanceKey = string;

    /**
     * Build instance keys from a UiRef tree, using the exact instance grammar:
     * - Top-level: "B"
     * - Contained: "A(B)"
     * - Nested deeper: "A(B(C))"
     *
     * The exact formatting here must match how transitions refer to instances in the same fragment.
     */
    const collectInstanceKeysFromDraw = ( ref: UiRef, parentInstance?: InstanceKey ): InstanceKey[] => {
        const thisInstance: InstanceKey = parentInstance ? `${parentInstance}(${ref.key})` : `${ref.key}`;
        const keys: InstanceKey[] = [ thisInstance ];
        for ( const ch of ref.children ?? [] ) {
            keys.push( ...collectInstanceKeysFromDraw( ch, thisInstance ) );
        }
        return keys;
    };

    const instanceKeyForRef = ( ref: UiRef ): InstanceKey => {
        // Build the same nested representation for a UiRef used in transitions.
        // UiRef structure is path-like: key with optional nested children,
        // potentially multiple children due to grammar, but semantically we treat it as
        // a structured instance path. We encode all children in order: A(B,C) becomes A(B)(C) in our encoding.
        // However, UITDL usage in your spec is effectively single child for instance selection.
        // We'll still encode deterministically for safety.
        const build = ( r: UiRef, parent?: string ): string => {
            const cur = parent ? `${parent}(${r.key})` : `${r.key}`;
            // If multiple children exist, we consider the instance ambiguous; still encode all for key stability.
            // The validator will also flag multi-child refs as an error below, if desired later.
            let out = cur;
            for ( const ch of r.children ?? [] ) out = build( ch, out );
            return out;
        };
        return build( ref );
    };

    const actionKey = ( a: { verb: string; complement: string } ): string =>
        `${a.verb}::${a.complement}`;

    // --- 1) Basic structural checks on UI blocks ---
    for ( const ui of doc.uiBlocks ) {
        // UI id uniqueness
        if ( uiById.has( ui.key ) ) {
            error( `Duplicate UI id '${ui.key}'. UI ids must be unique.` );
            continue;
        }
        uiById.set( ui.key, ui );

        const title = ( ui.name ?? "" ).trim();
        uiTitleById.set( ui.key, title );
    }

    if ( doc.uiBlocks.length === 0 ) {
        error( `Document contains no UI blocks.` );
    }

    // --- 2) UI title uniqueness across different ids (normalized, case-insensitive, collapsed spaces) ---
    const titleToId = new Map<string, string>();
    for ( const ui of doc.uiBlocks ) {
        const rawTitle = ( ui.name ?? "" ).trim();
        if ( !rawTitle ) continue; // allow missing titles (no rule specified to forbid), skip title-dup checks
        const norm = normalizeTitle( rawTitle );

        const prevId = titleToId.get( norm );
        if ( prevId && prevId !== ui.key ) {
            const prevRaw = uiTitleById.get( prevId ) ?? "";
            error(
                `Duplicate UI title '${rawTitle}' (normalized: '${normalizeTitle( rawTitle )}') used by different ids ` +
                `('${prevId}' title '${prevRaw}' and '${ui.key}' title '${rawTitle}'). Titles must be unique across different ids.`
            );
        } else if ( !prevId ) {
            titleToId.set( norm, ui.key );
        }
    }

    // --- 3) Fragment name uniqueness ---
    const fragNameSet = new Set<string>();
    for ( const fr of doc.fragments ) {
        const n = ( fr.name ?? "" ).trim();
        if ( !n ) {
            warn( `Found a FRAGMENT with an empty name.` );
            continue;
        }
        const norm = normalizeTitle( n ); // fragment name normalization for duplicate detection
        if ( fragNameSet.has( norm ) ) {
            error( `Duplicate FRAGMENT name '${fr.name}'. Fragment names must be unique (case-insensitive, normalized).` );
        } else {
            fragNameSet.add( norm );
        }
    }

    // --- 4) Validate references in DRAW and build per-fragment instance sets ---
    const fragmentDrawInstanceKeys = new Map<string, Set<InstanceKey>>();
    const fragmentDrawAllUiIds = new Map<string, Set<string>>();

    const collectAllUiIdsInRefTree = ( ref: UiRef, out: Set<string> ): void => {
        out.add( ref.key );
        for ( const ch of ref.children ?? [] ) collectAllUiIdsInRefTree( ch, out );
    };

    for ( const fr of doc.fragments ) {
        const inst = new Set<InstanceKey>();
        const ids = new Set<string>();

        for ( const r of fr.draw ?? [] ) {
            for ( const k of collectInstanceKeysFromDraw( r ) ) inst.add( k );
            collectAllUiIdsInRefTree( r, ids );
        }

        fragmentDrawInstanceKeys.set( fr.name, inst );
        fragmentDrawAllUiIds.set( fr.name, ids );

        // Validate that every UI id referenced in DRAW exists
        for ( const id of ids ) {
            if ( !uiById.has( id ) ) {
                error( `FRAGMENT "${fr.name}" DRAW references UI id '${id}' which is not defined by any UI block.` );
            }
        }

        // Validate fragment WIDTH default (if present)
        if ( fr.widthDefault != null && ( !( Number.isFinite( fr.widthDefault ) ) || fr.widthDefault <= 0 ) ) {
            error( `FRAGMENT "${fr.name}" has invalid WIDTH ${String( fr.widthDefault )}. WIDTH must be a positive integer.` );
        }
    }

    // --- 5) Validate transitions: endpoints drawn as instances, ui existence, action existence, width validity ---
    type TransitionSig = string;
    const seenTransitions = new Set<TransitionSig>();

    const usedAsFrom = new Set<string>(); // UI ids used as FROM (innermost id)
    const usedActionsByUi = new Map<string, Set<string>>(); // uiId -> set(actionKey)

    const markUsedAction = ( uiId: string, verb: string, complement: string ) => {
        if ( !usedActionsByUi.has( uiId ) ) usedActionsByUi.set( uiId, new Set<string>() );
        usedActionsByUi.get( uiId )!.add( actionKey( { verb, complement } ) );
    };

    for ( const fr of doc.fragments ) {
        const instSet = fragmentDrawInstanceKeys.get( fr.name ) ?? new Set<InstanceKey>();
        const idsSet = fragmentDrawAllUiIds.get( fr.name ) ?? new Set<string>();

        for ( const tr of fr.transitions ?? [] ) {
            const fromInst = instanceKeyForRef( tr.from );
            const toInst = instanceKeyForRef( tr.to );

            // (a) Endpoints must be drawable in this fragment as instances
            if ( !instSet.has( fromInst ) ) {
                error(
                    `FRAGMENT "${fr.name}" TRANSITION has origin instance '${fromInst}' not present in this fragment DRAW. ` +
                    `To draw this transition here, include '${fromInst}' in DRAW.`
                );
            }
            if ( !instSet.has( toInst ) ) {
                error(
                    `FRAGMENT "${fr.name}" TRANSITION has destination instance '${toInst}' not present in this fragment DRAW. ` +
                    `To draw this transition here, include '${toInst}' in DRAW.`
                );
            }

            // (b) Underlying UI ids referenced by transition must exist
            const fromId = innermostKey( tr.from );
            const toId = innermostKey( tr.to );

            if ( !uiById.has( fromId ) ) {
                error( `FRAGMENT "${fr.name}" TRANSITION references undefined origin UI id '${fromId}'.` );
            }
            if ( !uiById.has( toId ) ) {
                error( `FRAGMENT "${fr.name}" TRANSITION references undefined destination UI id '${toId}'.` );
            }

            // (c) If the fragment DRAW doesn't reference underlying ids, it's still ok semantically,
            // but since we require drawable endpoints by instance, missing ids are already caught.
            // Keep this check as a more direct message for missing ids if needed.
            if ( idsSet.size > 0 ) {
                if ( !idsSet.has( fromId ) ) {
                    // This can happen if the instance existed but underlying id missing (should not happen), keep as sanity.
                    warn( `FRAGMENT "${fr.name}" DRAW does not include origin UI id '${fromId}' (sanity check).` );
                }
                if ( !idsSet.has( toId ) ) {
                    warn( `FRAGMENT "${fr.name}" DRAW does not include destination UI id '${toId}' (sanity check).` );
                }
            }

            // (d) Action used in transition must exist in origin UI (innermost UI)
            const origin = uiById.get( fromId );
            if ( origin ) {
                const declSet = new Set<string>( origin.actions.map( ( a ) => actionKey( { verb: a.verb, complement: a.complement } ) ) );
                const used = actionKey( { verb: tr.verb, complement: tr.complement } );
                if ( !declSet.has( used ) ) {
                    error(
                        `FRAGMENT "${fr.name}" TRANSITION uses action '${tr.verb} "${tr.complement}"' from origin '${fromInst}', ` +
                        `but that action is not declared in UI ${fromId} actions { ... }.`
                    );
                } else {
                    // Mark action as used (for unused-action validation later)
                    markUsedAction( fromId, tr.verb, tr.complement );
                }
            }

            // (e) Mark UI as used as FROM
            if ( fromId ) usedAsFrom.add( fromId );

            // (f) Transition WIDTH validation
            if ( tr.width != null && ( !( Number.isFinite( tr.width ) ) || tr.width <= 0 ) ) {
                error(
                    `FRAGMENT "${fr.name}" TRANSITION has invalid WIDTH ${String( tr.width )}. WIDTH must be a positive integer.`
                );
            }

            // (g) Duplicate transition detection (global across doc)
            const sig: TransitionSig = [
                normalizeTitle( fr.name ),
                fromInst,
                toInst,
                tr.verb,
                tr.complement,
                tr.condLabel ? normalizeTitle( tr.condLabel ) : "",
                tr.width != null ? String( tr.width ) : "",
            ].join( "|" );

            if ( seenTransitions.has( sig ) ) {
                error(
                    `Duplicate TRANSITION detected in FRAGMENT "${fr.name}": from '${fromInst}' to '${toInst}' ` +
                    `if user ${tr.verb} "${tr.complement}"` +
                    `${tr.condLabel ? ` AND "${tr.condLabel}"` : ""}` +
                    `${tr.width != null ? ` WIDTH ${tr.width}` : ""}.`
                );
            } else {
                seenTransitions.add( sig );
            }
        }
    }

    // --- 6) Unused action = ERROR (per your latest decision) ---
    for ( const ui of doc.uiBlocks ) {
        const declared = new Set<string>( ui.actions.map( ( a ) => actionKey( { verb: a.verb, complement: a.complement } ) ) );
        const used = usedActionsByUi.get( ui.key ) ?? new Set<string>();

        for ( const a of declared ) {
            if ( !used.has( a ) ) {
                // Recover a human label
                const decl = ui.actions.find( ( x ) => actionKey( { verb: x.verb, complement: x.complement } ) === a );
                const label = decl ? `${decl.verb} "${decl.complement}"` : a;
                error( `UI ${ui.key} declares action ${label} but no TRANSITION uses it as a trigger from UI ${ui.key}.` );
            }
        }
    }

    // --- 7) UI never used as FROM = ERROR (per your latest decision) ---
    for ( const ui of doc.uiBlocks ) {
        if ( !usedAsFrom.has( ui.key ) ) {
            error( `UI ${ui.key} is never used as a TRANSITION origin (no outgoing transitions defined from this UI).` );
        }
    }

    return issues;
}
