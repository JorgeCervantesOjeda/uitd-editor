// src/components/UITDLTextPanel/uitdlLanguage.ts
// Registers the UITDL language tokens and basic authoring completions in Monaco.
import type { Monaco } from "@monaco-editor/react";
import type { editor, languages, Position } from "monaco-editor";

const UITDL_LANGUAGE_ID = "uitdl";
let isRegistered = false;

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
    } );

    monaco.languages.registerCompletionItemProvider( UITDL_LANGUAGE_ID, {
        provideCompletionItems: ( model: editor.ITextModel, position: Position ) => {
            const word = model.getWordUntilPosition( position );
            const range = {
                startLineNumber: position.lineNumber,
                endLineNumber: position.lineNumber,
                startColumn: word.startColumn,
                endColumn: word.endColumn,
            };
            const keywords = [
                "UITD", "UI", "FRAGMENT", "DRAW", "TRANSITION", "WIDTH", "AND",
                "clicks", "submits", "selects", "types", "toggles", "uploads",
                "downloads", "saves", "deletes", "waits",
            ];
            const suggestions: languages.CompletionItem[] = keywords.map( keyword => ( {
                label: keyword,
                kind: monaco.languages.CompletionItemKind.Keyword,
                insertText: keyword,
                range,
            } ) );

            suggestions.push( {
                label: "UITD model",
                kind: monaco.languages.CompletionItemKind.Snippet,
                insertText: [
                    "UITD \"${1:Title}\" {",
                    "    UI ${2:1} \"${3:Start}\" actions {",
                    "        clicks \"${4:Continue}\";",
                    "    }",
                    "    UI ${5:2} \"${6:Destination}\" actions {",
                    "    }",
                    "",
                    "    FRAGMENT \"${7:Flow}\" {",
                    "        DRAW { ${2:1}, ${5:2} };",
                    "        TRANSITION from ${2:1} to ${5:2} if user clicks \"${4:Continue}\";",
                    "    }",
                    "}",
                ].join( "\n" ),
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                range,
            } );

            return { suggestions };
        },
    } );

    isRegistered = true;
}

export { UITDL_LANGUAGE_ID };
