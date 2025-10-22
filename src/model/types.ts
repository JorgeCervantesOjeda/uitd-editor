// Tipos base y constantes de layout/estilo compartidas

export type Vec2 = { x: number; y: number };
export type Point = Vec2;

// === Identificadores únicos ===
export type NodeId = number;
export type ActionId = number;
export type ConditionId = number;

// === NODOS RECTÁNGULO ===
export type NodeBox = {
    id: NodeId;
    x: number;
    y: number;
    title: string;
    wrap?: number; // max chars por renglón
    colorFill?: string;
    colorStroke?: string;
    colorText?: string;
    displayId?: string; // visible/editalble
    w?: number;
    h?: number;
    parentId?: NodeId | null;
};

// === ACCIONES (ÓVALOS) / CONDICIONES (ÓVALOS) ===
export type ActionLabel = {
    id: ActionId;
    originNodeId: NodeId;
    x: number; y: number;
    title: string;
    wrap?: number;
    colorFill?: string; colorStroke?: string; colorText?: string;
};

export type ConditionLabel = {
    id: ConditionId;
    originActionId: ActionId;
    x: number; y: number;
    title: string;
    wrap?: number;
    colorFill?: string; colorStroke?: string; colorText?: string;
};

// === ARISTAS ===
export type EdgeEndpoint =
    | { kind: "node"; id: NodeId }
    | { kind: "action"; id: ActionId }
    | { kind: "condition"; id: ConditionId };

export type EdgeStyle = "solid" | "dashed1" | "dashed2";

export type Edge = {
    id: number;
    from: EdgeEndpoint;
    to: EdgeEndpoint;
    style: EdgeStyle;
};

export type NodeColorPatch = { fill?: string; stroke?: string; text?: string };

// === Constantes visuales / layout aproximado ===
export const PAD_X = 12;
export const PAD_Y = 10;

export const TITLE_LINE_H = 22;
export const TITLE_CHAR_W = 9;

export const ID_FONT_SIZE = 12;
export const ID_LINE_H = 16;

// === Tamaños mínimos genéricos (legacy) ===
export const MIN_W = 60;
export const MIN_H = 70;

// === Óvalos ===
export const ACTION_MIN_W = 80;
export const ACTION_MIN_H = 44;

export const CONDITION_MIN_W = 70;
export const CONDITION_MIN_H = 40;

// === Layout de contenedores ===
export const CONTAINER_PAD_X = 16;
// PAD_Y general para cajas, pero para hijos usaremos asimétricos:
export const CONTAINER_PAD_Y = 14;
export const CHILD_GAP_X = 12;
export const CHILD_GAP_Y = 12;

// === Nodo / header ===
export const NODE_WRAP_DEFAULT = 22;
export const NODE_MIN_H = 40;
export const NODE_BOTTOM_PAD = 4;

// Separación entre cabezal y bloque de hijos
export const CONTAINER_HEADER_GAP_Y = 4; // antes 10

// NUEVO: padding del bloque de hijos (asimétrico)
export const CONTAINER_CHILDREN_TOP_PAD = 2;     // casi pegado al header
export const CONTAINER_CHILDREN_BOTTOM_PAD = 14; // respiro inferior
