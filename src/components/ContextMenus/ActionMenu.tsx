export default function ActionMenu( props: {
    x: number; y: number;
    onGoToTarget: () => void;
    onClose: () => void;
} ) {
    return (
        <div
            style={ {
                position: "fixed", left: props.x, top: props.y,
                background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 6,
                boxShadow: "0 8px 24px rgba(0,0,0,0.12)", padding: 6, zIndex: 12, minWidth: 200
            } }
            onClick={ ( e ) => e.stopPropagation() }
        >
            <button
                style={ { width: "100%", padding: "6px 10px", textAlign: "left", background: "transparent", border: "none", cursor: "pointer" } }
                onClick={ () => { props.onGoToTarget(); props.onClose(); } }
            >
                Go to target
            </button>
        </div>
    );
}
  