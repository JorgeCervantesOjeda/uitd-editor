// src/components/Canvas/RigidBlocksLayer.tsx
// Renders persistent visual RigidBlock rectangles without intercepting canvas input.

import { useAppStore } from "../../state/store";
import { buildRigidBlockBounds } from "../../rigidBlocks/rigidBlockModel";

export function RigidBlocksLayer() {
    const rigidBlocks = useAppStore( state => state.rigidBlocks );
    const nodes = useAppStore( state => state.nodes );
    const actions = useAppStore( state => state.actions );
    const conditions = useAppStore( state => state.conditions );
    const canvasDark = useAppStore( state => state.canvasDark );

    return (
        <g data-layer="rigid-blocks" pointerEvents="none">
            { rigidBlocks.map( block => {
                const bounds = buildRigidBlockBounds( {
                    members: block.members,
                    nodes,
                    actions,
                    conditions,
                } );
                if ( !bounds ) {
                    console.warn( "[RigidBlockCanvas] Could not render a persisted rigid block.", {
                        cause: "One or more block members have no current canvas geometry.",
                        fallback: "The invalid block rectangle is omitted from the visual layer.",
                        impact: "The rest of the canvas remains interactive; the stale block requires structural reconciliation.",
                        blockId: block.id,
                    } );
                    return null;
                }

                return (
                    <rect
                        key={ block.id }
                        data-testid={ `rigid-block-${block.id}` }
                        data-rigid-block-id={ block.id }
                        data-center-x={ bounds.center.x }
                        data-center-y={ bounds.center.y }
                        className={ `rigidBlockRect${canvasDark ? " rigidBlockRect--dark" : ""}` }
                        x={ bounds.left }
                        y={ bounds.top }
                        width={ bounds.width }
                        height={ bounds.height }
                        rx={ 12 }
                        ry={ 12 }
                        pointerEvents="none"
                        aria-label={ `Rigid block ${block.id}` }
                    />
                );
            } ) }
        </g>
    );
}
