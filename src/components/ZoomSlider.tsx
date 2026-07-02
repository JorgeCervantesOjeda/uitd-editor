// src/components/ZoomSlider.tsx
// Provides an accessible zoom control shared by diagram viewports.

import "./ZoomSlider.css";

type Props = {
    className?: string;
    disabled?: boolean;
    maxPercent: number;
    minPercent: number;
    onChange: ( zoomPercent: number ) => void;
    valuePercent: number;
};

export function ZoomSlider( {
    className = "",
    disabled = false,
    maxPercent,
    minPercent,
    onChange,
    valuePercent,
}: Props ) {
    const roundedPercent = Math.round( valuePercent );

    return (
        <label className={ `zoomSlider ${className}`.trim() }>
            <span className="zoomSlider__label">Zoom</span>
            <input
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
            <output className="zoomSlider__value">{ roundedPercent }%</output>
        </label>
    );
}
