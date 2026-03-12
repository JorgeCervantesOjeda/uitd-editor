import type { SimParams } from "../components/Canvas/ForcesDialog";

export const SIM_PARAMS_STORAGE_KEY = "uitdl-editor/sim-params";

export function sanitizeSimParams( raw: unknown, fallback: SimParams ): SimParams {
    const rec = ( typeof raw === "object" && raw !== null ) ? raw as Record<string, unknown> : null;
    if ( !rec ) return fallback;

    const pick = ( key: keyof SimParams, min?: number, integer = false ) => {
        const v = rec[ key ];
        if ( typeof v !== "number" || !Number.isFinite( v ) ) return fallback[ key ];
        const n = integer ? Math.floor( v ) : v;
        if ( min != null && n < min ) return fallback[ key ];
        return n;
    };

    return {
        iterations: pick( "iterations", 1, true ),
        stepsPerFrame: pick( "stepsPerFrame", 1, true ),
        fastForward: pick( "fastForward", 0, true ),
        springK: pick( "springK" ),
        equilibriumDist: pick( "equilibriumDist", 0 ),
        coulombC: pick( "coulombC", 0 ),
        frictionGamma: pick( "frictionGamma", 0 ),
        timeStep: pick( "timeStep", 0 ),
        maxDisplacement: pick( "maxDisplacement", 0 ),
    };
}
