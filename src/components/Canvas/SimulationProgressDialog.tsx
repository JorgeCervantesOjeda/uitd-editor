import React, { useMemo, useRef } from "react";
import { useDialogFocusTrap } from "./useDialogFocusTrap";
import type { ForcesRunProgress } from "../../physics/runForces";

type Props = {
    open: boolean;
    progress: ForcesRunProgress | null;
    onStop: () => void;
};

function clamp01( value: number ) {
    if ( !Number.isFinite( value ) ) return 0;
    return Math.max( 0, Math.min( 1, value ) );
}

function computeProgressValue( progress: ForcesRunProgress | null ) {
    if ( !progress ) return 0;
    const { maxDisp, convergenceThreshold, stableFrames, stableFramesRequired } = progress;

    if ( maxDisp > convergenceThreshold ) {
        return clamp01( Math.min( 0.9, Math.sqrt( convergenceThreshold / maxDisp ) * 0.9 ) );
    }

    if ( stableFramesRequired <= 0 ) return 1;
    return clamp01( 0.9 + ( stableFrames / stableFramesRequired ) * 0.1 );
}

export function SimulationProgressDialog( { open, progress, onStop }: Props ) {
    const dialogRef = useRef<HTMLDivElement | null>( null );
    useDialogFocusTrap( open, dialogRef );

    const progressValue = useMemo( () => computeProgressValue( progress ), [ progress ] );
    const progressPct = Math.round( progressValue * 100 );

    if ( !open ) return null;

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="simulation-progress-title"
            style={ {
                position: "fixed",
                inset: 0,
                background: "rgba(2,6,23,.35)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 90,
                padding: 16,
            } }
            onMouseDown={ ( e ) => {
                if ( e.target === e.currentTarget ) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            } }
        >
            <div
                ref={ dialogRef }
                style={ {
                    width: 480,
                    maxWidth: "92vw",
                    background: "#ffffff",
                    border: "1px solid #e2e8f0",
                    borderRadius: 12,
                    boxShadow: "0 16px 48px rgba(2,6,23,.28)",
                    padding: 16,
                    display: "grid",
                    gap: 14,
                } }
            >
                <div style={ { display: "grid", gap: 4 } }>
                    <div id="simulation-progress-title" style={ { fontWeight: 700, fontSize: 16 } }>
                        Progreso de simulación
                    </div>
                    <div style={ { color: "#475569", fontSize: 13 } }>
                        Convergiendo el layout importado desde UITDL. Interrumpe cuando quieras conservar la disposición actual.
                    </div>
                </div>

                <div style={ { display: "grid", gap: 8 } }>
                    <div style={ { display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13 } }>
                        <span style={ { fontWeight: 600, color: "#0f172a" } }>Convergiendo</span>
                        <span style={ { color: "#475569" } }>{ progressPct }%</span>
                    </div>
                    <div
                        aria-hidden="true"
                        style={ {
                            height: 12,
                            borderRadius: 999,
                            background: "#e2e8f0",
                            overflow: "hidden",
                        } }
                    >
                        <div
                            style={ {
                                width: `${progressPct}%`,
                                height: "100%",
                                borderRadius: 999,
                                background: "linear-gradient(90deg, #0f766e, #14b8a6)",
                                transition: "width 120ms linear",
                            } }
                        />
                    </div>
                </div>

                <div
                    style={ {
                        display: "grid",
                        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                        gap: 10,
                        fontSize: 13,
                        color: "#334155",
                    } }
                >
                    <div>Iteraciones procesadas: { progress?.iterations ?? 0 }</div>
                    <div>Desplazamiento máximo: { ( progress?.maxDisp ?? 0 ).toFixed( 2 ) } px</div>
                    <div>Umbral: { ( progress?.convergenceThreshold ?? 0 ).toFixed( 2 ) } px</div>
                    <div>Frames estables: { progress?.stableFrames ?? 0 } / { progress?.stableFramesRequired ?? 0 }</div>
                </div>

                <div style={ { display: "flex", justifyContent: "flex-end" } }>
                    <button
                        type="button"
                        onClick={ onStop }
                        style={ {
                            padding: "8px 12px",
                            borderRadius: 8,
                            border: "1px solid #b91c1c",
                            background: "#ffffff",
                            color: "#b91c1c",
                            cursor: "pointer",
                            fontWeight: 600,
                        } }
                    >
                        Interrumpir
                    </button>
                </div>
            </div>
        </div>
    );
}

export default SimulationProgressDialog;
