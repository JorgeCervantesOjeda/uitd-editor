// src/components/Canvas/coord.ts
// Helpers de coordenadas para convertir entre
//   - pantalla (clientX, clientY)
//   - sistema de coordenadas del <g> transformado (pan/zoom)
//
// Uso previsto:
//   const { clientToGroupPoint, toSvgPoint } = useCoordHelpers(svgRef, gRef);
//   const gp = clientToGroupPoint(e.clientX, e.clientY);

import type { RefObject } from "react";
import type { Point } from "../../model/types";

/** Tipo mínimo para eventos que aportan clientX/clientY (compatible con React y DOM). */
type ClientXY = { clientX: number; clientY: number };

/**
 * Hook que expone funciones puras de conversión basadas en refs al <svg> y al <g>.
 * - `toSvgPoint`: convierte un punto de pantalla al espacio del <svg> (antes de pan/zoom del <g>).
 * - `clientToGroupPoint`: convierte a coordenadas del <g> (después de pan/zoom).
 */
export function useCoordHelpers(
    svgRef: RefObject<SVGSVGElement | null>,
    gRef: RefObject<SVGGElement | null>
) {
    /**
     * Convierte (clientX, clientY) a coordenadas del <svg> (aplica la inversa de screenCTM del SVG).
     */
    function toSvgPoint( evt: ClientXY ): Point {
        const svg = svgRef.current;
        if ( !svg ) return { x: evt.clientX, y: evt.clientY };

        const pt = svg.createSVGPoint();
        pt.x = evt.clientX;
        pt.y = evt.clientY;

        const ctm = svg.getScreenCTM();
        if ( !ctm ) return { x: evt.clientX, y: evt.clientY };

        const inv = ctm.inverse();
        const p = pt.matrixTransform( inv );
        return { x: p.x, y: p.y };
    }

    /**
     * Convierte (clientX, clientY) a coordenadas del <g> transformado
     * (ya aplicadas las transformaciones de pan/zoom).
     */
    function clientToGroupPoint( clientX: number, clientY: number ): Point {
        const g = gRef.current;
        if ( !g ) return { x: clientX, y: clientY };

        const svg = g.ownerSVGElement as SVGSVGElement | null;
        if ( !svg ) return { x: clientX, y: clientY };

        const pt = svg.createSVGPoint();
        pt.x = clientX;
        pt.y = clientY;

        const ctm = g.getScreenCTM();
        if ( !ctm ) return { x: clientX, y: clientY };

        const inv = ctm.inverse();
        const gp = pt.matrixTransform( inv );
        return { x: gp.x, y: gp.y };
    }

    return { toSvgPoint, clientToGroupPoint };
}
