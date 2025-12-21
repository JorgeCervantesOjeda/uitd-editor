// src/import/uitdl/types.ts
import type { UiVerb } from "../../model/uiVerbs";

export type UiActionDecl = { verb: UiVerb; complement: string; raw: string };
export type UiBlock = { key: string; name?: string; actions: UiActionDecl[] };

export type UiRef = { key: string; children: UiRef[] };

export type TransitionAST = {
    from: UiRef;
    to: UiRef;

    verb: UiVerb;
    complement: string;     // sin comillas

    actionRaw: string;      // compat/debug: `${verb} ${complement}` (sin comillas)
    condLabel?: string;
    width?: number;
};

export type FragmentAST = {
    name: string;
    draw: UiRef[];
    transitions: TransitionAST[];
    widthDefault?: number;
};

export type ParseIssue = {
    kind: "error" | "warning";
    message: string;
    line?: number;
    col?: number;
};

export type UITDLDoc = {
    title: string;
    uiBlocks: UiBlock[];
    fragments: FragmentAST[];
    issues?: ParseIssue[];
};
