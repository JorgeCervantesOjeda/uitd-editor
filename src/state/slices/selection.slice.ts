// src/state/slices/selection.slice.ts
import type {
    AppState,
    ActionId,
    ConditionId,
    DiagramFocusDirection,
    DiagramFocusTarget,
    NodeId,
} from "../types";
import {
    computeSelectionIntersectingRect,    getActionRect,
    getConditionRect,
    getNodeRect,
    type SelectionRect,
} from "../selectionRect";

type SetState = ( partial: Partial<AppState> | ( ( s: AppState ) => Partial<AppState> ) ) => void;

type FocusableItem = NonNullable<DiagramFocusTarget> & {
    x: number;
    y: number;
};

const KEYBOARD_MARQUEE_STEP = 48;

function sameTarget( a: DiagramFocusTarget, b: DiagramFocusTarget ) {
    if ( a == null || b == null ) return a == null && b == null;
    return a.kind === b.kind && a.id === b.id;
}

export const selectionSlice = ( set: SetState, get: () => AppState ) => {
    const buildByParent = () => {
        const nodes = get().nodes;
        const byParent = new Map<number, number[]>();
        for ( const n of nodes ) {
            const p = n.parentId ?? null;
            if ( p == null ) continue;
            if ( !byParent.has( p ) ) byParent.set( p, [] );
            byParent.get( p )!.push( n.id );
        }
        return byParent;
    };

    const descendantsOf = ( id: NodeId ) => {
        const byParent = buildByParent();
        const out: number[] = [];
        const stack = [ id ];
        const seen = new Set<NodeId>();
        while ( stack.length ) {
            const cur = stack.pop()! as NodeId;
            if ( seen.has( cur ) ) continue;
            seen.add( cur );
            const kids = byParent.get( cur ) ?? [];
            for ( const k of kids ) {
                out.push( k );
                stack.push( k as NodeId );
            }
        }
        return out;
    };

    const addWithDescendants = ( base: Set<NodeId>, id: NodeId ) => {
        const next = new Set( base );
        next.add( id );
        for ( const d of descendantsOf( id ) ) next.add( d as NodeId );
        return next;
    };

    const removeWithDescendants = ( base: Set<NodeId>, id: NodeId ) => {
        const next = new Set( base );
        next.delete( id );
        for ( const d of descendantsOf( id ) ) next.delete( d as NodeId );
        return next;
    };

    const buildFocusableItems = (): FocusableItem[] => {
        const state = get();
        return [
            ...state.nodes.map( ( n ) => ( { kind: "node" as const, id: n.id, x: n.x, y: n.y } ) ),
            ...state.actions.map( ( a ) => ( { kind: "action" as const, id: a.id, x: a.x, y: a.y } ) ),
            ...state.conditions.map( ( c ) => ( { kind: "condition" as const, id: c.id, x: c.x, y: c.y } ) ),
        ];
    };

    const findFocusableItem = ( target: DiagramFocusTarget ): FocusableItem | null => {
        if ( target == null ) return null;
        return buildFocusableItems().find( ( item ) => sameTarget( item, target ) ) ?? null;
    };

    const getFirstSelectedTarget = (): DiagramFocusTarget => {
        const state = get();

        if ( state.selectionConds.size > 0 ) {
            const conds = state.conditions
                .filter( ( c ) => state.selectionConds.has( c.id ) )
                .sort( ( a, b ) => a.y - b.y || a.x - b.x );
            return conds[ 0 ] ? { kind: "condition", id: conds[ 0 ].id } : null;
        }

        if ( state.selectionActions.size > 0 ) {
            const actions = state.actions
                .filter( ( a ) => state.selectionActions.has( a.id ) )
                .sort( ( a, b ) => a.y - b.y || a.x - b.x );
            return actions[ 0 ] ? { kind: "action", id: actions[ 0 ].id } : null;
        }

        if ( state.selection.size > 0 ) {
            const nodes = state.nodes
                .filter( ( n ) => state.selection.has( n.id ) )
                .sort( ( a, b ) => a.y - b.y || a.x - b.x );
            return nodes[ 0 ] ? { kind: "node", id: nodes[ 0 ].id } : null;
        }

        return null;
    };

    const getFallbackFocusTarget = (): DiagramFocusTarget => {
        const selected = getFirstSelectedTarget();
        if ( selected ) return selected;

        const items = buildFocusableItems().sort( ( a, b ) => a.y - b.y || a.x - b.x );
        return items[ 0 ] ? { kind: items[ 0 ].kind, id: items[ 0 ].id } : null;
    };

    const rootOf = ( id: NodeId ): NodeId => {
        const nodes = get().nodes;
        const byId = new Map<NodeId, { id: NodeId; parentId?: NodeId | null }>( nodes.map( n => [ n.id, n ] ) );
        let cur: NodeId = id;
        const seen = new Set<NodeId>();
        while ( true ) {
            if ( seen.has( cur ) ) break;
            seen.add( cur );
            const p = byId.get( cur )?.parentId ?? null;
            if ( p == null ) return cur;
            cur = p as NodeId;
        }
        return cur;
    };

    const pickNearestInDirection = ( current: FocusableItem, direction: DiagramFocusDirection ): NonNullable<DiagramFocusTarget> => {
        const items = buildFocusableItems();
        let winner: FocusableItem | null = null;
        let bestSecondaryOffset = Number.POSITIVE_INFINITY;
        let bestPrimaryDistance = Number.POSITIVE_INFINITY;
        let bestDistance = Number.POSITIVE_INFINITY;

        for ( const candidate of items ) {
            if ( sameTarget( candidate, current ) ) continue;

            const dx = candidate.x - current.x;
            const dy = candidate.y - current.y;
            const primary = direction === "left" || direction === "right" ? dx : dy;
            const secondary = direction === "left" || direction === "right" ? dy : dx;
            const signedPrimary =
                direction === "left" || direction === "up"
                    ? -primary
                    : primary;

            if ( signedPrimary <= 0 ) continue;

            const secondaryOffset = Math.abs( secondary );
            const euclidean = Math.hypot( dx, dy );
            const isBetterAxisAlignment = secondaryOffset < bestSecondaryOffset - 1e-6;
            const sameAxisAlignment = Math.abs( secondaryOffset - bestSecondaryOffset ) <= 1e-6;
            const isCloserForward = signedPrimary < bestPrimaryDistance - 1e-6;
            const sameForwardDistance = Math.abs( signedPrimary - bestPrimaryDistance ) <= 1e-6;

            if (
                isBetterAxisAlignment
                || ( sameAxisAlignment && isCloserForward )
                || ( sameAxisAlignment && sameForwardDistance && euclidean < bestDistance )
            ) {
                bestSecondaryOffset = secondaryOffset;
                bestPrimaryDistance = signedPrimary;
                bestDistance = euclidean;
                winner = candidate;
            }
        }

        return winner ? { kind: winner.kind, id: winner.id } : { kind: current.kind, id: current.id };
    };

    const getCurrentFocusableItem = () =>
        findFocusableItem( get().focusTarget )
        ?? findFocusableItem( getFirstSelectedTarget() )
        ?? findFocusableItem( getFallbackFocusTarget() );

    const getRectForTarget = ( target: NonNullable<DiagramFocusTarget> ): SelectionRect | null => {
        const state = get();
        if ( target.kind === "node" ) {
            const node = state.nodes.find( ( n ) => n.id === target.id );
            return node ? getNodeRect( node ) : null;
        }
        if ( target.kind === "action" ) {
            const action = state.actions.find( ( a ) => a.id === target.id );
            return action ? getActionRect( action ) : null;
        }
        const condition = state.conditions.find( ( c ) => c.id === target.id );
        return condition ? getConditionRect( condition ) : null;
    };

    const applyDirectionalSelection = ( nextTarget: NonNullable<DiagramFocusTarget> ) => {
        if ( nextTarget.kind === "node" ) {
            set( {
                focusTarget: nextTarget,
                keyboardMarquee: null,
                marqueeSeed: null,
                selection: addWithDescendants( new Set<NodeId>(), nextTarget.id ),
                selectionActions: new Set<ActionId>(),
                selectionConds: new Set<ConditionId>(),
            } );
            return;
        }

        if ( nextTarget.kind === "action" ) {
            set( {
                focusTarget: nextTarget,
                keyboardMarquee: null,
                marqueeSeed: null,
                selection: new Set<NodeId>(),
                selectionActions: new Set<ActionId>( [ nextTarget.id ] ),
                selectionConds: new Set<ConditionId>(),
            } );
            return;
        }

        set( {
            focusTarget: nextTarget,
            keyboardMarquee: null,
            marqueeSeed: null,
            selection: new Set<NodeId>(),
            selectionActions: new Set<ActionId>(),
            selectionConds: new Set<ConditionId>( [ nextTarget.id ] ),
        } );
    };

    const restoreSelectionFromTarget = ( target: NonNullable<DiagramFocusTarget> ) => {
        if ( target.kind === "node" ) {
            set( {
                focusTarget: target,
                keyboardMarquee: null,
                marqueeSeed: null,
                selection: addWithDescendants( new Set<NodeId>(), target.id ),
                selectionActions: new Set<ActionId>(),
                selectionConds: new Set<ConditionId>(),
            } );
            return;
        }

        if ( target.kind === "action" ) {
            set( {
                focusTarget: target,
                keyboardMarquee: null,
                marqueeSeed: null,
                selection: new Set<NodeId>(),
                selectionActions: new Set<ActionId>( [ target.id ] ),
                selectionConds: new Set<ConditionId>(),
            } );
            return;
        }

        set( {
            focusTarget: target,
            keyboardMarquee: null,
            marqueeSeed: null,
            selection: new Set<NodeId>(),
            selectionActions: new Set<ActionId>(),
            selectionConds: new Set<ConditionId>( [ target.id ] ),
        } );
    };

    return {
        clearSelection: () =>
            set( {
                selection: new Set<NodeId>(),
                selectionActions: new Set<ActionId>(),
                selectionConds: new Set<ConditionId>(),
                focusTarget: null,
                keyboardMarquee: null,
                marqueeSeed: null,
            } ),

        setFocusTarget: ( target: DiagramFocusTarget ) => {
            const nextTarget = findFocusableItem( target );
            set( { focusTarget: nextTarget ? { kind: nextTarget.kind, id: nextTarget.id } : null } );
        },

        focusFirstDiagramItem: () => {
            const state = get();
            const existing = findFocusableItem( state.focusTarget );
            if ( existing ) {
                set( { focusTarget: { kind: existing.kind, id: existing.id } } );
                return;
            }

            set( { focusTarget: getFallbackFocusTarget() } );
        },

        moveFocusInDirection: ( direction: DiagramFocusDirection ) => {
            const current = getCurrentFocusableItem();
            if ( !current ) return;
            const nextTarget = pickNearestInDirection( current, direction );
            applyDirectionalSelection( nextTarget );
        },

        extendKeyboardMarquee: ( direction: DiagramFocusDirection ) => {
            const state = get();
            const seed = getCurrentFocusableItem();
            if ( !seed ) return;

            const baseRect = state.keyboardMarquee ?? getRectForTarget( seed );
            if ( !baseRect ) return;

            const nextRect = { ...baseRect };
            if ( direction === "left" ) {
                nextRect.x -= KEYBOARD_MARQUEE_STEP;
                nextRect.w += KEYBOARD_MARQUEE_STEP;
            } else if ( direction === "right" ) {
                nextRect.w += KEYBOARD_MARQUEE_STEP;
            } else if ( direction === "up" ) {
                nextRect.y -= KEYBOARD_MARQUEE_STEP;
                nextRect.h += KEYBOARD_MARQUEE_STEP;
            } else {
                nextRect.h += KEYBOARD_MARQUEE_STEP;
            }

            const selection = computeSelectionIntersectingRect( state.nodes, state.actions, state.conditions, nextRect );
            const seedTarget = state.keyboardMarquee?.seed ?? { kind: seed.kind, id: seed.id };

            set( {
                focusTarget: { kind: seed.kind, id: seed.id },
                keyboardMarquee: { ...selection.rect, seed: seedTarget },
                marqueeSeed: seedTarget,
                selection: selection.selection,
                selectionActions: selection.selectionActions,
                selectionConds: selection.selectionConds,
            } );
        },

        beginSelectionMarquee: () => set( { marqueeSeed: null, keyboardMarquee: null } ),

        cancelSelectionMarquee: () => {
            const seed = get().marqueeSeed;
            if ( seed ) {
                restoreSelectionFromTarget( seed );
                return;
            }
            set( { keyboardMarquee: null, marqueeSeed: null } );
        },

        cancelKeyboardMarquee: () => {
            const marquee = get().keyboardMarquee;
            if ( !marquee ) return;
            restoreSelectionFromTarget( marquee.seed );
        },

        clearKeyboardMarquee: () => set( { keyboardMarquee: null, marqueeSeed: null } ),

        selectSingleOrKeep: ( id: NodeId, keep: boolean ) => {
            const cur = get().selection ?? new Set<NodeId>();
            const next = keep
                ? addWithDescendants( cur, id )
                : addWithDescendants( new Set<NodeId>(), id );
            set( {
                selection: next,
                selectionActions: new Set<ActionId>(),
                selectionConds: new Set<ConditionId>(),
                focusTarget: { kind: "node", id },
                keyboardMarquee: null,
                marqueeSeed: null,
            } );
        },

        toggleSelect: ( id: NodeId ) => {
            const state = get();
            const cur = state.selection ?? new Set<NodeId>();
            const isRemoving = cur.has( id );
            const next = isRemoving
                ? removeWithDescendants( cur, id )
                : addWithDescendants( cur, id );
            const nextFocus = isRemoving && sameTarget( state.focusTarget, { kind: "node", id } )
                ? null
                : { kind: "node" as const, id };
            set( { selection: next, focusTarget: nextFocus, keyboardMarquee: null, marqueeSeed: null } );
        },

        selectSingleOrKeepAction: ( id: ActionId, keep: boolean ) => {
            const sel = new Set( get().selectionActions );
            if ( keep ) {
                sel.add( id );
                set( {
                    selectionActions: sel,
                    focusTarget: { kind: "action", id },
                    keyboardMarquee: null,
                    marqueeSeed: null,
                } );
                return;
            }
            sel.clear();
            sel.add( id );
            set( {
                selectionActions: sel,
                selection: new Set<NodeId>(),
                selectionConds: new Set<ConditionId>(),
                focusTarget: { kind: "action", id },
                keyboardMarquee: null,
                marqueeSeed: null,
            } );
        },

        toggleSelectAction: ( id: ActionId ) => {
            const state = get();
            const sel = new Set( state.selectionActions );
            const isRemoving = sel.has( id );
            if ( isRemoving ) sel.delete( id );
            else sel.add( id );
            const nextFocus = isRemoving && sameTarget( state.focusTarget, { kind: "action", id } )
                ? null
                : { kind: "action" as const, id };
            set( { selectionActions: sel, focusTarget: nextFocus, keyboardMarquee: null, marqueeSeed: null } );
        },

        selectSingleOrKeepCondition: ( id: ConditionId, keep: boolean ) => {
            const sel = new Set( get().selectionConds );
            if ( keep ) {
                sel.add( id );
                set( {
                    selectionConds: sel,
                    focusTarget: { kind: "condition", id },
                    keyboardMarquee: null,
                    marqueeSeed: null,
                } );
                return;
            }
            sel.clear();
            sel.add( id );
            set( {
                selectionConds: sel,
                selection: new Set<NodeId>(),
                selectionActions: new Set<ActionId>(),
                focusTarget: { kind: "condition", id },
                keyboardMarquee: null,
                marqueeSeed: null,
            } );
        },

        toggleSelectCondition: ( id: ConditionId ) => {
            const state = get();
            const sel = new Set( state.selectionConds );
            const isRemoving = sel.has( id );
            if ( isRemoving ) sel.delete( id );
            else sel.add( id );
            const nextFocus = isRemoving && sameTarget( state.focusTarget, { kind: "condition", id } )
                ? null
                : { kind: "condition" as const, id };
            set( { selectionConds: sel, focusTarget: nextFocus, keyboardMarquee: null, marqueeSeed: null } );
        },

        getSimulationSelectedNodes: () => {
            const sel = get().selection ?? new Set<NodeId>();
            if ( sel.size === 0 ) return new Set<NodeId>();

            const selectedRoots = new Set<NodeId>();
            for ( const id of sel ) {
                const r = rootOf( id );
                if ( sel.has( r ) ) selectedRoots.add( r );
            }
            if ( selectedRoots.size === 0 ) return new Set<NodeId>();

            const out = new Set<NodeId>();
            for ( const r of selectedRoots ) {
                out.add( r );
                for ( const d of descendantsOf( r ) ) out.add( d as NodeId );
            }
            return out;
        },
    } satisfies Partial<AppState>;
};

