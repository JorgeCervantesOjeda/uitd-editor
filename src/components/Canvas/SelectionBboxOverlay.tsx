import React from "react";
import { useAppStore } from "../../state/store";
import { computeSelectedBBox, boundsToRectWithMargin } from "./selection-bbox";

const MARGIN = 20;

export function SelectionBboxOverlay( { margin = MARGIN }: { margin?: number } ) {
    const nodes = useAppStore( s => s.nodes );
    const actions = useAppStore( s => s.actions );
    const conds = useAppStore( s => s.conditions );

    const selNodes = useAppStore( s => s.selection );
    const selActions = useAppStore( s => s.selectionActions );
    const selConds = useAppStore( s => s.selectionConds );

    const B = React.useMemo(
        () => computeSelectedBBox( nodes, actions, conds, selNodes, selActions, selConds ),
        [ nodes, actions, conds, selNodes, selActions, selConds ]
    );

    if ( !B ) return null;

    const R = boundsToRectWithMargin( B, margin );

    return (
        <g data-debug="bbox-live" pointerEvents="none">
            <rect
                x={ R.x } y={ R.y } width={ R.w } height={ R.h }
                fill="none"
                stroke="#ef4444"
                strokeWidth={ 2 }
                strokeDasharray="6 6"
            />
        </g>
    );
}
