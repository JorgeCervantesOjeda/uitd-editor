export type UiActionDecl = { verb: string; complement: string; raw: string };
export type UiBlock = { key: string; name?: string; actions: UiActionDecl[] };

export type UiRef = { key: string; children: UiRef[] };

export type TransitionAST = {
    from: UiRef;
    to: UiRef;
    actionRaw: string;      // "verb complement" (verb en minúsculas, complemento sin comillas)
    condLabel?: string;     // undefined | "" | "empty" -> tratado como sin condición en builder
};

export type FragmentAST = {
    name: string;
    draw: UiRef[];          // bosque del fragmento
    transitions: TransitionAST[];
};

export type UITDLDoc = {
    title: string;
    uiBlocks: UiBlock[];
    fragments: FragmentAST[];
};
