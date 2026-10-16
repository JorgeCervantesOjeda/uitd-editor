// src/physics/force-simulator.ts
import type { RigidBodyInput } from "./rigidBlockBodies";

export type Vec2 = { x: number; y: number };

export type RepulsionKind = "ui" | "particle";

export type NodeInput = {
    id: string;
    base: Vec2;
    rootId?: string;
    repulsionKind?: RepulsionKind;
    collisionRadius?: number;
    collisionWidth?: number;
    collisionHeight?: number;
    repulsionCharge?: number;
    rigidBodyId?: string;
};

export type Edge = { from: string; to: string; restLength?: number; springK?: number };

export type SimulatorOptions = {
    springK?: number;
    equilibriumDist?: number;
    actionConditionEquilibriumDist?: number;
    actionConditionSpringK?: number;
    coulombC?: number;
    frictionGamma?: number;
    timeStep?: number;
    dtMin?: number;
    dtMax?: number;
    maxDisplacement?: number;
    threshHigh?: number;
    threshLow?: number;
    adjustPercent?: number;

    // Resortes dependientes del tamaño
    restLengthSizeFactor?: number;
    restLengthMinSize?: number;

    // Repulsión dependiente del tamaño
    repulsionSizeExponent?: number;
    // Multiplicador de Coulomb para pares UI–UI
    uiCoulombRepulsionFactor?: number;

    // Separación fuerte entre elementos de raíces visuales independientes
    independentRootCollisionK?: number;
    independentRootCollisionPadding?: number;
    maxRigidBlockOverlapForce?: number;
};

export type StepStats = {
    maxDisp: number;
    overlapDetected: boolean;
    overlapPairs: Array<{ firstId: string; secondId: string }>;
};

export class ForceSimulator {
    private nodes = new Map<string, NodeInput>();
    private edges: Edge[] = [];
    private opts: Required<SimulatorOptions>;
    private dt: number;

    // Dinámica por raíz (sólo NODOS)
    private nodeRoots = new Set<string>();
    private idToRoot = new Map<string, string>();
    private posByRoot = new Map<string, Vec2>();
    private velByRoot = new Map<string, Vec2>();

    // Dinámica por partícula (ACCIONES y CONDICIONES)
    private posById = new Map<string, Vec2>();
    private velById = new Map<string, Vec2>();
    private isParticle = new Set<string>(); // ids que NO van por raíz
    private rigidBodies = new Map<string, RigidBodyInput>();
    private idToRigidBody = new Map<string, string>();
    private isRigidMember = new Set<string>();
    private posByRigidBody = new Map<string, Vec2>();
    private velByRigidBody = new Map<string, Vec2>();
    private hasCompletedStep = false;

    // Filtro de movibles (anclaje del resto)
    private movable?: Set<string>;
    private movableRoots?: Set<string>;
    private movableRigidBodies?: Set<string>;

    // componente conexa por id (índice entero)
    private compById = new Map<string, number>();

    constructor(
        nodes: NodeInput[],
        edges: Edge[],
        opts: SimulatorOptions = {},
        movable?: Set<string>, // ids movibles (N./A./C.); undefined => todos movibles
        rigidBodies: RigidBodyInput[] = []
    ) {
        const d: Required<SimulatorOptions> = {
            springK: 1e-4,
            equilibriumDist: 140,
            actionConditionEquilibriumDist: 100,
            actionConditionSpringK: 0.1,
            coulombC: 1200,
            frictionGamma: 0.2,
            timeStep: 1,
            dtMin: 0.01,
            dtMax: 20,
            maxDisplacement: 50,
            threshHigh: 50,
            threshLow: 10,
            adjustPercent: 0.1,
            restLengthSizeFactor: 1,
            restLengthMinSize: 40,
            repulsionSizeExponent: 0.5,
            uiCoulombRepulsionFactor: 2,
            independentRootCollisionK: 0.45,
            independentRootCollisionPadding: 32,
            maxRigidBlockOverlapForce: 80,
        };
        this.opts = { ...d, ...( opts ?? {} ) };
        this.dt = this.opts.timeStep;

        // registrar nodos y aristas
        for ( const n of nodes ) this.nodes.set( n.id, n );
        this.edges = edges;

        // clasificar: si tiene rootId => va por raíz; si no => partícula
        for ( const n of nodes ) {
            if ( n.rigidBodyId ) {
                this.isRigidMember.add( n.id );
                this.idToRigidBody.set( n.id, n.rigidBodyId );
            } else if ( n.rootId ) {
                const r = n.rootId;
                this.idToRoot.set( n.id, r );
                this.nodeRoots.add( r );
            } else {
                this.isParticle.add( n.id );
                this.posById.set( n.id, { x: 0, y: 0 } );
                this.velById.set( n.id, { x: 0, y: 0 } );
            }
        }

        for ( const r of this.nodeRoots ) {
            this.posByRoot.set( r, { x: 0, y: 0 } );
            this.velByRoot.set( r, { x: 0, y: 0 } );
        }

        for ( const body of rigidBodies ) {
            this.rigidBodies.set( body.id, body );
            this.posByRigidBody.set( body.id, { x: 0, y: 0 } );
            this.velByRigidBody.set( body.id, { x: 0, y: 0 } );
            for ( const member of body.members ) this.idToRigidBody.set( member.id, body.id );
        }

        // Filtro de movibles / anclaje
        this.movable = movable;
        if ( this.movable ) {
            const roots = new Set<string>();
            const rigidBodies = new Set<string>();
            for ( const id of this.movable ) {
                if ( this.rigidBodies.has( id ) ) {
                    rigidBodies.add( id );
                    continue;
                }
                if ( this.isRigidMember.has( id ) ) {
                    const bodyId = this.idToRigidBody.get( id );
                    if ( bodyId ) rigidBodies.add( bodyId );
                    continue;
                }
                if ( this.isParticle.has( id ) ) continue; // partículas: se filtran por-id
                const r = this.idToRoot.get( id ) ?? id; // si ya es raíz, queda tal cual
                roots.add( r );
            }
            this.movableRoots = roots;
            this.movableRigidBodies = rigidBodies;
        }

        // calcular componentes conexas (no dirigidas)
        this.buildConnectedComponents();
    }

    // componentes conexas sobre el grafo no dirigido
    private buildConnectedComponents() {
        const adj = new Map<string, Set<string>>();
        const ensure = ( id: string ) => {
            if ( !adj.has( id ) ) adj.set( id, new Set<string>() );
        };

        for ( const id of this.nodes.keys() ) ensure( id );

        for ( const e of this.edges ) {
            ensure( e.from );
            ensure( e.to );
            adj.get( e.from )!.add( e.to );
            adj.get( e.to )!.add( e.from );
        }

        const compById = new Map<string, number>();
        let compIdx = 0;

        for ( const id of adj.keys() ) {
            if ( compById.has( id ) ) continue;
            compIdx++;
            const stack = [ id ];
            compById.set( id, compIdx );

            while ( stack.length ) {
                const u = stack.pop()!;
                for ( const v of adj.get( u )! ) {
                    if ( !compById.has( v ) ) {
                        compById.set( v, compIdx );
                        stack.push( v );
                    }
                }
            }
        }

        this.compById = compById;
    }

    private findIndependentRootOverlaps( ids: string[] ): Array<{ firstId: string; secondId: string }> {
        const overlaps: Array<{ firstId: string; secondId: string }> = [];
        const representativeByRoot = new Map<string, string>();
        for ( const id of ids ) {
            const root = this.effectiveRootOf( id );
            if ( root && !representativeByRoot.has( root ) ) representativeByRoot.set( root, id );
        }
        const roots = [ ...representativeByRoot.keys() ];

        for ( let i = 0; i < roots.length; i++ ) {
            for ( let j = i + 1; j < roots.length; j++ ) {
                const rootA = roots[ i ];
                const rootB = roots[ j ];
                const bodyA = this.rigidBodies.get( rootA );
                const bodyB = this.rigidBodies.get( rootB );
                if ( !bodyA && !bodyB ) continue;
                const representativeA = bodyA?.members[ 0 ]?.id ?? representativeByRoot.get( rootA )!;
                const representativeB = bodyB?.members[ 0 ]?.id ?? representativeByRoot.get( rootB )!;

                if ( bodyA && bodyB ) {
                    const displacementA = this.posByRigidBody.get( rootA )!;
                    const displacementB = this.posByRigidBody.get( rootB )!;
                    const centerA = { x: bodyA.center.x + displacementA.x, y: bodyA.center.y + displacementA.y };
                    const centerB = { x: bodyB.center.x + displacementB.x, y: bodyB.center.y + displacementB.y };
                    const overlapX = ( bodyA.width + bodyB.width ) / 2 - Math.abs( centerB.x - centerA.x );
                    const overlapY = ( bodyA.height + bodyB.height ) / 2 - Math.abs( centerB.y - centerA.y );
                    if ( overlapX > 0 && overlapY > 0 ) {
                        overlaps.push( { firstId: rootA, secondId: rootB } );
                    }
                    continue;
                }

                const body = ( bodyA ?? bodyB )!;
                const normalElementId = bodyA ? representativeB : representativeA;
                const normalElementRadius = this.nodes.get( normalElementId )?.collisionRadius ?? 0;
                if ( normalElementRadius <= 0 ) continue;

                const bodyDisplacement = this.posByRigidBody.get( body.id )!;
                const bodyCenter = {
                    x: body.center.x + bodyDisplacement.x,
                    y: body.center.y + bodyDisplacement.y,
                };
                const normalElement = this.nodes.get( normalElementId )!;
                const normalElementCenter = this.cur( normalElementId );
                const hasVisibleRectangle =
                    Number.isFinite( normalElement.collisionWidth ) && normalElement.collisionWidth! > 0 &&
                    Number.isFinite( normalElement.collisionHeight ) && normalElement.collisionHeight! > 0;
                const hasOverlap = hasVisibleRectangle
                    ? this.hasVisibleRectangleOverlap(
                        bodyCenter,
                        body.width,
                        body.height,
                        normalElementCenter,
                        normalElement.collisionWidth!,
                        normalElement.collisionHeight!
                    )
                    : this.hasVisibleRectangleCircleOverlap( bodyCenter, body.width, body.height, normalElementCenter, normalElementRadius );
                if ( hasOverlap ) {
                    overlaps.push( { firstId: rootA, secondId: rootB } );
                }
            }
        }

        return overlaps;
    }

    private captureDynamicState() {
        const copy = ( values: Map<string, Vec2> ) => new Map(
            [ ...values.entries() ].map( ( [ id, value ] ) => [ id, { ...value } ] as const )
        );
        return {
            posByRoot: copy( this.posByRoot ),
            velByRoot: copy( this.velByRoot ),
            posById: copy( this.posById ),
            velById: copy( this.velById ),
            posByRigidBody: copy( this.posByRigidBody ),
            velByRigidBody: copy( this.velByRigidBody ),
            dt: this.dt,
        };
    }

    private restoreDynamicState( state: ReturnType<ForceSimulator[ "captureDynamicState" ]> ) {
        this.posByRoot = state.posByRoot;
        this.velByRoot = state.velByRoot;
        this.posById = state.posById;
        this.velById = state.velById;
        this.posByRigidBody = state.posByRigidBody;
        this.velByRigidBody = state.velByRigidBody;
        this.dt = state.dt;
    }

    private cur( id: string ): Vec2 {
        const n = this.nodes.get( id );
        if ( !n ) throw new Error( `Unknown node id: ${id}` );

        if ( this.isRigidMember.has( id ) ) {
            const bodyId = this.idToRigidBody.get( id )!;
            const body = this.rigidBodies.get( bodyId )!;
            const offset = body.members.find( member => member.id === id )?.offset;
            const displacement = this.posByRigidBody.get( bodyId )!;
            if ( !offset ) throw new Error( `Unknown rigid body member id: ${id}` );
            return {
                x: body.center.x + offset.x + displacement.x,
                y: body.center.y + offset.y + displacement.y,
            };
        }

        if ( this.isParticle.has( id ) ) {
            const p = this.posById.get( id )!;
            return { x: n.base.x + p.x, y: n.base.y + p.y };
        }

        const r = this.idToRoot.get( id )!;
        const pr = this.posByRoot.get( r )!;
        return { x: n.base.x + pr.x, y: n.base.y + pr.y };
    }

    private effectiveRootOf( id: string ): string | null {
        if ( this.isRigidMember.has( id ) ) return this.idToRigidBody.get( id ) ?? null;
        if ( this.isParticle.has( id ) ) return id;
        return this.idToRoot.get( id ) ?? null;
    }

    private hasVisibleRectangleCircleOverlap(
        center: Vec2,
        width: number,
        height: number,
        point: Vec2,
        radius: number
    ): boolean {
        const halfWidth = width / 2;
        const halfHeight = height / 2;
        const closestX = Math.max( center.x - halfWidth, Math.min( point.x, center.x + halfWidth ) );
        const closestY = Math.max( center.y - halfHeight, Math.min( point.y, center.y + halfHeight ) );
        return Math.hypot( point.x - closestX, point.y - closestY ) < radius;
    }

    private hasVisibleRectangleOverlap(
        firstCenter: Vec2,
        firstWidth: number,
        firstHeight: number,
        secondCenter: Vec2,
        secondWidth: number,
        secondHeight: number
    ): boolean {
        return Math.abs( secondCenter.x - firstCenter.x ) < ( firstWidth + secondWidth ) / 2 &&
            Math.abs( secondCenter.y - firstCenter.y ) < ( firstHeight + secondHeight ) / 2;
    }

    private repulsionMultiplier( a: string, b: string ): number {
        const kindA = this.nodes.get( a )?.repulsionKind ?? ( this.nodes.get( a )?.rootId ? "ui" : "particle" );
        const kindB = this.nodes.get( b )?.repulsionKind ?? ( this.nodes.get( b )?.rootId ? "ui" : "particle" );
        if ( kindA !== "ui" || kindB !== "ui" ) return 1;
        const factor = this.opts.uiCoulombRepulsionFactor;
        return Number.isFinite( factor ) && factor >= 0 ? factor : 1;
    }

    step(): StepStats {
        const { springK, equilibriumDist, coulombC, frictionGamma } = this.opts;
        const previousState = this.captureDynamicState();
        const ids = [ ...this.nodes.keys() ];
        const initialOverlapPairs = this.findIndependentRootOverlaps( ids );
        if ( this.hasCompletedStep && initialOverlapPairs.length > 0 ) {
            return { maxDisp: 0, overlapDetected: true, overlapPairs: initialOverlapPairs };
        }

        // fuerzas por-id
        const force = new Map<string, Vec2>();
        for ( const id of this.nodes.keys() ) {
            force.set( id, { x: 0, y: 0 } );
        }

        // resortes (todas las aristas cuentan)
        for ( const e of this.edges ) {
            const p1 = this.cur( e.from );
            const p2 = this.cur( e.to );

            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const dist = Math.hypot( dx, dy ) || 1e-6;

            const restLength = e.restLength ?? equilibriumDist;
            const dif = dist - restLength;

            const fs = ( e.springK ?? springK ) * dif;
            const fx = ( fs * dx ) / dist;
            const fy = ( fs * dy ) / dist;

            const f1 = force.get( e.from )!;
            f1.x += fx;
            f1.y += fy;

            const f2 = force.get( e.to )!;
            f2.x -= fx;
            f2.y -= fy;
        }

        // repulsión O(N²) — SOLO dentro de la misma componente conexa
        for ( let i = 0; i < ids.length; i++ ) {
            for ( let j = i + 1; j < ids.length; j++ ) {
                const a = ids[ i ];
                const b = ids[ j ];

                if ( this.compById.get( a ) !== this.compById.get( b ) ) continue;

                const pa = this.cur( a );
                const pb = this.cur( b );
                const dx = pb.x - pa.x;
                const dy = pb.y - pa.y;

                // rompe simetrías exactas con un micro desplazamiento determinista
                let ddx = dx;
                let ddy = dy;
                if ( ddx === 0 && ddy === 0 ) {
                    const h = ( ( a.charCodeAt( 0 ) ^ b.charCodeAt( 0 ) ) % 31 ) - 15;
                    const ang = ( h === 0 ? 1 : h ) * 0.01;
                    ddx = Math.cos( ang ) * 1e-3;
                    ddy = Math.sin( ang ) * 1e-3;
                }

                const d2 = ddx * ddx + ddy * ddy;
                const invd = 1 / Math.sqrt( d2 );

                const qa = this.nodes.get( a )?.repulsionCharge ?? 1;
                const qb = this.nodes.get( b )?.repulsionCharge ?? 1;
                const f = ( coulombC * qa * qb * this.repulsionMultiplier( a, b ) ) / d2;

                const fx = f * ddx * invd;
                const fy = f * ddy * invd;

                const fa = force.get( a )!;
                fa.x -= fx;
                fa.y -= fy;

                const fb = force.get( b )!;
                fb.x += fx;
                fb.y += fy;
            }
        }

        const pushIndependentRootsApart = ( a: string, b: string ) => {
            const rootA = this.effectiveRootOf( a );
            const rootB = this.effectiveRootOf( b );
            if ( !rootA || !rootB || rootA === rootB ) return;

            const bodyA = this.rigidBodies.get( rootA );
            const bodyB = this.rigidBodies.get( rootB );
            const representativeA = bodyA?.members[ 0 ]?.id;
            const representativeB = bodyB?.members[ 0 ]?.id;
            if ( bodyA && a !== representativeA || bodyB && b !== representativeB ) return;

            const addPairForce = ( fx: number, fy: number ) => {
                const fa = force.get( representativeA ?? a )!;
                const fb = force.get( representativeB ?? b )!;
                fa.x -= fx;
                fa.y -= fy;
                fb.x += fx;
                fb.y += fy;
            };

            if ( bodyA && bodyB ) {
                const displacementA = this.posByRigidBody.get( rootA )!;
                const displacementB = this.posByRigidBody.get( rootB )!;
                const centerA = { x: bodyA.center.x + displacementA.x, y: bodyA.center.y + displacementA.y };
                const centerB = { x: bodyB.center.x + displacementB.x, y: bodyB.center.y + displacementB.y };
                const dx = centerB.x - centerA.x;
                const dy = centerB.y - centerA.y;
                const overlapX = ( bodyA.width + bodyB.width ) / 2 + this.opts.independentRootCollisionPadding - Math.abs( dx );
                const overlapY = ( bodyA.height + bodyB.height ) / 2 + this.opts.independentRootCollisionPadding - Math.abs( dy );
                if ( overlapX <= 0 || overlapY <= 0 ) return;

                const useX = overlapX <= overlapY;
                const direction = useX ? ( dx === 0 ? 1 : Math.sign( dx ) ) : ( dy === 0 ? 1 : Math.sign( dy ) );
                const penetration = useX ? overlapX : overlapY;
                const rawStrength = this.opts.independentRootCollisionK
                    * penetration
                    * Math.sqrt( Math.max( 1, bodyA.area * bodyB.area ) );
                const strength = Math.min( rawStrength, Math.max( 0, this.opts.maxRigidBlockOverlapForce ) );
                addPairForce( useX ? direction * strength : 0, useX ? 0 : direction * strength );
                return;
            }

            const radiusA = this.nodes.get( a )?.collisionRadius ?? 0;
            const radiusB = this.nodes.get( b )?.collisionRadius ?? 0;
            if ( radiusA <= 0 || radiusB <= 0 ) return;

            const pa = bodyA
                ? this.cur( representativeA! )
                : this.cur( a );
            const pb = this.cur( b );
            const dx = pb.x - pa.x;
            const dy = pb.y - pa.y;
            let ddx = dx;
            let ddy = dy;
            if ( ddx === 0 && ddy === 0 ) {
                const h = ( ( a.charCodeAt( 0 ) ^ b.charCodeAt( b.length - 1 ) ) % 31 ) - 15;
                const ang = ( h === 0 ? 1 : h ) * 0.01;
                ddx = Math.cos( ang ) * 1e-3;
                ddy = Math.sin( ang ) * 1e-3;
            }

            const dist = Math.hypot( ddx, ddy ) || 1e-6;
            const minDist = radiusA + radiusB + this.opts.independentRootCollisionPadding;
            const penetration = minDist - dist;
            if ( penetration <= 0 ) return;

            const f = this.opts.independentRootCollisionK * penetration * this.repulsionMultiplier( a, b );
            const fx = ( f * ddx ) / dist;
            const fy = ( f * ddy ) / dist;

            addPairForce( fx, fy );
        };

        // Barrera geométrica fuerte entre elementos de raíces distintas. No usa componentes conexas:
        // dos subgrafos separados también deben dejar de verse como inclusión accidental.
        for ( let i = 0; i < ids.length; i++ ) {
            for ( let j = i + 1; j < ids.length; j++ ) {
                pushIndependentRootsApart( ids[ i ], ids[ j ] );
            }
        }

        let maxDisp = 0;

        // integrar raíces (NODOS) — acumulamos fuerzas por raíz
        const rootF = new Map<string, Vec2>();
        for ( const r of this.nodeRoots ) {
            rootF.set( r, { x: 0, y: 0 } );
        }

        for ( const id of ids ) {
            if ( this.isParticle.has( id ) || this.isRigidMember.has( id ) ) continue;
            const r = this.idToRoot.get( id )!;
            const F = rootF.get( r )!;
            const f = force.get( id )!;
            F.x += f.x;
            F.y += f.y;
        }

        for ( const r of this.nodeRoots ) {
            if ( this.movableRoots && !this.movableRoots.has( r ) ) continue;

            const p = this.posByRoot.get( r )!;
            const v = this.velByRoot.get( r )!;
            const F = rootF.get( r )!;

            v.x += ( F.x - frictionGamma * v.x ) * this.dt;
            v.y += ( F.y - frictionGamma * v.y ) * this.dt;

            let dx = v.x * this.dt;
            let dy = v.y * this.dt;
            const disp = Math.hypot( dx, dy );

            if ( disp > this.opts.maxDisplacement ) {
                const s = this.opts.maxDisplacement / disp;
                dx *= s;
                dy *= s;
            }

            p.x += dx;
            p.y += dy;

            if ( disp > maxDisp ) maxDisp = disp;
        }

        const rigidBodyF = new Map<string, Vec2>();
        for ( const id of this.rigidBodies.keys() ) rigidBodyF.set( id, { x: 0, y: 0 } );
        for ( const id of ids ) {
            if ( !this.isRigidMember.has( id ) ) continue;
            const bodyId = this.idToRigidBody.get( id )!;
            const total = rigidBodyF.get( bodyId );
            if ( !total ) continue;
            const f = force.get( id )!;
            total.x += f.x;
            total.y += f.y;
        }

        for ( const bodyId of this.rigidBodies.keys() ) {
            if ( this.movableRigidBodies && !this.movableRigidBodies.has( bodyId ) ) continue;
            const p = this.posByRigidBody.get( bodyId )!;
            const v = this.velByRigidBody.get( bodyId )!;
            const F = rigidBodyF.get( bodyId )!;

            const mass = Math.max( 1, this.rigidBodies.get( bodyId )!.mass );
            v.x += ( F.x / mass - frictionGamma * v.x ) * this.dt;
            v.y += ( F.y / mass - frictionGamma * v.y ) * this.dt;

            let dx = v.x * this.dt;
            let dy = v.y * this.dt;
            const disp = Math.hypot( dx, dy );
            if ( disp > this.opts.maxDisplacement ) {
                const s = this.opts.maxDisplacement / disp;
                dx *= s;
                dy *= s;
            }
            p.x += dx;
            p.y += dy;
            if ( disp > maxDisp ) maxDisp = disp;
        }

        // integrar partículas (ACCIONES y CONDICIONES) — anclaje por id
        for ( const id of ids ) {
            if ( !this.isParticle.has( id ) ) continue;
            if ( this.movable && !this.movable.has( id ) ) continue;

            const v = this.velById.get( id )!;
            const p = this.posById.get( id )!;
            const f = force.get( id )!;

            v.x += ( f.x - frictionGamma * v.x ) * this.dt;
            v.y += ( f.y - frictionGamma * v.y ) * this.dt;

            let dx = v.x * this.dt;
            let dy = v.y * this.dt;
            const disp = Math.hypot( dx, dy );

            if ( disp > this.opts.maxDisplacement ) {
                const s = this.opts.maxDisplacement / disp;
                dx *= s;
                dy *= s;
            }

            p.x += dx;
            p.y += dy;

            if ( disp > maxDisp ) maxDisp = disp;
        }

        // dt adaptativo
        const { dtMin, dtMax, adjustPercent, threshHigh, threshLow } = this.opts;
        if ( maxDisp > threshHigh ) {
            this.dt = Math.max( dtMin, this.dt * ( 1 - adjustPercent ) );
        } else if ( maxDisp < threshLow ) {
            this.dt = Math.min( dtMax, this.dt * ( 1 + adjustPercent ) );
        }

        const overlapPairs = this.findIndependentRootOverlaps( ids );
        if ( overlapPairs.length > 0 ) {
            this.restoreDynamicState( previousState );
            return { maxDisp: 0, overlapDetected: true, overlapPairs };
        }

        this.hasCompletedStep = true;
        return { maxDisp, overlapDetected: false, overlapPairs: [] };
    }

    run( n: number ): StepStats {
        let maxDisp = 0;
        const overlapPairs: Array<{ firstId: string; secondId: string }> = [];
        for ( let i = 0; i < n; i++ ) {
            const stats = this.step();
            if ( stats.maxDisp > maxDisp ) maxDisp = stats.maxDisp;
            if ( stats.overlapDetected ) {
                overlapPairs.push( ...stats.overlapPairs );
                return { maxDisp, overlapDetected: true, overlapPairs };
            }
        }
        return { maxDisp, overlapDetected: false, overlapPairs };
    }

    getPositions(): Record<string, Vec2> {
        const out: Record<string, Vec2> = {};
        for ( const [ id, n ] of this.nodes.entries() ) {
            if ( this.isRigidMember.has( id ) ) {
                out[ id ] = this.cur( id );
            } else if ( this.isParticle.has( id ) ) {
                const p = this.posById.get( id )!;
                out[ id ] = { x: n.base.x + p.x, y: n.base.y + p.y };
            } else {
                const r = this.idToRoot.get( id )!;
                const pr = this.posByRoot.get( r )!;
                out[ id ] = { x: n.base.x + pr.x, y: n.base.y + pr.y };
            }
        }
        return out;
    }
}
