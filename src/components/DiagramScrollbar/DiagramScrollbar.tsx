import { clampScroll, normalizeWheelDelta } from "./diagramCameraMetrics";
import "./DiagramScrollbar.css";

type Props = {
    ariaLabel: string;
    className?: string;
    emptyValueText: string;
    max: number;
    onChange: ( value: number ) => void;
    orientation: "horizontal" | "vertical";
    pageSize: number;
    value: number;
};

export function DiagramScrollbar( {
    ariaLabel,
    className = "",
    emptyValueText,
    max,
    onChange,
    orientation,
    pageSize,
    value,
}: Props ) {
    const finiteMax = Number.isFinite( max ) ? Math.max( 0, max ) : 0;
    const disabled = finiteMax <= 0;
    const clampedValue = clampScroll( value, finiteMax );

    return (
        <input
            className={ `diagramScrollbar diagramScrollbar--${orientation} ${className}`.trim() }
            type="range"
            min={ 0 }
            max={ Math.max( 1, finiteMax ) }
            step={ 1 }
            value={ disabled ? 0 : clampedValue }
            disabled={ disabled }
            aria-label={ ariaLabel }
            aria-orientation={ orientation }
            aria-valuetext={ disabled
                ? emptyValueText
                : `${Math.round( clampedValue )} of ${Math.round( finiteMax )}` }
            onChange={ event => onChange( Number( event.target.value ) ) }
            onWheel={ event => {
                event.preventDefault();
                event.stopPropagation();
                if ( disabled ) return;
                onChange( clampedValue + normalizeWheelDelta( event, orientation, pageSize ) );
            } }
        />
    );
}

export function DiagramScrollbarCorner() {
    return <div className="diagramScrollbarCorner" aria-hidden="true" />;
}
