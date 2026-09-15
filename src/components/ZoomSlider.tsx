// src/components/ZoomSlider.tsx
// Provides an accessible zoom control shared by diagram viewports.

import { useId } from "react";
import "./ZoomSlider.css";

type Props = {
    className?: string;
    disabled?: boolean;
    maxPercent: number;
    minPercent: number;
    onChange: ( zoomPercent: number ) => void;
    onFitToWidth?: () => void;
    valuePercent: number;
};

export function ZoomSlider( {
    className = "",
    disabled = false,
    maxPercent,
    minPercent,
    onChange,
    onFitToWidth,
    valuePercent,
}: Props ) {
    const inputId = useId();
    const roundedPercent = Math.round( valuePercent );

    return (
        <div className={ `zoomSlider ${className}`.trim() }>
            <label className="zoomSlider__label" htmlFor={ inputId }>Zoom</label>
            <input
                id={ inputId }
                type="range"
                min={ minPercent }
                max={ maxPercent }
                step={ 1 }
                value={ roundedPercent }
                disabled={ disabled }
                aria-label="Zoom"
                aria-valuetext={ `${roundedPercent}%` }
                onChange={ event => onChange( Number( event.target.value ) ) }
            />
            <output className="zoomSlider__value" htmlFor={ inputId }>{ roundedPercent }%</output>
            { onFitToWidth && (
                <button
                    type="button"
                    className="zoomSlider__fit"
                    disabled={ disabled }
                    onClick={ onFitToWidth }
                    title="Fit diagram to viewport width"
                    aria-label="Fit diagram to viewport width"
                >
                    100%
                </button>
            ) }
        </div>
    );
}
