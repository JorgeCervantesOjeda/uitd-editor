// src/components/Canvas/AlignmentGuidesOverlay.tsx
import { useAppStore } from "../../state/store";

export function AlignmentGuidesOverlay() {
    const drag = useAppStore( s => s.drag );
    const guides = useAppStore( s => s.dragGuides );
    const viewBox = useAppStore( s => s.viewBox );
    const panzoom = useAppStore( s => s.panzoom );

    if ( !drag.active || !guides?.enabled ) return null;

    // Extremos visibles del viewport en coordenadas "mundo"
    const { x: px, y: py, zoom } = panzoom;
    const minX = ( -px ) / zoom;
    const maxX = ( viewBox.w - px ) / zoom;
    const minY = ( -py ) / zoom;
    const maxY = ( viewBox.h - py ) / zoom;

    return (
        <g data-layer="align-guides" pointerEvents="none">
            { typeof guides.x === "number" && (
                <line
                    x1={ guides.x }
                    y1={ minY }
                    x2={ guides.x }
                    y2={ maxY }
                    stroke="#0ea5e9"
                    strokeWidth={ 2 }
                    strokeDasharray="6 6"
                    opacity={ 0.9 }
                />
            ) }
            { typeof guides.y === "number" && (
                <line
                    x1={ minX }
                    y1={ guides.y }
                    x2={ maxX }
                    y2={ guides.y }
                    stroke="#0ea5e9"
                    strokeWidth={ 2 }
                    strokeDasharray="6 6"
                    opacity={ 0.9 }
                />
            ) }
        </g>
    );
}
