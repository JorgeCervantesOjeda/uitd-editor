import React, { useState } from "react";
import { useAppStore } from "../../state/store";

type Props = {
    open: boolean;
    nodeId: number | null;
    onClose: () => void;
};

export function NodeEditDialog( { open, nodeId, onClose }: Props ) {
    const node = useAppStore( s => s.nodes.find( n => n.id === nodeId ) ) ?? null;
    const editNodeMeta = useAppStore( s => s.editNodeMeta );

    const [ displayId, setDisplayId ] = useState<string>( "" );
    const [ title, setTitle ] = useState<string>( "" );

    // Sincroniza cuando cambie el nodo abierto
    React.useEffect( () => {
        if ( node ) {
            setDisplayId( node.displayId ?? String( node.id ) );
            setTitle( node.title ?? "" );
        }
    }, [ nodeId ] );

    if ( !open || !node ) return null;

    function onSave() {
        const d = displayId.trim();
        const t = title.trim();
        if ( !d || !t ) return;

        const id = node?.id;
        if ( id == null ) return;

        editNodeMeta( id, { displayId: d, title: t } );
        onClose();
    }

    return (
        <form
            style={ {
                position: "fixed", inset: 0, background: "rgba(2,6,23,.35)",
                display: "grid", placeItems: "center", zIndex: 100
            } }
            onClick={ onClose }
            onSubmit={ ( e ) => { e.preventDefault(); onSave(); } }
        >
            <div
                style={ {
                    minWidth: 380, background: "#fff", border: "1px solid #cbd5e1",
                    borderRadius: 8, boxShadow: "0 8px 32px rgba(2,6,23,.25)",
                    padding: 16, display: "grid", gap: 12
                } }
                onClick={ e => e.stopPropagation() }
            >
                <h3 style={ { margin: 0, fontSize: 16, color: "#0f172a" } }>Edit node</h3>

                <label style={ { display: "grid", gap: 6 } }>
                    <span style={ { fontSize: 12, color: "#475569" } }>ID (visible)</span>
                    <input
                        autoFocus
                        onKeyDown={ ( e ) => {
                            if ( e.key === "Backspace" || e.key === "Delete" ) e.stopPropagation();
                        } }
                        value={ displayId }
                        onChange={ e => setDisplayId( e.target.value ) }
                        style={ { padding: 8, border: "1px solid #94a3b8", borderRadius: 6 } }
                    />
                </label>

                <label style={ { display: "grid", gap: 6 } }>
                    <span style={ { fontSize: 12, color: "#475569" } }>Title</span>
                    <input
                        onKeyDown={ ( e ) => {
                            if ( e.key === "Backspace" || e.key === "Delete" ) e.stopPropagation();
                        } }
                        value={ title }
                        onChange={ e => setTitle( e.target.value ) }
                        style={ { padding: 8, border: "1px solid #94a3b8", borderRadius: 6 } }
                    />
                </label>

                <div style={ { display: "flex", gap: 8, justifyContent: "end" } }>
                    <button type="button" onClick={ onClose }>Cancel</button>
                    <button type="submit" onClick={ onSave }>Save</button>
                </div>
            </div>
        </form>
    );
}
