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

export type Severity = "error" | "warning";

export type IssueRef =
    | { kind: "node"; id: NodeId }
    | { kind: "action"; id: ActionId }
    | { kind: "condition"; id: ConditionId };

export interface DiagramIssue {
    kind: Severity;
    code: string;
    message: string;
    ref?: IssueRef;
    fragmentId?: string;
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

// --- Simple Union-Find for connected components (fragments) ---
class UnionFind {
    private parent = new Map<string, string>();
    private rank = new Map<string, number>();

    add( x: string ) {
        if ( !this.parent.has( x ) ) {
            this.parent.set( x, x );
            this.rank.set( x, 0 );
        }
    }

    find( x: string ): string {
        if ( !this.parent.has( x ) ) {
            this.add( x );
            return x;
        }
        const p = this.parent.get( x )!;
        if ( p === x ) return x;
        const root = this.find( p );
        this.parent.set( x, root );
        return root;
    }

    union( a: string, b: string ) {
        this.add( a );
        this.add( b );
        let ra = this.find( a );
        let rb = this.find( b );
        if ( ra === rb ) return;
        const rka = this.rank.get( ra ) ?? 0;
        const rkb = this.rank.get( rb ) ?? 0;
        if ( rka < rkb ) {
            [ ra, rb ] = [ rb, ra ];
        }
        this.parent.set( rb, ra );
        if ( rka === rkb ) this.rank.set( ra, rka + 1 );
    }

    groups(): Map<string, string[]> {
        const out = new Map<string, string[]>();
        for ( const x of this.parent.keys() ) {
            const r = this.find( x );
            if ( !out.has( r ) ) out.set( r, [] );
            out.get( r )!.push( x );
        }
        return out;
    }
}

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
} ): DiagramIssue[] {
    const { nodes, actions, conditions, edges } = input;

    const issues: DiagramIssue[] = [];

    const nodeById = new Map<NodeId, NodeBox>();
    const actionById = new Map<ActionId, ActionLabel>();
    const condById = new Map<ConditionId, ConditionLabel>();

    for ( const n of nodes ) nodeById.set( n.id, n );
    for ( const a of actions ) actionById.set( a.id, a );
    for ( const c of conditions ) condById.set( c.id, c );

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

    // --- Build fragments as connected components (direction-agnostic) ---
    const uf = new UnionFind();

    // Register all elements
    for ( const n of nodes ) uf.add( `node:${n.id}` );
    for ( const a of actions ) uf.add( `action:${a.id}` );
    for ( const c of conditions ) uf.add( `condition:${c.id}` );

    // Edges
    for ( const e of edges ) uf.union( keyOf( e.from ), keyOf( e.to ) );

    // Nesting (parentId) → same fragment
    for ( const n of nodes ) {
        if ( n.parentId != null ) {
            uf.union( `node:${n.id}`, `node:${n.parentId}` );
        }
    }

    // Logical connections
    for ( const a of actions ) {
        uf.union( `action:${a.id}`, `node:${a.originNodeId}` );
    }
    for ( const c of conditions ) {
        uf.union( `condition:${c.id}`, `action:${c.originActionId}` );
    }

    const groups = uf.groups();
    const roots = Array.from( groups.keys() ).sort( ( a, b ) => a.localeCompare( b ) );

    const fragmentIdByKey = new Map<string, string>();
    roots.forEach( ( root, idx ) => {
        const fragId = `F${idx + 1}`;
        for ( const key of groups.get( root ) ?? [] ) {
            fragmentIdByKey.set( key, fragId );
        }
    } );

    const fragOfNode = ( id: NodeId ): string =>
        fragmentIdByKey.get( `node:${id}` ) ?? "F?";
    const fragOfAction = ( id: ActionId ): string =>
        fragmentIdByKey.get( `action:${id}` ) ?? "F?";
    const fragOfCondition = ( id: ConditionId ): string =>
        fragmentIdByKey.get( `condition:${id}` ) ?? "F?";

    const push = ( kind: Severity, code: string, message: string, ref?: IssueRef ) => {
        let fragmentId: string | undefined;
        if ( ref?.kind === "node" ) fragmentId = fragOfNode( ref.id );
        else if ( ref?.kind === "action" ) fragmentId = fragOfAction( ref.id );
        else if ( ref?.kind === "condition" ) fragmentId = fragOfCondition( ref.id );
        if ( !fragmentId ) fragmentId = "F?";
        issues.push( { kind, code, message, ref, fragmentId } );
    };

    // --- Nesting integrity: parentId must exist and must not form cycles ---
    for ( const n of nodes ) {
        if ( n.parentId != null && !nodeById.has( n.parentId ) ) {
            push(
                "error",
                "PARENT_DANGLING",
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
                        "PARENT_CYCLE",
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
                "EDGE_DANGLING",
                `Edge points to a non-existing node (id=${ep.id}).`,
            );
        }
        if ( ep.kind === "action" && !actionById.has( ep.id as ActionId ) ) {
            push(
                "error",
                "EDGE_DANGLING",
                `Edge points to a non-existing action (id=${ep.id}).`,
            );
        }
        if ( ep.kind === "condition" && !condById.has( ep.id as ConditionId ) ) {
            push(
                "error",
                "EDGE_DANGLING",
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
                "QS_INVALID",
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
                "QS_INVALID",
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
                "QS_INVALID",
                `Condition "${t}" is invalid: ${chk.why}.`,
                { kind: "condition", id: c.id },
            );
        }
    }

    // --- WIDTH / wrap: positive integer ---
    for ( const n of nodes ) {
        if ( n.wrap != null && !isPositiveInt( n.wrap ) ) {
            push(
                "error",
                "WIDTH_INVALID",
                "WIDTH (wrap) in UI is invalid: it must be a positive integer.",
                { kind: "node", id: n.id },
            );
        }
    }
    for ( const a of actions ) {
        if ( a.wrap != null && !isPositiveInt( a.wrap ) ) {
            push(
                "error",
                "WIDTH_INVALID",
                "WIDTH (wrap) in action is invalid: it must be a positive integer.",
                { kind: "action", id: a.id },
            );
        }
    }
    for ( const c of conditions ) {
        if ( c.wrap != null && !isPositiveInt( c.wrap ) ) {
            push(
                "error",
                "WIDTH_INVALID",
                "WIDTH (wrap) in condition is invalid: it must be a positive integer.",
                { kind: "condition", id: c.id },
            );
        }
    }

    // --- UIID (displayId) must be NUMBER and without spaces ---
    const uiIdByNodeId = new Map<NodeId, string>();

    for ( const n of nodes ) {
        const raw = ( n.displayId ?? "" ).toString().trim();
        const uiId = raw || String( n.id );
        uiIdByNodeId.set( n.id, uiId );

        if ( !/^\d+$/.test( uiId ) ) {
            push(
                "error",
                "UIID_INVALID",
                `Invalid UIID "${uiId}": it must contain digits only (NUMBER).`,
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
                    "UI_TITLE_INCONSISTENT",
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
                    "UI_TITLE_AMBIGUOUS",
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
                    "ACTION_DUPLICATE_IN_UI",
                    `Duplicated action in fragment ${fragId}, UIID ${uiId}: ${a.verb} "${a.complement}".`,
                    { kind: "action", id: a.id },
                );
                push(
                    "error",
                    "ACTION_DUPLICATE_IN_UI",
                    `Duplicated action in fragment ${fragId}, UIID ${uiId}: ${a.verb} "${a.complement}" (first occurrence).`,
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
                    "ACTION_DUPLICATE_BY_INCLUSION",
                    `Duplicated action by inclusion in fragment ${fragId}: UIID ${aUi} (container) and UIID ${bUi} (contained) share ${verb} "${complement}".`,
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
                "ACTION_OWNER_INVALID",
                `Action ${a.id} must have exactly 1 edge from its origin UI (node → action). Found: ${owners.length}.`,
                { kind: "action", id: a.id },
            );
        } else {
            const ownerNodeId = owners[ 0 ].from.id as NodeId;
            if ( ownerNodeId !== a.originNodeId ) {
                push(
                    "error",
                    "ACTION_OWNER_MISMATCH",
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
                "COND_OWNER_INVALID",
                `Condition ${c.id} must have exactly 1 edge from its origin action (action → condition). Found: ${owners.length}.`,
                { kind: "condition", id: c.id },
            );
        } else {
            const ownerActionId = owners[ 0 ].from.id as ActionId;
            if ( ownerActionId !== c.originActionId ) {
                push(
                    "error",
                    "COND_OWNER_MISMATCH",
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

        // ¿Hay algún fragmento donde la acción vaya directa pero sin condiciones?
        const directOnlyFrags = Array.from( directFrags ).filter(
            f => !condFrags.has( f ),
        );
        if ( directOnlyFrags.length === 0 ) continue; // Solo mezcla dentro del mismo fragmento → permitido

        const [ uiId, verb, complement ] = key.split( "::" );
        const condFragList = Array.from( condFrags ).sort().join( ", " );
        const directFragList = directOnlyFrags.sort().join( ", " );
        const repNodeId = representativeNodeByUiId.get( uiId );

        push(
            "error",
            "ACTION_CONDITION_INCONSISTENT",
            `Inconsistent conditional use for UIID ${uiId}: action ${verb} "${complement}" is conditional in fragment(s) ${condFragList} and unconditional in fragment(s) ${directFragList}.`,
            repNodeId !== undefined ? { kind: "node", id: repNodeId } : undefined,
        );
    }

    // --- Declared action must be used ---
    for ( const a of actions ) {
        const used = transitions.some( t => t.viaActionId === a.id );
        if ( !used ) {
            push(
                "error",
                "ACTION_UNUSED",
                `Unused action: ${a.verb} "${a.complement}" does not trigger any transition.`,
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
            push(
                "error",
                "UI_NO_OUTGOING",
                `UIID ${uiId} has no outgoing transitions, neither direct nor via contained UIs (state with no exits).`,
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
                "UI_UNREACHABLE",
                `UIID ${uiId} is unreachable: it has no incoming transitions, neither direct nor via containing UIs.`,
                nodeId !== undefined ? { kind: "node", id: nodeId } : undefined
            );
        }
    }

    // --- Duplicated transitions ---
    // Clave global por UIID + acción + condición (ignora fragmentId y destino)
    const dupKey = ( t: Transition ): string => {
        const uiIdFrom = uiIdByNodeId.get( t.fromNodeId ) ?? String( t.fromNodeId );
        const cond = t.condNorm ?? "";
        return `${uiIdFrom}::${t.verb}::${t.complement}::${cond}`;
    };
    const firstSeen = new Map<string, Transition>();

    for ( const t of transitions ) {
        const k = dupKey( t );
        if ( !firstSeen.has( k ) ) {
            firstSeen.set( k, t );
        } else {
            const uiIdFrom = uiIdByNodeId.get( t.fromNodeId ) ?? String( t.fromNodeId );
            const condPart = t.condRaw ? ` AND "${t.condRaw}"` : "";
            push(
                "error",
                "TRANSITION_DUPLICATE",
                `Duplicated condition for UIID ${uiIdFrom}: action ${t.verb} "${t.complement}"${condPart}.`,
                { kind: "node", id: t.fromNodeId },
            );
        }
    }

    // --- Conflict: same action+condition with different destinations (global por UIID) ---
    const conflictKey = ( t: Transition ): string => {
        const uiIdFrom = uiIdByNodeId.get( t.fromNodeId ) ?? String( t.fromNodeId );
        const cond = t.condNorm ?? "";
        return `${uiIdFrom}::${t.verb}::${t.complement}::${cond}`;
    };

    const destByKey = new Map<string, Set<NodeId>>();

    for ( const t of transitions ) {
        const k = conflictKey( t );
        if ( !destByKey.has( k ) ) destByKey.set( k, new Set<NodeId>() );
        destByKey.get( k )!.add( t.toNodeId );
    }

    for ( const [ k, dests ] of destByKey.entries() ) {
        if ( dests.size > 1 ) {
            const [ uiId, verb, complement, cond ] = k.split( "::" );
            const condPart = cond ? ` AND "${cond}"` : "";
            const repNodeId = representativeNodeByUiId.get( uiId ) ?? undefined;

            push(
                "error",
                "TRANSITION_CONDITION_CONFLICT",
                `Conflict: UIID ${uiId} with action ${verb} "${complement}"${condPart} has multiple destinations (${Array.from(
                    dests,
                ).join( ", " )}).`,
                repNodeId !== undefined ? { kind: "node", id: repNodeId } : undefined,
            );
        }
    }

    return issues;
}
