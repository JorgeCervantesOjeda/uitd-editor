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
};

export type StepStats = {
    maxDisp: number;
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

    private repulsionMultiplier( a: string, b: string ): number {
        const kindA = this.nodes.get( a )?.repulsionKind ?? ( this.nodes.get( a )?.rootId ? "ui" : "particle" );
        const kindB = this.nodes.get( b )?.repulsionKind ?? ( this.nodes.get( b )?.rootId ? "ui" : "particle" );
        if ( kindA !== "ui" || kindB !== "ui" ) return 1;
        const factor = this.opts.uiCoulombRepulsionFactor;
        return Number.isFinite( factor ) && factor >= 0 ? factor : 1;
    }

    step(): StepStats {
        const { springK, equilibriumDist, coulombC, frictionGamma } = this.opts;

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
        const ids = [ ...this.nodes.keys() ];
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

            const radiusA = this.nodes.get( a )?.collisionRadius ?? 0;
            const radiusB = this.nodes.get( b )?.collisionRadius ?? 0;
            if ( radiusA <= 0 || radiusB <= 0 ) return;

            const pa = this.cur( a );
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

            const fa = force.get( a )!;
            fa.x -= fx;
            fa.y -= fy;

            const fb = force.get( b )!;
            fb.x += fx;
            fb.y += fy;
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

        for ( const [ bodyId, body ] of this.rigidBodies ) {
            if ( this.movableRigidBodies && !this.movableRigidBodies.has( bodyId ) ) continue;
            const p = this.posByRigidBody.get( bodyId )!;
            const v = this.velByRigidBody.get( bodyId )!;
            const F = rigidBodyF.get( bodyId )!;

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

        return { maxDisp };
    }

    run( n: number ): StepStats {
        let maxDisp = 0;
        for ( let i = 0; i < n; i++ ) {
            const stats = this.step();
            if ( stats.maxDisp > maxDisp ) maxDisp = stats.maxDisp;
        }
        return { maxDisp };
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
