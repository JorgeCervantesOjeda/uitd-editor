// src/state/newElementArrangement.test.ts
// Verifies exclusive selection when creating nodes, actions, and conditions.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAppStore } from "./store";

const initial = useAppStore.getState();

describe( "selection after element creation", () => {
    beforeEach( () => useAppStore.setState( {
        ...initial,
        nodes: [ { id: 1, title: "Existing", x: 0, y: 0 } ],
        actions: [ { id: 1, originNodeId: 1, title: "clicks X", verb: "clicks", complement: "X", x: 100, y: 100 } ],
        conditions: [ { id: 2, originActionId: 1, title: "Ready", x: 200, y: 100 } ],
        edges: [], nextId: 3, nextActionId: 2,
        selection: new Set( [ 1 ] ), selectionActions: new Set( [ 1 ] ), selectionConds: new Set( [ 2 ] ),
    }, true ) );
    afterEach( () => useAppStore.setState( initial, true ) );

    it.each( [ "node", "action", "condition" ] as const )( "selects only a newly created %s", kind => {
        const state = useAppStore.getState();
        if ( kind === "node" ) state.createNodeAt( 20, 20 );
        if ( kind === "action" ) state.addActionForNode( 1 );
        if ( kind === "condition" ) state.handleCreateCondition( 1 );
        const next = useAppStore.getState();
        expect( next.selection ).toEqual( new Set( kind === "node" ? [ 3 ] : [] ) );
        expect( next.selectionActions ).toEqual( new Set( kind === "action" ? [ 2 ] : [] ) );
        expect( next.selectionConds ).toEqual( new Set( kind === "condition" ? [ 3 ] : [] ) );
        expect( next.focusTarget ).toEqual( { kind, id: kind === "action" ? 2 : 3 } );
    } );

    it.each( [
        { random: 0, dx: 100, dy: 0 },
        { random: 0.25, dx: 0, dy: 100 },
        { random: 0.5, dx: -100, dy: 0 },
        { random: 0.75, dx: 0, dy: -100 },
    ] )( "places new elements at radius 100 for random value $random", ( { random, dx, dy } ) => {
        vi.spyOn( Math, "random" ).mockReturnValue( random );
        useAppStore.getState().addActionForNode( 1 );
        const action = useAppStore.getState().actions.find( a => a.id === 2 )!;
        expect( action.x ).toBeCloseTo( dx );
        expect( action.y ).toBeCloseTo( dy );
        expect( Math.hypot( action.x, action.y ) ).toBeCloseTo( 100 );

        useAppStore.getState().handleCreateCondition( 1 );
        const condition = useAppStore.getState().conditions.find( c => c.id === 3 )!;
        expect( condition.x ).toBeCloseTo( 100 + dx );
        expect( condition.y ).toBeCloseTo( 100 + dy );
        expect( Math.hypot( condition.x - 100, condition.y - 100 ) ).toBeCloseTo( 100 );
    } );

    it( "uses the same fixed radius when inserting a condition into a direct connection", () => {
        vi.spyOn( Math, "random" ).mockReturnValue( 0.125 );
        useAppStore.setState( {
            edges: [ { id: 1, from: { kind: "action", id: 1 }, to: { kind: "node", id: 1 }, style: "dashed1" } ],
            nextEdgeId: 2,
        } );
        useAppStore.getState().handleCreateCondition( 1 );
        const condition = useAppStore.getState().conditions.find( c => c.id === 3 )!;
        expect( Math.hypot( condition.x - 100, condition.y - 100 ) ).toBeCloseTo( 100 );
        expect( condition.x ).toBeCloseTo( 170.710678 );
        expect( condition.y ).toBeCloseTo( 170.710678 );
        expect( useAppStore.getState().edges ).toHaveLength( 2 );
    } );
} );
