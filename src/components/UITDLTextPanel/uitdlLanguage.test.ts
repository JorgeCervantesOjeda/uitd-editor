// src/components/UITDLTextPanel/uitdlLanguage.test.ts
// Verifies the Monaco UITDL language provider through its registered public behavior.

import type { Monaco } from "@monaco-editor/react";
import type { editor, languages, Position } from "monaco-editor";
import { describe, expect, it } from "vitest";
import { registerUITDLLanguage, shouldTriggerUIIDCompletion } from "./uitdlLanguage";

const MODEL = `UITD "Example" {
    UI 1 "Start" actions { clicks "Continue"; }
    UI 2 "Destination" actions {}

    FRAGMENT "Flow" {
        DRAW { 1, 2 };
        TRANSITION from 1
    }
}`;

describe( "registerUITDLLanguage", () => {
    it( "requests automatic suggestions after a numeric UIID character", () => {
        const lineNumber = 7;
        const lineContent = MODEL.split( "\n" )[ lineNumber - 1 ];

        expect( shouldTriggerUIIDCompletion(
            MODEL,
            lineContent,
            lineNumber,
            lineContent.length + 1,
            "1"
        ) ).toBe( true );
    } );

    it( "suggests fragment UIIDs when a digit triggers transition completion", async () => {
        let completionProvider: languages.CompletionItemProvider | undefined;
        const monaco = {
            languages: {
                register: () => undefined,
                setMonarchTokensProvider: () => undefined,
                setLanguageConfiguration: () => undefined,
                registerCompletionItemProvider: (
                    _languageId: string,
                    provider: languages.CompletionItemProvider
                ) => {
                    completionProvider = provider;
                    return { dispose: () => undefined };
                },
                registerHoverProvider: () => ( { dispose: () => undefined } ),
                registerFoldingRangeProvider: () => ( { dispose: () => undefined } ),
                registerDocumentFormattingEditProvider: () => ( { dispose: () => undefined } ),
                CompletionItemInsertTextRule: { InsertAsSnippet: 4 },
                CompletionItemKind: { Snippet: 27, Keyword: 17, Reference: 18, Value: 12 },
                CompletionTriggerKind: { TriggerCharacter: 1 },
                FoldingRangeKind: { Region: { value: "region" } },
            },
            Range: class {},
        } as unknown as Monaco;

        registerUITDLLanguage( monaco );

        const lineNumber = 7;
        const lineContent = MODEL.split( "\n" )[ lineNumber - 1 ];
        const position = { lineNumber, column: lineContent.length + 1 } as Position;
        const model = {
            getValue: () => MODEL,
            getLineContent: () => lineContent,
            getWordUntilPosition: () => ( {
                word: "1",
                startColumn: lineContent.length,
                endColumn: lineContent.length + 1,
            } ),
        } as unknown as editor.ITextModel;
        const result = await completionProvider?.provideCompletionItems(
            model,
            position,
            {
                triggerKind: monaco.languages.CompletionTriggerKind.TriggerCharacter,
                triggerCharacter: "1",
            },
            { isCancellationRequested: false, onCancellationRequested: () => ( { dispose: () => undefined } ) }
        );

        expect( result?.suggestions.map( suggestion => suggestion.insertText ) ).toEqual( [ "1", "2" ] );
    } );
} );
