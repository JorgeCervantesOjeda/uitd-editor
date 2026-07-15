// src/components/UITDLTextPanel/uitdlLanguage.test.ts
// Verifies the Monaco UITDL language provider through its registered public behavior.

import type { Monaco } from "@monaco-editor/react";
import type { editor, languages, Position } from "monaco-editor";
import { describe, expect, it } from "vitest";
import {
    registerUITDLLanguage,
    shouldTriggerUITDLFieldCompletion,
    shouldTriggerUIIDCompletion,
} from "./uitdlLanguage";

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

    it( "requests suggestions when the cursor is on an editable UITDL field", () => {
        const lineContent = '        TRANSITION from 2 to 0 if user clicks "target";';

        expect( shouldTriggerUITDLFieldCompletion(
            lineContent,
            lineContent,
            1,
            30
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

        const defaultLineContent = "TRANS";
        const defaultPosition = {
            lineNumber: 1,
            column: defaultLineContent.length + 1,
        } as Position;
        const defaultModel = {
            getValue: () => defaultLineContent,
            getLineContent: () => defaultLineContent,
            getWordUntilPosition: () => ( {
                word: "TRANS",
                startColumn: 1,
                endColumn: defaultLineContent.length + 1,
            } ),
        } as unknown as editor.ITextModel;
        const defaultResult = await completionProvider?.provideCompletionItems(
            defaultModel,
            defaultPosition,
            {
                triggerKind: monaco.languages.CompletionTriggerKind.TriggerCharacter,
                triggerCharacter: "S",
            },
            { isCancellationRequested: false, onCancellationRequested: () => ( { dispose: () => undefined } ) }
        );
        const snippetsByLabel = new Map(
            defaultResult?.suggestions.map( suggestion => [ suggestion.label, suggestion.insertText ] )
        );

        expect( snippetsByLabel.get( "TRANSITION" ) ).toBe(
            "TRANSITION from ${1:0} to ${2:0} if user ${3:clicks} \"${4:target}\";"
        );
        expect( snippetsByLabel.get( "FRAGMENT block" ) ).toContain(
            "TRANSITION from ${3:0} to ${4:0} if user ${5:clicks} \"${6:target}\";"
        );

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

        const completedModel = `UITD "Example" {
    UI 1 "Start" actions { clicks "Continue"; }
    UI 2 "Destination" actions {}

    FRAGMENT "Flow" {
        DRAW { 1, 2 };
        TRANSITION from 1 to 0 if user clicks "Continue";
    }
}`;
        const destinationLineNumber = 7;
        const destinationLineContent = completedModel.split( "\n" )[ destinationLineNumber - 1 ];
        const destinationColumn = destinationLineContent.indexOf( "0 if user" ) + 1;
        const destinationPosition = {
            lineNumber: destinationLineNumber,
            column: destinationColumn,
        } as Position;
        const completedResult = await completionProvider?.provideCompletionItems(
            {
                getValue: () => completedModel,
                getLineContent: () => destinationLineContent,
                getWordUntilPosition: () => ( {
                    word: "0",
                    startColumn: destinationColumn,
                    endColumn: destinationColumn + 1,
                } ),
            } as unknown as editor.ITextModel,
            destinationPosition,
            {
                triggerKind: monaco.languages.CompletionTriggerKind.TriggerCharacter,
                triggerCharacter: "0",
            },
            { isCancellationRequested: false, onCancellationRequested: () => ( { dispose: () => undefined } ) }
        );

        expect( completedResult?.suggestions.map( suggestion => suggestion.insertText ) ).toEqual( [ "1", "2" ] );
        expect( completedResult?.suggestions.map( suggestion => suggestion.filterText ) ).toEqual( [ "0", "0" ] );
        expect( completedResult?.suggestions[ 0 ].range ).toEqual( {
            startLineNumber: destinationLineNumber,
            endLineNumber: destinationLineNumber,
            startColumn: destinationColumn,
            endColumn: destinationColumn + 1,
        } );
    } );
} );
