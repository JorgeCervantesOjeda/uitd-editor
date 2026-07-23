// src/validation/diagramValidation.ts
//
// UITDL diagram validator for the editor graph.
// Implements the rules from "Casos de Validación y Diagnóstico de Modelos UITDL".
//

import type {
    NodeBox,
    NodeId,
    ActionLabel,
    ActionId,
    ConditionLabel,
    ConditionId,
    Edge,
    EdgeEndpoint,
    UiVerb,
} from "../model/types";
import { buildFragmentGroups, resolveFragmentTitle } from "../fragments/fragmentModel";
import { hasLeadingZeroUIID, leadingZeroUIIDMessage } from "../import/uitdl/uiIdValidation";
import {
    duplicateTransitionDiagnostic,
    invalidUiIdDiagnostic,
    invalidWidthDiagnostic,
    mixedConditionalTransitionDiagnostic,
    multipleTransitionDestinationsDiagnostic,
    uiNoEffectiveOutgoingDiagnostic,
    unusedActionDiagnostic,
    type DiagnosticSource,
} from "./uitdlDiagnostics";

export type Severity = "error" | "warning";

export type IssueRef =
    | { kind: "node"; id: NodeId }
    | { kind: "action"; id: ActionId }
    | { kind: "condition"; id: ConditionId };

export interface DiagramIssue {
    kind: Severity;
    code: string;
    message: string;
    source: DiagnosticSource;
    ref?: IssueRef;
    fragmentId?: string;
    fragmentTitle?: string;
    refLabel?: string;
}

const normalizeText = ( s: string ): string =>
    ( s ?? "" )
        .trim()
        .replace( /\s+/g, " " )
        .toLowerCase();

const normalizeCondition = ( s: string ): string => normalizeText( s );

const isPositiveInt = ( n: unknown ): boolean =>
    typeof n === "number" && Number.isInteger( n ) && n > 0;

const hasNewline = ( s: string ): boolean => /[\r\n]/.test( s );

type QuotedCheckResult = { bad: boolean; why?: string };

const hasDisallowedQuotedStringChars = ( s: string ): QuotedCheckResult => {
    // QUOTEDSTRING rules:
    // - no newlines
    // - no double quotes
    // - no backslash (escapes)
    // - no emojis / pictographic symbols (when runtime supports it)
    if ( hasNewline( s ) ) return { bad: true, why: "contains a newline" };
    if ( s.includes( `"` ) ) return { bad: true, why: 'contains double quotes (")' };
    if ( s.includes( "\\" ) ) return { bad: true, why: "contains backslash (\\), invalid escape" };

    try {
        const re = /[\p{Extended_Pictographic}]/u;
        if ( re.test( s ) ) return { bad: true, why: "contains emojis / pictographic characters" };
    } catch {
        // If the engine doesn't support Unicode property escapes, ignore this check.
    }

    return { bad: false };
};

const keyOf = ( ep: EdgeEndpoint ): string => `${ep.kind}:${ep.id}`;

type Transition = {
    fragmentId: string;
    fromNodeId: NodeId;
    toNodeId: NodeId;
    verb: UiVerb;
    complement: string;
    condRaw: string | null;
    condNorm: string | null;
    viaActionId: ActionId;
    viaCondId: ConditionId | null;
};

export function validateDiagram( input: {
    nodes: NodeBox[];
    actions: ActionLabel[];
    conditions: ConditionLabel[];
    edges: Edge[];
    fragmentTitles?: Record<string, string>;
} ): DiagramIssue[] {
    const { nodes, actions, conditions, edges, fragmentTitles } = input;

    const issues: DiagramIssue[] = [];

    const nodeById = new Map<NodeId, NodeBox>();
    const actionById = new Map<ActionId, ActionLabel>();
    const condById = new Map<ConditionId, ConditionLabel>();

    for ( const n of nodes ) nodeById.set( n.id, n );
    for ( const a of actions ) actionById.set( a.id, a );
    for ( const c of conditions ) condById.set( c.id, c );

    const uiIdByNodeId = new Map<NodeId, string>();
    const firstNodeByUiId = new Map<string, NodeBox>();

    for ( const n of nodes ) {
        const raw = ( n.displayId ?? "" ).toString().trim();
        const uiId = raw || String( n.id );
        uiIdByNodeId.set( n.id, uiId );
        if ( !firstNodeByUiId.has( uiId ) ) firstNodeByUiId.set( uiId, n );
    }

    const edgesByFrom = new Map<string, Edge[]>();
    const edgesByTo = new Map<string, Edge[]>();
    for ( const e of edges ) {
        const kf = keyOf( e.from );
        const kt = keyOf( e.to );
        if ( !edgesByFrom.has( kf ) ) edgesByFrom.set( kf, [] );
        if ( !edgesByTo.has( kt ) ) edgesByTo.set( kt, [] );
        edgesByFrom.get( kf )!.push( e );
        edgesByTo.get( kt )!.push( e );
    }

    const fragmentGroups = buildFragmentGroups( { nodes, actions, conditions, edges } );
    const fragmentIdByKey = new Map<string, string>();
    const fragmentTitleById = new Map<string, string>();
    fragmentGroups.forEach( ( group, indexOfFragment ) => {
        const title = resolveFragmentTitle( fragmentTitles, group.id, indexOfFragment );
        fragmentTitleById.set( group.id, title );
        for ( const id of group.nodeIds ) fragmentIdByKey.set( `node:${id}`, group.id );
        for ( const id of group.actionIds ) fragmentIdByKey.set( `action:${id}`, group.id );
        for ( const id of group.conditionIds ) fragmentIdByKey.set( `condition:${id}`, group.id );
    } );

    const fragOfNode = ( id: NodeId ): string =>
        fragmentIdByKey.get( `node:${id}` ) ?? "";
    const fragOfAction = ( id: ActionId ): string =>
        fragmentIdByKey.get( `action:${id}` ) ?? "";
    const fragOfCondition = ( id: ConditionId ): string =>
        fragmentIdByKey.get( `condition:${id}` ) ?? "";

    const fragmentTitleOf = ( fragmentId?: string ): string | undefined =>
        fragmentId ? fragmentTitleById.get( fragmentId ) : undefined;

    const uiLabel = ( uiId: string ): string => {
        const node = firstNodeByUiId.get( uiId );
        const title = node?.title?.trim();
        return title ? `UI ${uiId} "${title}"` : `UI ${uiId}`;
    };

    const nodeLabel = ( id: NodeId ): string => {
        const node = nodeById.get( id );
        const uiId = uiIdByNodeId.get( id ) ?? String( id );
        const title = node?.title?.trim();
        return title ? `UI ${uiId} "${title}"` : `UI ${uiId}`;
    };

    const actionLabel = ( id: ActionId ): string => {
        const action = actionById.get( id );
        if ( !action ) return `Action ${id}`;
        return `Action ${action.verb} "${action.complement}" in ${nodeLabel( action.originNodeId )}`;
    };

    const conditionLabel = ( id: ConditionId ): string => {
        const condition = condById.get( id );
        if ( !condition ) return `Condition ${id}`;
        const title = condition.title?.trim();
        return title ? `Condition "${title}"` : "Condition";
    };

    const refLabel = ( ref?: IssueRef ): string | undefined => {
        if ( !ref ) return undefined;
        if ( ref.kind === "node" ) return nodeLabel( ref.id );
        if ( ref.kind === "action" ) return actionLabel( ref.id );
        return conditionLabel( ref.id );
    };

    const push = ( kind: Severity, code: string, message: string, ref?: IssueRef ) => {
        let fragmentId: string | undefined;
        if ( ref?.kind === "node" ) fragmentId = fragOfNode( ref.id );
        else if ( ref?.kind === "action" ) fragmentId = fragOfAction( ref.id );
        else if ( ref?.kind === "condition" ) fragmentId = fragOfCondition( ref.id );
        const fragmentTitle = fragmentTitleOf( fragmentId );
        issues.push( {
            kind,
            code,
            message,
            source: "canvas-model",
            ref,
            fragmentId,
            fragmentTitle,
            refLabel: refLabel( ref ),
        } );
    };

    // --- Nesting integrity: parentId must exist and must not form cycles ---
    for ( const n of nodes ) {
        if ( n.parentId != null && !nodeById.has( n.parentId ) ) {
            push(
                "error",
                "parent-dangling",
                `Node ${n.id} references missing parentId=${n.parentId}.`,
                { kind: "node", id: n.id },
            );
        }
    }

    const reportedCycles = new Set<string>();
    for ( const n of nodes ) {
        const seen = new Set<NodeId>();
        let cur: NodeId | null = n.id;

        while ( cur != null ) {
            if ( seen.has( cur ) ) {
                const cycleKey = Array.from( seen ).sort( ( a, b ) => a - b ).join( "," );
                if ( !reportedCycles.has( cycleKey ) ) {
                    reportedCycles.add( cycleKey );
                    push(
                        "error",
                        "parent-cycle",
                        `Cycle detected in node parent hierarchy involving node ${cur}.`,
                        { kind: "node", id: n.id },
                    );
                }
                break;
            }
            seen.add( cur );
            const parent: NodeId | null = nodeById.get( cur )?.parentId ?? null;
            if ( parent != null && !nodeById.has( parent ) ) break;
            cur = parent;
        }
    }

    // --- Edge integrity: endpoints must exist ---
    const ensureEndpointExists = ( ep: EdgeEndpoint ) => {
        if ( ep.kind === "node" && !nodeById.has( ep.id as NodeId ) ) {
            push(
                "error",
                "edge-dangling",
                `Edge points to a non-existing node (id=${ep.id}).`,
            );
        }
        if ( ep.kind === "action" && !actionById.has( ep.id as ActionId ) ) {
            push(
                "error",
                "edge-dangling",
                `Edge points to a non-existing action (id=${ep.id}).`,
            );
        }
        if ( ep.kind === "condition" && !condById.has( ep.id as ConditionId ) ) {
            push(
                "error",
                "edge-dangling",
                `Edge points to a non-existing condition (id=${ep.id}).`,
            );
        }
    };

    for ( const e of edges ) {
        ensureEndpointExists( e.from );
        ensureEndpointExists( e.to );
    }

    // --- QUOTEDSTRING: UI titles, complements, conditions ---
    for ( const n of nodes ) {
        const title = ( n.title ?? "" ).toString();
        const chk = hasDisallowedQuotedStringChars( title );
        if ( chk.bad ) {
            push(
                "error",
                "invalid-quoted-string",
                `UI title "${title}" is invalid: ${chk.why}.`,
                { kind: "node", id: n.id },
            );
        }
    }

    for ( const a of actions ) {
        const complement = ( a.complement ?? "" ).toString();
        const chk = hasDisallowedQuotedStringChars( complement );
        if ( chk.bad ) {
            push(
                "error",
                "invalid-quoted-string",
                `Action complement "${complement}" is invalid: ${chk.why}.`,
                { kind: "action", id: a.id },
            );
        }
    }

    for ( const c of conditions ) {
        const t = ( c.title ?? "" ).toString();
        const chk = hasDisallowedQuotedStringChars( t );
        if ( chk.bad ) {
            push(
                "error",
                "invalid-quoted-string",
                `Condition "${t}" is invalid: ${chk.why}.`,
                { kind: "condition", id: c.id },
            );
        }
    }

    // --- WIDTH / wrap: positive integer ---
    for ( const n of nodes ) {
        if ( n.wrap != null && !isPositiveInt( n.wrap ) ) {
            const diagnostic = invalidWidthDiagnostic( "UI WIDTH (wrap)", n.wrap );
            push(
                diagnostic.kind,
                diagnostic.code,
                diagnostic.message,
                { kind: "node", id: n.id },
            );
        }
    }
    for ( const a of actions ) {
        if ( a.wrap != null && !isPositiveInt( a.wrap ) ) {
            const diagnostic = invalidWidthDiagnostic( "Action WIDTH (wrap)", a.wrap );
            push(
                diagnostic.kind,
                diagnostic.code,
                diagnostic.message,
                { kind: "action", id: a.id },
            );
        }
    }
    for ( const c of conditions ) {
        if ( c.wrap != null && !isPositiveInt( c.wrap ) ) {
            const diagnostic = invalidWidthDiagnostic( "Condition WIDTH (wrap)", c.wrap );
            push(
                diagnostic.kind,
                diagnostic.code,
                diagnostic.message,
                { kind: "condition", id: c.id },
            );
        }
    }

    for ( const n of nodes ) {
        const uiId = uiIdByNodeId.get( n.id ) ?? String( n.id );

        if ( !/^\d+$/.test( uiId ) ) {
            const diagnostic = invalidUiIdDiagnostic( uiId );
            push(
                diagnostic.kind,
                diagnostic.code,
                diagnostic.message,
                { kind: "node", id: n.id },
            );
            continue;
        }

        if ( hasLeadingZeroUIID( uiId ) ) {
            push(
                "error",
                "invalid-uiid",
                leadingZeroUIIDMessage( uiId ),
                { kind: "node", id: n.id },
            );
        }
    }

    // --- Title consistency per UIID and uniqueness of normalized title ---
    const titleNormByUiId = new Map<string, string>();
    const exampleTitleByUiId = new Map<string, string>();
    const uiIdByTitleNorm = new Map<string, string>();

    for ( const n of nodes ) {
        const uiId = uiIdByNodeId.get( n.id ) ?? String( n.id );
        const rawTitle = ( n.title ?? "" ).toString();
        const tn = normalizeText( rawTitle );

        if ( !titleNormByUiId.has( uiId ) ) {
            titleNormByUiId.set( uiId, tn );
            exampleTitleByUiId.set( uiId, rawTitle );
        } else {
            const prev = titleNormByUiId.get( uiId )!;
            if ( prev !== tn ) {
                const prevTitle = exampleTitleByUiId.get( uiId ) ?? prev;
                push(
                    "error",
                    "inconsistent-ui-title",
                    `Inconsistency: UIID ${uiId} appears with different titles ("${prevTitle}" vs "${rawTitle}").`,
                    { kind: "node", id: n.id },
                );
            }
        }

        if ( tn.length > 0 ) {
            const seenUiId = uiIdByTitleNorm.get( tn );
            if ( seenUiId == null ) {
                uiIdByTitleNorm.set( tn, uiId );
            } else if ( seenUiId !== uiId ) {
                push(
                    "error",
                    "ambiguous-ui-title",
                    `Ambiguity: UIIDs ${seenUiId} and ${uiId} share the same normalized title ("${rawTitle}").`,
                    { kind: "node", id: n.id },
                );
            }
        }
    }
    // --- Representative node per UIID (for attaching refs to UI-level issues) ---
    const representativeNodeByUiId = new Map<string, NodeId>();
    for ( const n of nodes ) {
        const uiId = uiIdByNodeId.get( n.id ) ?? String( n.id );
        if ( !representativeNodeByUiId.has( uiId ) ) {
            representativeNodeByUiId.set( uiId, n.id );
        }
    }


    // --- Action indexes: by node, and grouped by (fragment, UIID) ---

    // (lo dejamos por si quieres usarlo en otro sitio)
    const actionsFromNode = new Map<NodeId, ActionLabel[]>();
    for ( const a of actions ) {
        if ( !actionsFromNode.has( a.originNodeId ) ) {
            actionsFromNode.set( a.originNodeId, [] );
        }
        actionsFromNode.get( a.originNodeId )!.push( a );
    }

    type FragUiKey = string; // `${fragId}::${uiId}`

    // Acciones agrupadas por (fragmento, UIID)
    const actionsByFragUiId = new Map<FragUiKey, ActionLabel[]>();

    for ( const a of actions ) {
        const fragId = fragOfAction( a.id );
        const uiId = uiIdByNodeId.get( a.originNodeId ) ?? String( a.originNodeId );
        const key: FragUiKey = `${fragId}::${uiId}`;
        if ( !actionsByFragUiId.has( key ) ) actionsByFragUiId.set( key, [] );
        actionsByFragUiId.get( key )!.push( a );
    }

    // --- Duplicated actions within same fragment + UIID ---
    for ( const [ key, list ] of actionsByFragUiId.entries() ) {
        const [ fragId, uiId ] = key.split( "::" );
        const seen = new Map<string, ActionId>();
        for ( const a of list ) {
            const k = `${a.verb}::${a.complement}`;
            if ( !seen.has( k ) ) {
                seen.set( k, a.id );
            } else {
                const firstId = seen.get( k )!;
                push(
                    "error",
                    "duplicate-action-in-ui",
                    `Duplicated action in fragment "${fragmentTitleOf( fragId ) ?? "Unknown fragment"}", ${uiLabel( uiId )}: ${a.verb} "${a.complement}".`,
                    { kind: "action", id: a.id },
                );
                push(
                    "error",
                    "duplicate-action-in-ui",
                    `Duplicated action in fragment "${fragmentTitleOf( fragId ) ?? "Unknown fragment"}", ${uiLabel( uiId )}: ${a.verb} "${a.complement}" (first occurrence).`,
                    { kind: "action", id: firstId },
                );
            }
        }
    }

    // --- Inclusion: duplicated actions between container and contained UIs (per fragment) ---
    const containsPairsByFrag = new Set<string>(); // `${fragId}::AUIID->BUIID`
    for ( const child of nodes ) {
        if ( child.parentId == null ) continue;
        const parent = nodeById.get( child.parentId );
        if ( !parent ) continue;
        const fragId = fragOfNode( child.id );
        const aUi = uiIdByNodeId.get( parent.id ) ?? String( parent.id );
        const bUi = uiIdByNodeId.get( child.id ) ?? String( child.id );
        containsPairsByFrag.add( `${fragId}::${aUi}->${bUi}` );
    }

    // Conjuntos de acciones por (fragmento, UIID)
    const actionSetByFragUiId = new Map<FragUiKey, Set<string>>();
    for ( const [ key, list ] of actionsByFragUiId.entries() ) {
        const s = new Set<string>();
        for ( const a of list ) {
            s.add( `${a.verb}::${a.complement}` );
        }
        actionSetByFragUiId.set( key, s );
    }

    for ( const pair of containsPairsByFrag ) {
        const [ fragId, rest ] = pair.split( "::" );
        const [ aUi, bUi ] = rest.split( "->" );
        const sa = actionSetByFragUiId.get( `${fragId}::${aUi}` );
        const sb = actionSetByFragUiId.get( `${fragId}::${bUi}` );
        if ( !sa || !sb ) continue;
        for ( const k of sa ) {
            if ( sb.has( k ) ) {
                const [ verb, complement ] = k.split( "::" );
                push(
                    "error",
                    "duplicate-action-by-inclusion",
                    `Duplicated action by inclusion in fragment "${fragmentTitleOf( fragId ) ?? "Unknown fragment"}": ${uiLabel( aUi )} (container) and ${uiLabel( bUi )} (contained) share ${verb} "${complement}".`,
                );
            }
        }
    }

    // --- Integrity: action ownership ---
    for ( const a of actions ) {
        const incoming = edgesByTo.get( `action:${a.id}` ) ?? [];
        const owners = incoming.filter( e => e.from.kind === "node" );
        if ( owners.length !== 1 ) {
            push(
                "error",
                "action-owner-invalid",
                `Action ${a.id} must have exactly 1 edge from its origin UI (node → action). Found: ${owners.length}.`,
                { kind: "action", id: a.id },
            );
        } else {
            const ownerNodeId = owners[ 0 ].from.id as NodeId;
            if ( ownerNodeId !== a.originNodeId ) {
                push(
                    "error",
                    "action-owner-mismatch",
                    `Action ${a.id} has originNodeId=${a.originNodeId}, but the node→action edge comes from node ${ownerNodeId}.`,
                    { kind: "action", id: a.id },
                );
            }
        }
    }

    // --- Integrity: condition ownership ---
    for ( const c of conditions ) {
        const incoming = edgesByTo.get( `condition:${c.id}` ) ?? [];
        const owners = incoming.filter( e => e.from.kind === "action" );
        if ( owners.length !== 1 ) {
            push(
                "error",
                "condition-owner-invalid",
                `Condition ${c.id} must have exactly 1 edge from its origin action (action → condition). Found: ${owners.length}.`,
                { kind: "condition", id: c.id },
            );
        } else {
            const ownerActionId = owners[ 0 ].from.id as ActionId;
            if ( ownerActionId !== c.originActionId ) {
                push(
                    "error",
                    "condition-owner-mismatch",
                    `Condition ${c.id} has originActionId=${c.originActionId}, but the action→condition edge comes from action ${ownerActionId}.`,
                    { kind: "condition", id: c.id },
                );
            }
        }
    }

    // --- Enumerate transitions from the graph ---
    const transitions: Transition[] = [];

    for ( const a of actions ) {
        const fragId = fragOfAction( a.id );
        const out = edgesByFrom.get( `action:${a.id}` ) ?? [];
        const toNodes = out.filter( e => e.to.kind === "node" );
        const toConds = out.filter( e => e.to.kind === "condition" );

        // action -> node (no condition)
        for ( const e of toNodes ) {
            transitions.push( {
                fragmentId: fragId,
                fromNodeId: a.originNodeId,
                toNodeId: e.to.id as NodeId,
                verb: a.verb,
                complement: a.complement,
                condRaw: null,
                condNorm: null,
                viaActionId: a.id,
                viaCondId: null,
            } );
        }

        // action -> condition -> node(s)
        for ( const e of toConds ) {
            const condId = e.to.id as ConditionId;
            const cond = condById.get( condId );
            const condRaw = ( cond?.title ?? "" ).toString();
            const condNorm = normalizeCondition( condRaw );

            const outCond = edgesByFrom.get( `condition:${condId}` ) ?? [];
            const condToNodes = outCond.filter( x => x.to.kind === "node" );

            for ( const e2 of condToNodes ) {
                transitions.push( {
                    fragmentId: fragId,
                    fromNodeId: a.originNodeId,
                    toNodeId: e2.to.id as NodeId,
                    verb: a.verb,
                    complement: a.complement,
                    condRaw,
                    condNorm,
                    viaActionId: a.id,
                    viaCondId: condId,
                } );
            }
        }
    }

    // --- Mixed conditional / non-conditional use across fragments ---
    // Para una misma UIID + acción (verb+complement), detecta cuando:
    // - en algún fragmento la acción tiene condición(es)
    // - y en otro fragmento distinto va directa (sin condición) al destino.
    type CondProfile = {
        directFrags: Set<string>;
        condFrags: Set<string>;
    };

    const condProfileByActionKey = new Map<string, CondProfile>();

    for ( const t of transitions ) {
        const uiIdFrom = uiIdByNodeId.get( t.fromNodeId ) ?? String( t.fromNodeId );
        const baseKey = `${uiIdFrom}::${t.verb}::${t.complement}`;
        let profile = condProfileByActionKey.get( baseKey );
        if ( !profile ) {
            profile = { directFrags: new Set<string>(), condFrags: new Set<string>() };
            condProfileByActionKey.set( baseKey, profile );
        }

        if ( t.condNorm == null ) {
            profile.directFrags.add( t.fragmentId );
        } else {
            profile.condFrags.add( t.fragmentId );
        }
    }

    for ( const [ key, profile ] of condProfileByActionKey.entries() ) {
        const { directFrags, condFrags } = profile;
        if ( condFrags.size === 0 ) continue;

        if ( directFrags.size === 0 ) continue;

        const [ uiId, verb, complement ] = key.split( "::" );
        const repNodeId = representativeNodeByUiId.get( uiId );
        const diagnostic = mixedConditionalTransitionDiagnostic( uiId, verb, complement );

        push(
            diagnostic.kind,
            diagnostic.code,
            diagnostic.message,
            repNodeId !== undefined ? { kind: "node", id: repNodeId } : undefined,
        );
    }

    // --- Declared action must be used ---
    for ( const a of actions ) {
        const used = transitions.some( t => t.viaActionId === a.id );
        if ( !used ) {
            const uiId = uiIdByNodeId.get( a.originNodeId ) ?? String( a.originNodeId );
            const diagnostic = unusedActionDiagnostic( uiId, a.verb, a.complement );
            push(
                diagnostic.kind,
                diagnostic.code,
                diagnostic.message,
                { kind: "action", id: a.id },
            );
        }
    }

    // --- UI containment graph by UIID (parent UIID -> child UIID) ---
    const childrenByUiId = new Map<string, Set<string>>();
    const parentsByUiId = new Map<string, Set<string>>();
    for ( const child of nodes ) {
        if ( child.parentId == null ) continue;
        const parent = nodeById.get( child.parentId );
        if ( !parent ) continue;
        const parentUiId = uiIdByNodeId.get( parent.id ) ?? String( parent.id );
        const childUiId = uiIdByNodeId.get( child.id ) ?? String( child.id );
        if ( parentUiId === childUiId ) continue;

        if ( !childrenByUiId.has( parentUiId ) ) childrenByUiId.set( parentUiId, new Set<string>() );
        childrenByUiId.get( parentUiId )!.add( childUiId );

        if ( !parentsByUiId.has( childUiId ) ) parentsByUiId.set( childUiId, new Set<string>() );
        parentsByUiId.get( childUiId )!.add( parentUiId );
    }

    const descendantsCache = new Map<string, Set<string>>();
    const ancestorsCache = new Map<string, Set<string>>();

    const getDescendantsInclusive = ( uiId: string ): Set<string> => {
        if ( descendantsCache.has( uiId ) ) return descendantsCache.get( uiId )!;
        const visited = new Set<string>( [ uiId ] );
        const stack = [ uiId ];
        while ( stack.length > 0 ) {
            const current = stack.pop()!;
            for ( const childUiId of childrenByUiId.get( current ) ?? [] ) {
                if ( visited.has( childUiId ) ) continue;
                visited.add( childUiId );
                stack.push( childUiId );
            }
        }
        descendantsCache.set( uiId, visited );
        return visited;
    };

    const getAncestorsInclusive = ( uiId: string ): Set<string> => {
        if ( ancestorsCache.has( uiId ) ) return ancestorsCache.get( uiId )!;
        const visited = new Set<string>( [ uiId ] );
        const stack = [ uiId ];
        while ( stack.length > 0 ) {
            const current = stack.pop()!;
            for ( const parentUiId of parentsByUiId.get( current ) ?? [] ) {
                if ( visited.has( parentUiId ) ) continue;
                visited.add( parentUiId );
                stack.push( parentUiId );
            }
        }
        ancestorsCache.set( uiId, visited );
        return visited;
    };

    // --- UI coverage: each UI must have outgoing transitions (direct or via contained UIs) ---
    const hasDirectOutgoingByUiId = new Map<string, boolean>();
    for ( const n of nodes ) {
        const uiId = uiIdByNodeId.get( n.id ) ?? String( n.id );
        if ( !hasDirectOutgoingByUiId.has( uiId ) ) hasDirectOutgoingByUiId.set( uiId, false );
    }
    for ( const t of transitions ) {
        const uiId = uiIdByNodeId.get( t.fromNodeId ) ?? String( t.fromNodeId );
        hasDirectOutgoingByUiId.set( uiId, true );
    }
    for ( const uiId of hasDirectOutgoingByUiId.keys() ) {
        const hasEffectiveOutgoing = Array.from( getDescendantsInclusive( uiId ) )
            .some( descUiId => hasDirectOutgoingByUiId.get( descUiId ) === true );
        if ( !hasEffectiveOutgoing ) {
            const nodeId = representativeNodeByUiId.get( uiId );
            const diagnostic = uiNoEffectiveOutgoingDiagnostic( uiId );
            push(
                diagnostic.kind,
                diagnostic.code,
                diagnostic.message,
                nodeId !== undefined ? { kind: "node", id: nodeId } : undefined
            );
        }
    }

    // --- UI coverage: reachability (must have incoming transitions, direct or via containing UIs) ---
    const hasDirectIncomingByUiId = new Map<string, boolean>();
    for ( const n of nodes ) {
        const uiId = uiIdByNodeId.get( n.id ) ?? String( n.id );
        if ( !hasDirectIncomingByUiId.has( uiId ) ) hasDirectIncomingByUiId.set( uiId, false );
    }
    for ( const t of transitions ) {
        const uiId = uiIdByNodeId.get( t.toNodeId ) ?? String( t.toNodeId );
        hasDirectIncomingByUiId.set( uiId, true );
    }
    for ( const uiId of hasDirectIncomingByUiId.keys() ) {
        const hasEffectiveIncoming = Array.from( getAncestorsInclusive( uiId ) )
            .some( ancUiId => hasDirectIncomingByUiId.get( ancUiId ) === true );
        if ( !hasEffectiveIncoming ) {
            // downgraded to warning
            const nodeId = representativeNodeByUiId.get( uiId );
            push(
                "warning",
                "ui-unreachable",
                `${uiLabel( uiId )} is unreachable: it has no incoming transitions, neither direct nor via containing UIs.`,
                nodeId !== undefined ? { kind: "node", id: nodeId } : undefined
            );
        }
    }

    // --- Duplicated transitions ---
    const dupKey = ( t: Transition ): string => {
        const uiIdFrom = uiIdByNodeId.get( t.fromNodeId ) ?? String( t.fromNodeId );
        const uiIdTo = uiIdByNodeId.get( t.toNodeId ) ?? String( t.toNodeId );
        const cond = t.condNorm ?? "";
        return `${t.fragmentId}::${uiIdFrom}::${t.verb}::${t.complement}::${cond}::${uiIdTo}`;
    };
    const firstSeen = new Map<string, Transition>();

    for ( const t of transitions ) {
        const k = dupKey( t );
        if ( !firstSeen.has( k ) ) {
            firstSeen.set( k, t );
        } else {
            const fromUiId = uiIdByNodeId.get( t.fromNodeId ) ?? String( t.fromNodeId );
            const toUiId = uiIdByNodeId.get( t.toNodeId ) ?? String( t.toNodeId );
            const diagnostic = duplicateTransitionDiagnostic(
                fromUiId,
                toUiId,
                t.verb,
                t.complement,
                t.condRaw
            );
            push(
                diagnostic.kind,
                diagnostic.code,
                diagnostic.message,
                { kind: "node", id: t.fromNodeId },
            );
        }
    }

    // --- Conflict: same action+condition with different semantic destinations (global por UIID) ---
    const conflictKey = ( t: Transition ): string => {
        const uiIdFrom = uiIdByNodeId.get( t.fromNodeId ) ?? String( t.fromNodeId );
        const cond = t.condNorm ?? "";
        return `${uiIdFrom}::${t.verb}::${t.complement}::${cond}`;
    };

    const destByKey = new Map<string, Set<string>>();

    for ( const t of transitions ) {
        const k = conflictKey( t );
        const uiIdTo = uiIdByNodeId.get( t.toNodeId ) ?? String( t.toNodeId );
        if ( !destByKey.has( k ) ) destByKey.set( k, new Set<string>() );
        destByKey.get( k )!.add( uiIdTo );
    }

    for ( const [ k, dests ] of destByKey.entries() ) {
        if ( dests.size > 1 ) {
            const [ uiId, verb, complement, cond ] = k.split( "::" );
            const repNodeId = representativeNodeByUiId.get( uiId ) ?? undefined;
            const diagnostic = multipleTransitionDestinationsDiagnostic(
                uiId,
                verb,
                complement,
                cond || null
            );

            push(
                diagnostic.kind,
                diagnostic.code,
                diagnostic.message,
                repNodeId !== undefined ? { kind: "node", id: repNodeId } : undefined,
            );
        }
    }

    return issues;
}
