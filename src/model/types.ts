// Tipos base y constantes de layout/estilo compartidas

export type NodeId = number;
export type ActionId = number;

// === NODOS RECTÁNGULO ===
export type NodeBox = {
    id: NodeId;
    x: number;
    y: number;
    title: string;
    wrap?: number; // max chars por renglón (default 22)
};

// === ACCIONES (ÓVALOS) ===
export type ActionLabel = {
    id: ActionId;
    originNodeId: NodeId; // nodo desde el que nace
    x: number;            // para acciones guardamos el CENTRO (cx, cy)
    y: number;
    title: string;        // etiqueta de acción
    wrap?: number;        // max chars por renglón (default 22)
};

// === ARISTAS ===
// Por ahora: node->action (solid) y action->node (dashed)
export type EdgeEndpoint =
    | { kind: "node"; id: NodeId }
    | { kind: "action"; id: ActionId };

export type EdgeStyle = "solid" | "dashed1";

export type Edge = {
    id: number;
    from: EdgeEndpoint;
    to: EdgeEndpoint;
    style: EdgeStyle;
};

// === Constantes visuales / layout aproximado para medición ===
export const PAD_X = 12;
export const PAD_Y = 10;

export const TITLE_LINE_H = 22;
export const TITLE_CHAR_W = 9; // ancho aprox por carácter (estimación)

export const ID_FONT_SIZE = 12;
export const ID_LINE_H = 16;   // <-- FALTABA: altura de línea para la fila de "id=.."

export const MIN_W = 60;
export const MIN_H = 70; // nodos rectángulo

// Para óvalos de acción: mínimos cómodos
export const ACTION_MIN_W = 80;
export const ACTION_MIN_H = 44;
