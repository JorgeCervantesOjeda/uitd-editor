// src/components/Canvas/ElementWidthPreview.tsx
// Renders an editable shape preview sharing the canvas right-edge resize control.

import type { DiagramFocusTarget } from "../../state/types";
import type { MeasuredSize } from "../../layout/measurement";
import { PAD_X, TITLE_LINE_H } from "../../model/types";
import { ElementWidthHandle } from "./ElementWidthHandle";

export function ElementWidthPreview( { target, measured, width, fill = "#f1f5f9", stroke = "#94a3b8", textColor = "#334155" }: {
    target: NonNullable<DiagramFocusTarget>;
    measured: MeasuredSize;
    width?: number;
    fill?: string;
    stroke?: string;
    textColor?: string;
} ) {
    const w = width ?? measured.w;
    const h = measured.h;
    const inset = Math.max( 10, w * 0.175 );
    const textX = target.kind === "node" ? PAD_X : w / 2;
    const textY = target.kind === "node" ? 27 : h / 2 - ( measured.lines.length - 1 ) * TITLE_LINE_H / 2 + 4;
    return (
        <div className="elementWidthPreview">
            <svg width={ w + 16 } height={ h + 16 } viewBox={ `0 0 ${w + 16} ${h + 16}` }
                aria-label={ `${target.kind} preview` }>
                <g transform="translate(8 8)">
                    { target.kind === "node" ? (
                        <rect width={ w } height={ h } rx={ 4 } fill={ fill } stroke={ stroke } strokeWidth={ 4 } />
                    ) : target.kind === "action" ? (
                        <ellipse cx={ w / 2 } cy={ h / 2 } rx={ w / 2 } ry={ h / 2 } fill={ fill } stroke={ stroke } strokeWidth={ 4 } />
                    ) : (
                        <polygon points={ `${inset},0 ${w - inset},0 ${w},${h / 2} ${w - inset},${h} ${inset},${h} 0,${h / 2}` }
                            fill={ fill } stroke={ stroke } strokeWidth={ 4 } />
                    ) }
                    <text x={ textX } y={ textY } textAnchor={ target.kind === "node" ? "start" : "middle" }
                        fontSize={ target.kind === "node" ? 18 : 16 } fill={ textColor }>
                        { measured.lines.map( ( line, index ) => (
                            <tspan key={ index } x={ textX } dy={ index === 0 ? 0 : TITLE_LINE_H }>{ line }</tspan>
                        ) ) }
                    </text>
                    <ElementWidthHandle target={ target } x={ w / 2 } y={ h / 2 } width={ w } height={ h } />
                </g>
            </svg>
        </div>
    );
}
