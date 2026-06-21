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
                code: "ACTION_UNUSED",
                message: "Unused action: clicks \"Save\" does not trigger any transition.",
                ref: { kind: "action", id: 7 },
                fragmentTitle: "File flow",
                refLabel: "Action clicks \"Save\" in UI 12 \"Save project\"",
            },
            {
                kind: "warning",
                code: "UI_UNREACHABLE",
                message: "UIID 4 is unreachable.",
                ref: { kind: "node", id: 4 },
                fragmentTitle: "D2 diagram",
                refLabel: "UI 4 \"D2 diagram\"",
            },
        ];

        const report = formatValidationIssuesForClipboard( issues );

        expect( report ).toContain( "Validation report" );
        expect( report ).toContain( "Errors: 1" );
        expect( report ).toContain( "Warnings: 1" );
        expect( report ).toContain(
            "1. [ACTION_UNUSED] Unused action: clicks \"Save\" does not trigger any transition. (Action clicks \"Save\" in UI 12 \"Save project\", Fragment \"File flow\")",
        );
        expect( report ).toContain(
            "1. [UI_UNREACHABLE] UIID 4 is unreachable. (UI 4 \"D2 diagram\", Fragment \"D2 diagram\")",
        );
    } );
} );
