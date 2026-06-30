// src/components/UITDLTextPanel/uitdlLanguage.ts
// Registers contextual completion, hover, folding, formatting, and tokens for UITDL in Monaco.

import type { Monaco } from "@monaco-editor/react";
import type { editor, languages, Position } from "monaco-editor";
import { formatUITDL } from "./formatUITDL";
import {
    collectFragmentTransitionReferences,
    collectUIContext,
    findCompletionContext,
    innermostUIId,
} from "./uitdlLanguageContext";

const UITDL_LANGUAGE_ID = "uitdl";
const VERBS = [
    "clicks", "submits", "selects", "types", "toggles",
    "uploads", "downloads", "saves", "deletes", "waits",
];
let isRegistered = false;

function completionRange( position: Position, startColumn: number, endColumn: number ) {
    return {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn,
        endColumn,
    };
}

function staticSuggestions( monaco: Monaco, range: languages.CompletionItem[ "range" ] ) {
    const snippet = monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet;
    return [
        {
            label: "UITD model",
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: [
                "UITD \"${1:Title}\" {",
                "    UI ${2:1} \"${3:Start}\" actions {",
                "        clicks \"${4:Continue}\";",
                "    }",
                "    UI ${5:2} \"${6:Destination}\" actions {}",
                "",
                "    FRAGMENT \"${7:Flow}\" {",
                "        DRAW { ${2:1}, ${5:2} };",
                "        TRANSITION from ${2:1} to ${5:2} if user clicks \"${4:Continue}\";",
                "    }",
                "}",
            ].join( "\n" ),
            insertTextRules: snippet,
            documentation: "Create a complete UITDL model.",
            range,
        },
        {
            label: "UI block",
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: "UI ${1:id} \"${2:name}\" actions {\n    ${3}\n}",
            insertTextRules: snippet,
            documentation: "Define a UI and its available actions.",
            range,
        },
        {
            label: "FRAGMENT block",
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: "FRAGMENT \"${1:name}\" {\n    DRAW { ${2:ids} };\n    TRANSITION from ${3:from} to ${4:to} if user ${5:clicks} \"${6:target}\";\n}",
            insertTextRules: snippet,
            documentation: "Define one connected UITDL fragment.",
            range,
        },
        {
            label: "TRANSITION",
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: "TRANSITION from ${1:from} to ${2:to} if user ${3:clicks} \"${4:target}\";",
            insertTextRules: snippet,
            documentation: "Define a transition between drawn UI references.",
            range,
        },
        {
            label: "AND condition",
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: "AND \"${1:condition}\"",
            insertTextRules: snippet,
            documentation: "Add a guard evaluated when the action is triggered.",
            range,
        },
        ...VERBS.map( verb => ( {
            label: verb,
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: `${verb} "\${1:target}";`,
            insertTextRules: snippet,
            documentation: `Declare a ${verb} action.`,
            range,
        } ) ),
    ] satisfies languages.CompletionItem[];
}

export function registerUITDLLanguage( monaco: Monaco ) {
    if ( isRegistered ) return;
    monaco.languages.register( { id: UITDL_LANGUAGE_ID } );
    monaco.languages.setMonarchTokensProvider( UITDL_LANGUAGE_ID, {
        tokenizer: {
            root: [
                [ /\b(?:UITD|UI|FRAGMENT|DRAW|TRANSITION|WIDTH|actions|from|to|if|user|AND)\b/, "keyword" ],
                [ /\b(?:clicks|submits|selects|types|toggles|uploads|downloads|saves|deletes|waits)\b/, "type.identifier" ],
                [ /\d+/, "number" ],
                [ /"(?:[^"\\]|\\.)*"/, "string" ],
                [ /[{}[\]();,]/, "delimiter" ],
                [ /[A-Za-z_-]+/, "identifier" ],
            ],
        },
    } );

    monaco.languages.setLanguageConfiguration( UITDL_LANGUAGE_ID, {
        brackets: [ [ "{", "}" ], [ "[", "]" ], [ "(", ")" ] ],
        autoClosingPairs: [
            { open: "{", close: "}" },
            { open: "[", close: "]" },
            { open: "(", close: ")" },
            { open: "\"", close: "\"" },
        ],
        surroundingPairs: [
            { open: "{", close: "}" },
            { open: "[", close: "]" },
            { open: "(", close: ")" },
            { open: "\"", close: "\"" },
        ],
        folding: {
            offSide: false,
            markers: {
                start: /^\s*\/\/\s*#?region\b/,
                end: /^\s*\/\/\s*#?endregion\b/,
            },
        },
    } );

    monaco.languages.registerCompletionItemProvider( UITDL_LANGUAGE_ID, {
        triggerCharacters: [ " ", "\"", "(", "[", "{", ",", ..."0123456789" ],
        provideCompletionItems: (
            model: editor.ITextModel,
            position: Position
        ) => {
            const text = model.getValue();
            const lineContent = model.getLineContent( position.lineNumber );
            const context = findCompletionContext( text, lineContent, position.lineNumber, position.column );
            const word = model.getWordUntilPosition( position );
            const defaultRange = completionRange( position, word.startColumn, word.endColumn );
            if ( !context ) return { suggestions: staticSuggestions( monaco, defaultRange ) };

            const range = completionRange( position, context.startColumn, context.endColumn );
            const uiContexts = collectUIContext( text );
            if ( context.type === "draw-ui" ) {
                return {
                    suggestions: uiContexts.map( ui => ( {
                        label: `${ui.id} · ${ui.name}`,
                        kind: monaco.languages.CompletionItemKind.Reference,
                        insertText: ui.id,
                        detail: `Defined UI ${ui.id}`,
                        documentation: ui.name,
                        range,
                    } ) ),
                };
            }
            if ( context.type === "transition-from" || context.type === "transition-to" ) {
                const references = collectFragmentTransitionReferences( text, position.lineNumber );
                return {
                    suggestions: references.map( reference => {
                        const ui = uiContexts.find( candidate => candidate.id === innermostUIId( reference ) );
                        return {
                            label: `${reference}${ui?.name ? ` · ${ui.name}` : ""}`,
                            kind: monaco.languages.CompletionItemKind.Reference,
                            insertText: reference,
                            detail: "Reference available in this fragment's DRAW",
                            range,
                        };
                    } ),
                };
            }

            const originId = innermostUIId( context.fromReference );
            const origin = uiContexts.find( ui => ui.id === originId );
            if ( context.type === "transition-action" ) {
                const verbs = [ ...new Set( origin?.actions.map( action => action.verb ) ?? []) ];
                return {
                    suggestions: verbs.map( verb => ( {
                        label: verb,
                        kind: monaco.languages.CompletionItemKind.Keyword,
                        insertText: `${verb} "\${1:target}"`,
                        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                        detail: `Action declared by UI ${originId}`,
                        range,
                    } ) ),
                };
            }
            const complements = [ ...new Set(
                origin?.actions
                    .filter( action => action.verb === context.verb )
                    .map( action => action.complement ) ?? []
            ) ];
            return {
                suggestions: complements.map( complement => ( {
                    label: complement,
                    kind: monaco.languages.CompletionItemKind.Value,
                    insertText: complement,
                    detail: `${context.verb} action declared by UI ${originId}`,
                    range,
                } ) ),
            };
        },
    } );

    monaco.languages.registerHoverProvider( UITDL_LANGUAGE_ID, {
        provideHover: ( model: editor.ITextModel, position: Position ) => {
            const word = model.getWordAtPosition( position );
            if ( !word || !/^\d+$/.test( word.word ) ) return null;
            const lineContent = model.getLineContent( position.lineNumber );
            if ( !/\b(?:DRAW\s*\{|TRANSITION\s+from\b)/.test( lineContent ) ) return null;
            const ui = collectUIContext( model.getValue() ).find( candidate => candidate.id === word.word );
            if ( !ui ) return null;
            const actions = ui.actions.length > 0
                ? ui.actions.map( action => `- **${action.verb}** "${action.complement}"` ).join( "\n" )
                : "No declared actions.";
            return {
                range: new monaco.Range(
                    position.lineNumber,
                    word.startColumn,
                    position.lineNumber,
                    word.endColumn
                ),
                contents: [ { value: `**UI ${ui.id} · ${ui.name}**\n\n${actions}` } ],
            };
        },
    } );

    monaco.languages.registerFoldingRangeProvider( UITDL_LANGUAGE_ID, {
        provideFoldingRanges: ( model: editor.ITextModel ) => {
            const ranges: languages.FoldingRange[] = [];
            const stack: number[] = [];
            for ( let line = 1; line <= model.getLineCount(); line++ ) {
                const content = model.getLineContent( line );
                for ( const _match of content.matchAll( /\{/g ) ) {
                    void _match;
                    stack.push( line );
                }
                for ( const _match of content.matchAll( /\}/g ) ) {
                    void _match;
                    const start = stack.pop();
                    if ( start != null && line > start + 1 ) {
                        ranges.push( { start, end: line, kind: monaco.languages.FoldingRangeKind.Region } );
                    }
                }
            }
            return ranges;
        },
    } );

    monaco.languages.registerDocumentFormattingEditProvider( UITDL_LANGUAGE_ID, {
        provideDocumentFormattingEdits: ( model: editor.ITextModel ) => [ {
            range: model.getFullModelRange(),
            text: formatUITDL( model.getValue() ),
        } ],
    } );
    isRegistered = true;
}

export function shouldTriggerUIIDCompletion(
    text: string,
    lineContent: string,
    lineNumber: number,
    column: number,
    typedText: string
): boolean {
    if ( !/^\d$/.test( typedText ) ) return false;
    const context = findCompletionContext( text, lineContent, lineNumber, column );
    return context?.type === "draw-ui" ||
        context?.type === "transition-from" ||
        context?.type === "transition-to";
}

export { UITDL_LANGUAGE_ID };
