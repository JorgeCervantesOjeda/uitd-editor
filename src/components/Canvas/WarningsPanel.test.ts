// src/components/Canvas/WarningsPanel.test.ts
// Tests clipboard-ready validation report formatting.

import { describe, expect, it } from "vitest";
import type { DiagramIssue } from "../../validation/diagramValidation";
import { formatValidationIssuesForClipboard } from "./WarningsPanelClipboard";

describe( "formatValidationIssuesForClipboard", () => {
    it( "formats errors, warnings, codes and issue locations", () => {
        const issues: DiagramIssue[] = [
            {
                kind: "error",
                code: "invalid-uiid",
                message: "Invalid UIID \"01\": UI IDs must not contain leading zeros.",
                source: "canvas-model",
                ref: { kind: "node", id: 7 },
                fragmentTitle: "File flow",
                refLabel: "UI 01 \"Save project\"",
            },
            {
                kind: "warning",
                code: "unused-action",
                message: "Unused action: \"clicks \"Save\"\" in UI \"12\".",
                source: "canvas-model",
                ref: { kind: "action", id: 4 },
                fragmentTitle: "D2 diagram",
                refLabel: "Action clicks \"Save\" in UI 12 \"Save project\"",
            },
        ];

        const report = formatValidationIssuesForClipboard( issues );

        expect( report ).toContain( "Validation report" );
        expect( report ).toContain( "Source: Canvas model" );
        expect( report ).toContain( "Errors: 1" );
        expect( report ).toContain( "Warnings: 1" );
        expect( report ).toContain(
            "1. [invalid-uiid] Invalid UIID \"01\": UI IDs must not contain leading zeros. (UI 01 \"Save project\", Fragment \"File flow\")",
        );
        expect( report ).toContain(
            "1. [unused-action] Unused action: \"clicks \"Save\"\" in UI \"12\". (Action clicks \"Save\" in UI 12 \"Save project\", Fragment \"D2 diagram\")",
        );
    } );
} );
