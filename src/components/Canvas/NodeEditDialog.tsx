// src/components/Canvas/NodeEditDialog.tsx
import { useEffect, useMemo, useState } from "react";
import { useAppStore } from "../../state/store";

export function NodeEditDialog( props: {
    open: boolean;
    nodeId: number | null;
    onClose: () => void;
} ) {
    const { open, nodeId, onClose } = props;

    const node = useAppStore( s => s.nodes.find( n => n.id === nodeId! ) ) ?? null;
    const editNodeMeta = useAppStore( s => s.editNodeMeta );   // asumes que ya existe
    const setNodeColors = useAppStore( s => s.setNodeColors ); // ya existe en tu store

    // Defaults (mismos que usabas en el menú contextual)
    const DEF_FILL = "#f1f5f9";
    const DEF_STROKE = "#94a3b8";
    const DEF_TEXT = "#334155";

    const [ displayId, setDisplayId ] = useState( "" );
    const [ title, setTitle ] = useState( "" );

    // Colores
    const [ fill, setFill ] = useState( DEF_FILL );
    const [ stroke, setStroke ] = useState( DEF_STROKE );
    const [ text, setText ] = useState( DEF_TEXT );

    // Cargar datos al abrir/cambiar nodeId
    useEffect( () => {
        if ( !open || !node ) return;
        setDisplayId( ( node.displayId ?? String( node.id ) ) || "" );
        setTitle( node.title ?? "" );
        setFill( node.colorFill ?? DEF_FILL );
        setStroke( node.colorStroke ?? DEF_STROKE );
        setText( node.colorText ?? DEF_TEXT );
    }, [ open, nodeId ] ); // eslint-disable-line react-hooks/exhaustive-deps

    const canSave = useMemo( () => {
        if ( !node ) return false;
        const d = displayId.trim();
        const t = title.trim();
        // validación mínima: no vacíos
        return d.length > 0 && t.length > 0;
    }, [ node, displayId, title ] );

    function onSave() {
        if ( !node || !canSave ) return;
        const d = displayId.trim();
        const t = title.trim();

        // Meta (displayId + title)
        editNodeMeta( node.id, { displayId: d, title: t } );

        // Colores
        setNodeColors( node.id, { fill, stroke, text } );

        onClose();
    }

    if ( !open || !node ) return null;

    // Dialogo simple “portal-less”; adapta a tu modal si usas otro
    return (
        <div
            role="dialog"
            aria-modal="true"
            style={ {
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,.2)",
                display: "grid",
                placeItems: "center",
                zIndex: 100
            } }
            onMouseDown={ ( e ) => {
                // cierra al click fuera del panel
                if ( e.target === e.currentTarget ) onClose();
            } }
        >
            <form
                onSubmit={ ( e ) => { e.preventDefault(); if ( canSave ) onSave(); } }
                style={ {
                    width: 420,
                    maxWidth: "90vw",
                    background: "#fff",
                    border: "1px solid #e2e8f0",
                    borderRadius: 10,
                    padding: 16,
                    boxShadow: "0 12px 40px rgba(2,6,23,.2)"
                } }
                onMouseDown={ ( e ) => e.stopPropagation() }
            >
                <div style={ { fontWeight: 700, fontSize: 16, marginBottom: 10 } }>
                    Edit node
                </div>

                {/* displayId + title */ }
                <div style={ { display: "grid", gap: 8, marginBottom: 12 } }>
                    <label style={ { display: "grid", gap: 6 } }>
                        <span>Display ID</span>
                        <input
                            autoFocus
                            type="text"
                            value={ displayId }
                            onChange={ ( e ) => setDisplayId( e.target.value ) }
                            style={ { padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: 6 } }
                        />
                    </label>
                    <label style={ { display: "grid", gap: 6 } }>
                        <span>Title</span>
                        <input
                            type="text"
                            value={ title }
                            onChange={ ( e ) => setTitle( e.target.value ) }
                            style={ { padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: 6 } }
                        />
                    </label>
                </div>

                {/* Color pickers */ }
                <div style={ { display: "grid", gap: 8, marginBottom: 12 } }>
                    <label style={ { display: "flex", alignItems: "center", gap: 8 } }>
                        <span style={ { width: 110 } }>Background</span>
                        <input type="color" value={ fill } onChange={ ( e ) => setFill( e.target.value ) } />
                    </label>
                    <label style={ { display: "flex", alignItems: "center", gap: 8 } }>
                        <span style={ { width: 110 } }>Border</span>
                        <input type="color" value={ stroke } onChange={ ( e ) => setStroke( e.target.value ) } />
                    </label>
                    <label style={ { display: "flex", alignItems: "center", gap: 8 } }>
                        <span style={ { width: 110 } }>Text</span>
                        <input type="color" value={ text } onChange={ ( e ) => setText( e.target.value ) } />
                    </label>
                </div>

                <div style={ { display: "flex", gap: 8, justifyContent: "flex-end" } }>
                    <button type="button" onClick={ onClose }>Cancel</button>
                    <button type="submit" disabled={ !canSave } style={ { opacity: canSave ? 1 : 0.6 } }>
                        Save
                    </button>
                </div>
            </form>
        </div>
    );
}
