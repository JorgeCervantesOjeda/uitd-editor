export default function NodeMenu( props: {
    x: number; y: number;
    onAddAction: () => void;
    onRename: () => void;
    onDelete: () => void;
    onClose: () => void;
} ) {
    return (
        <div
            style={ {
                position: "fixed", left: props.x, top: props.y,
                background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 6,
                boxShadow: "0 8px 24px rgba(0,0,0,0.12)", padding: 6, zIndex: 11, minWidth: 200
            } }
            onClick={ ( e ) => e.stopPropagation() }
        >
            <button
                style={ { width: "100%", padding: "6px 10px", textAlign: "left", background: "transparent", border: "none", cursor: "pointer" } }
                onClick={ () => { props.onAddAction(); props.onClose(); } }
            >
                Add action
            </button>
            <hr style={ { border: "none", borderTop: "1px solid #e5e7eb", margin: "6px 0" } } />
            <button
                style={ { width: "100%", padding: "6px 10px", textAlign: "left", background: "transparent", border: "none", cursor: "pointer" } }
                onClick={ () => { props.onRename(); props.onClose(); } }
            >
                Rename
            </button>
            <button
                style={ { width: "100%", padding: "6px 10px", textAlign: "left", background: "transparent", border: "none", cursor: "pointer", color: "#991b1b" } }
                onClick={ () => { props.onDelete(); props.onClose(); } }
            >
                Delete
            </button>
        </div>
    );
}
  