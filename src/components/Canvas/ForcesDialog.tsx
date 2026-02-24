import React, { useEffect, useState } from "react";

export type SimParams = {
    iterations: number;
    stepsPerFrame: number;
    fastForward: number;
    springK: number;
    equilibriumDist: number;
    coulombC: number;
    frictionGamma: number;
    timeStep: number;
    maxDisplacement: number;
};

const LS_KEY = "uitdl/simParams";

export function ForcesDialog( props: {
    open: boolean;
    initial: SimParams;
    onSave: ( p: SimParams ) => void;
    onClose: () => void;
} ) {
    const { open, initial, onSave, onClose } = props;

    const [ local, setLocal ] = useState<SimParams>( initial );

    // Cargar de LS al abrir; si no hay, usar initial
    useEffect( () => {
        if ( !open ) return;
        try {
            const raw = localStorage.getItem( LS_KEY );
            if ( raw ) {
                const parsed = JSON.parse( raw ) as SimParams;
                setLocal( parsed );
            } else {
                setLocal( initial );
            }
        } catch {
            setLocal( initial );
        }
    }, [ open, initial ] );

    // Helpers para parseo seguro
    const num = ( v: string, fallback: number ) => {
        const x = parseFloat( v );
        return Number.isFinite( x ) ? x : fallback;
    };

    if ( !open ) return null;

    return (
        <div
            role="dialog"
            aria-modal="true"
            onKeyDown={ ( e ) => {
                if ( e.key === "Escape" ) {
                    e.stopPropagation();
                    e.preventDefault();
                    onClose();
                }
            } }
            style={ {
                position: "fixed",
                inset: 0,
                background: "rgba(2,6,23,.35)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 80,
                padding: 16,
            } }
            // ⛔️ No cerrar por click en backdrop
            onMouseDown={ ( e ) => {
                if ( e.target === e.currentTarget ) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            } }
        >
            <form
                onSubmit={ ( e ) => {
                    e.preventDefault();
                    try {
                        localStorage.setItem( LS_KEY, JSON.stringify( local ) );
                    } catch {
                        // Ignore storage failures (private mode/quota).
                    }
                    onSave( local );
                    onClose();
                } }
                style={ {
                    width: 560,
                    maxWidth: "92vw",
                    background: "#ffffff",
                    border: "1px solid #e2e8f0",
                    borderRadius: 12,
                    boxShadow: "0 16px 48px rgba(2,6,23,.28)",
                    padding: 16,
                    display: "grid",
                    gridTemplateColumns: "max-content 1fr",
                    columnGap: 16,
                    rowGap: 10,
                } }
            >
                <button type="submit" style={{ display: "none" }} aria-hidden="true" />
                <div style={{ gridColumn: "1 / -1", fontWeight: 700, fontSize: 16, marginBottom: 2 }}>
                    Simulation parameters
                </div>
                <div style={{ gridColumn: "1 / -1", fontSize: 24, color: "#475569", marginBottom: 6 }}>
                    Press <kbd>Enter</kbd> to <b>save</b>. Press <kbd>Esc</kbd> to <b>cancel</b>.
                </div>

                <label style={{ textAlign: "right", alignSelf: "center" }}>Iterations</label>
                <input
                    autoFocus
                    type="number"
                    min={1}
                    step={1}
                    value={ local.iterations }
                    onChange={ ( e ) => setLocal( ( p ) => ( { ...p, iterations: num( e.target.value, p.iterations ) } ) ) }
                    style={{ width: "100%", padding: "6px 8px", border: "1px solid #cbd5e1", borderRadius: 6 }}
                />

                <label style={{ textAlign: "right", alignSelf: "center" }}>Steps per frame</label>
                <input
                    type="number"
                    min={1}
                    step={1}
                    value={ local.stepsPerFrame }
                    onChange={ ( e ) => setLocal( ( p ) => ( { ...p, stepsPerFrame: num( e.target.value, p.stepsPerFrame ) } ) ) }
                    style={{ width: "100%", padding: "6px 8px", border: "1px solid #cbd5e1", borderRadius: 6 }}
                />

                <label style={{ textAlign: "right", alignSelf: "center" }}>Fast forward (frames)</label>
                <input
                    type="number"
                    min={0}
                    step={1}
                    value={ local.fastForward }
                    onChange={ ( e ) => setLocal( ( p ) => ( { ...p, fastForward: num( e.target.value, p.fastForward ) } ) ) }
                    style={{ width: "100%", padding: "6px 8px", border: "1px solid #cbd5e1", borderRadius: 6 }}
                />

                <label style={{ textAlign: "right", alignSelf: "center" }}>Spring K</label>
                <input
                    type="number"
                    step="any"
                    value={ local.springK }
                    onChange={ ( e ) => setLocal( ( p ) => ( { ...p, springK: num( e.target.value, p.springK ) } ) ) }
                    style={{ width: "100%", padding: "6px 8px", border: "1px solid #cbd5e1", borderRadius: 6 }}
                />

                <label style={{ textAlign: "right", alignSelf: "center" }}>Equilibrium dist</label>
                <input
                    type="number"
                    step="any"
                    value={ local.equilibriumDist }
                    onChange={ ( e ) => setLocal( ( p ) => ( { ...p, equilibriumDist: num( e.target.value, p.equilibriumDist ) } ) ) }
                    style={{ width: "100%", padding: "6px 8px", border: "1px solid #cbd5e1", borderRadius: 6 }}
                />

                <label style={{ textAlign: "right", alignSelf: "center" }}>Coulomb C</label>
                <input
                    type="number"
                    step="any"
                    value={ local.coulombC }
                    onChange={ ( e ) => setLocal( ( p ) => ( { ...p, coulombC: num( e.target.value, p.coulombC ) } ) ) }
                    style={{ width: "100%", padding: "6px 8px", border: "1px solid #cbd5e1", borderRadius: 6 }}
                />

                <label style={{ textAlign: "right", alignSelf: "center" }}>Friction γ</label>
                <input
                    type="number"
                    step="any"
                    value={ local.frictionGamma }
                    onChange={ ( e ) => setLocal( ( p ) => ( { ...p, frictionGamma: num( e.target.value, p.frictionGamma ) } ) ) }
                    style={{ width: "100%", padding: "6px 8px", border: "1px solid #cbd5e1", borderRadius: 6 }}
                />

                <label style={{ textAlign: "right", alignSelf: "center" }}>Time step</label>
                <input
                    type="number"
                    step="any"
                    value={ local.timeStep }
                    onChange={ ( e ) => setLocal( ( p ) => ( { ...p, timeStep: num( e.target.value, p.timeStep ) } ) ) }
                    style={{ width: "100%", padding: "6px 8px", border: "1px solid #cbd5e1", borderRadius: 6 }}
                />

                <label style={{ textAlign: "right", alignSelf: "center" }}>Max displacement</label>
                <input
                    type="number"
                    step="any"
                    value={ local.maxDisplacement }
                    onChange={ ( e ) => setLocal( ( p ) => ( { ...p, maxDisplacement: num( e.target.value, p.maxDisplacement ) } ) ) }
                    style={{ width: "100%", padding: "6px 8px", border: "1px solid #cbd5e1", borderRadius: 6 }}
                />
            </form>
        </div>
    );
}
