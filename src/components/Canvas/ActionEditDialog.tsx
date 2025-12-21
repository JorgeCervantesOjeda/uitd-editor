// src/components/Canvas/ActionEditDialog.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useAppStore } from "../../state/store";
import type { ActionId } from "../../state/types";
import type { UiVerb } from "../../model/uiVerbs";
import { UI_VERBS } from "../../model/uiVerbs";
import { buildActionTitle, validateComplement } from "../../utils/actionLabel";

export function ActionEditDialog( props: {
    open: boolean;
    actionId: number | null;
    onClose: () => void;
} ) {
    const { open, actionId, onClose } = props;

    const action = useAppStore( ( s ) =>
        actionId != null ? s.actions.find( ( a ) => a.id === actionId ) ?? null : null
    );

    const editActionVerbComplement = useAppStore( ( s ) => s.editActionVerbComplement );

    const panelRef = useRef<HTMLDivElement | null>( null );

    const [ localVerb, setLocalVerb ] = useState<UiVerb>( "clicks" );
    const [ localComp, setLocalComp ] = useState<string>( "X" );
    const [ err, setErr ] = useState<string | null>( null );

    // Sync al abrir/cambiar acción
    useEffect( () => {
        if ( !open || !action ) return;
        setLocalVerb( action.verb ?? "clicks" );
        setLocalComp( action.complement ?? "" );
        setErr( null );
    }, [ open, action?.id ] );

    // Cerrar por ESC
    useEffect( () => {
        function onKey( e: KeyboardEvent ) {
            if ( e.key === "Escape" ) onClose();
        }
        document.addEventListener( "keydown", onKey );
        return () => document.removeEventListener( "keydown", onKey );
    }, [ onClose ] );

    // Cerrar al click fuera
    useEffect( () => {
        function onPointerDown( e: PointerEvent ) {
            if ( !open ) return;
            const el = panelRef.current;
            if ( !el ) return;
            const target = e.target as Node | null;
            if ( target && !el.contains( target ) ) onClose();
        }
        document.addEventListener( "pointerdown", onPointerDown, true );
        return () => document.removeEventListener( "pointerdown", onPointerDown, true );
    }, [ open, onClose ] );

    const previewTitle = useMemo( () => {
        return buildActionTitle( localVerb ?? "clicks", ( localComp ?? "" ).trim() );
    }, [ localVerb, localComp ] );

    if ( !open || !action ) return null;

    const applyIfValid = ( verb: UiVerb, comp: string ) => {
        const chk = validateComplement( comp );
        if ( !chk.ok ) {
            setErr( chk.reason );
            return false;
        }
        setErr( null );
        editActionVerbComplement( action.id as ActionId, verb, comp.trim() );
        return true;
    };

    return (
        <div
            role="dialog"
            aria-modal="true"
            style={ {
                position: "fixed",
                inset: 0,
                zIndex: 120,
                display: "grid",
                placeItems: "center",
                background: "rgba(15, 23, 42, 0.25)",
            } }
            onMouseDown={ ( e ) => {
                if ( e.target === e.currentTarget ) onClose();
            } }
        >
            <form
                ref={ panelRef as any }
                onPointerDown={ ( e ) => e.stopPropagation() }
                onSubmit={ ( e ) => {
                    e.preventDefault();
                    const ok = applyIfValid( localVerb, localComp );
                    if ( ok ) onClose();
                } }
                style={ {
                    width: 520,
                    maxWidth: "92vw",
                    background: "#fff",
                    border: "1px solid #e2e8f0",
                    borderRadius: 10,
                    boxShadow: "0 20px 60px rgba(2,6,23,.25)",
                    padding: 16,
                    display: "grid",
                    gap: 12,
                } }
            >
                {/* Submit invisible para Enter */ }
                <button
                    type="submit"
                    tabIndex={ -1 }
                    aria-hidden="true"
                    style={ {
                        position: "absolute",
                        width: 0,
                        height: 0,
                        padding: 0,
                        margin: 0,
                        border: 0,
                        opacity: 0,
                    } }
                />

                <div style={ { fontWeight: 700, fontSize: 16 } }>Edit action</div>

                <div style={ { display: "grid", gap: 6 } }>
                    <span style={ { fontSize: 12, color: "#475569" } }>Verb</span>
                    <select
                        value={ localVerb }
                        onChange={ ( e ) => {
                            const v = e.target.value as UiVerb;
                            setLocalVerb( v );
                            applyIfValid( v, localComp );
                        } }
                        style={ {
                            padding: "8px 10px",
                            borderRadius: 8,
                            border: "1px solid #cbd5e1",
                            fontSize: 14,
                            background: "#fff",
                        } }
                    >
                        { UI_VERBS.map( ( v ) => (
                            <option key={ v } value={ v }>
                                { v }
                            </option>
                        ) ) }
                    </select>
                </div>

                <div style={ { display: "grid", gap: 6 } }>
                    <span style={ { fontSize: 12, color: "#475569" } }>Complement (sin comillas)</span>
                    <input
                        autoFocus
                        type="text"
                        value={ localComp }
                        onChange={ ( e ) => {
                            const raw = e.target.value;
                            setLocalComp( raw );
                            applyIfValid( localVerb, raw );
                        } }
                        onBlur={ () => {
                            applyIfValid( localVerb, localComp );
                        } }
                        style={ {
                            padding: "8px 10px",
                            borderRadius: 8,
                            border: err ? "1px solid #ef4444" : "1px solid #cbd5e1",
                            fontSize: 14,
                        } }
                        placeholder="Ej: Login"
                    />
                    { err && <div style={ { fontSize: 12, color: "#ef4444" } }>{ err }</div> }
                </div>

                <div style={ { fontSize: 12, color: "#475569" } }>
                    Vista previa en el diagrama:
                    <div
                        style={ {
                            marginTop: 6,
                            fontFamily:
                                "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                        } }
                    >
                        { previewTitle }
                    </div>
                </div>

                <div style={ { display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 } }>
                    <button
                        type="button"
                        onClick={ onClose }
                        style={ {
                            padding: "8px 12px",
                            borderRadius: 8,
                            border: "1px solid #cbd5e1",
                            background: "#fff",
                            cursor: "pointer",
                        } }
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        style={ {
                            padding: "8px 12px",
                            borderRadius: 8,
                            border: "1px solid #0f172a",
                            background: "#0f172a",
                            color: "#fff",
                            cursor: "pointer",
                        } }
                    >
                        Save
                    </button>
                </div>
            </form>
        </div>
    );
}
