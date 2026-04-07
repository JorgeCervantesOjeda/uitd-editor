// src/physics/defaults.ts
import type { SimulatorOptions } from "./force-simulator";
import type { SimParams } from "../components/Canvas/ForcesDialog";

// Defaults del motor (opciones físicas).
// Nota: estos incluyen campos que el UI puede no exponer (dtMin, dtMax, etc.).
export const DEFAULT_SIMULATOR_OPTIONS: Required<SimulatorOptions> = {
    springK: 0.01,
    equilibriumDist: 200,
    coulombC: 600,
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
};

// Defaults del panel de simulación (UI).
// Por ahora mantenemos sólo los campos ya expuestos en la UI.
export const DEFAULT_SIM_PARAMS: SimParams = {
    iterations: 600,
    stepsPerFrame: 10,
    fastForward: 30,
    springK: DEFAULT_SIMULATOR_OPTIONS.springK,
    equilibriumDist: DEFAULT_SIMULATOR_OPTIONS.equilibriumDist,
    coulombC: DEFAULT_SIMULATOR_OPTIONS.coulombC,
    frictionGamma: DEFAULT_SIMULATOR_OPTIONS.frictionGamma,
    timeStep: DEFAULT_SIMULATOR_OPTIONS.timeStep,
    maxDisplacement: DEFAULT_SIMULATOR_OPTIONS.maxDisplacement,
};