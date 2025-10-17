// Tipos base y constantes de layout/estilo compartidas

export type Vec2 = { x: number; y: number };
export type Point = Vec2;

// === Identificadores únicos ===
export type NodeId = number;
export type ActionId = number;
export type ConditionId = number;

// === NODOS RECTÁNGULO ===
// Jerarquía nativa y tamaño cacheado para layout.
export type NodeBox = {
    id: NodeId;
    x: number;
    y: number;
    title: string;
    wrap?: number; // max chars por renglón (default 22)
    colorFill?: string;   // fondo
    colorStroke?: string; // borde
    colorText?: string;   // texto
    // NUEVO: id visible editable por el usuario (no afecta relaciones)
    displayId?: string;
    // (si ya usas w/h cacheados, déjalos aquí si existen)
    w?: number;
    h?: number;
    parentId?: NodeId | null;
};

// === ACCIONES (ÓVALOS) ===
export type ActionLabel = {
    id: ActionId;
    originNodeId: NodeId; // nodo desde el que nace
    x: number;            // centro
    y: number;
    title: string;
    wrap?: number;
    colorFill?: string;
    colorStroke?: string;
    colorText?: string;
};

// === CONDICIONES (ÓVALOS) ===
export type ConditionLabel = {
    id: ConditionId;
    originActionId: ActionId; // acción desde la que nace
    x: number;                // centro
    y: number;
    title: string;
    wrap?: number;
    colorFill?: string;
    colorStroke?: string;
    colorText?: string;
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

export type NodeColorPatch = {
    fill?: string;
    stroke?: string;
    text?: string;
};
  

// === Constantes visuales / layout aproximado ===
export const PAD_X = 12;
export const PAD_Y = 10;

export const TITLE_LINE_H = 22;
export const TITLE_CHAR_W = 9; // ancho aprox por carácter

export const ID_FONT_SIZE = 12;
export const ID_LINE_H = 16;

// === Tamaños mínimos ===
export const MIN_W = 60;
export const MIN_H = 70; // nodos

export const ACTION_MIN_W = 80;
export const ACTION_MIN_H = 44;

export const CONDITION_MIN_W = 70;
export const CONDITION_MIN_H = 40;

// === Layout de contenedores ===
export const CONTAINER_PAD_X = 16;
export const CONTAINER_PAD_Y = 14;
export const CHILD_GAP_X = 12;
export const CHILD_GAP_Y = 12;
