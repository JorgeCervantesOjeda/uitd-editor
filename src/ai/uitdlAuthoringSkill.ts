// src/ai/uitdlAuthoringSkill.ts
// Bundles the complete local UITDL authoring skill as review context for AI requests.

import skillMarkdown from "./skills/uitdl-authoring/SKILL.md?raw";
import grammarReferenceMarkdown from "./skills/uitdl-authoring/references/uitdl-grammar-and-validation.md?raw";

export const UITDL_AUTHORING_SKILL_CONTEXT = [
    "# Bundled skill: uitd-authoring/SKILL.md",
    "",
    skillMarkdown,
    "",
    "# Bundled skill reference: uitd-authoring/references/uitdl-grammar-and-validation.md",
    "",
    grammarReferenceMarkdown,
].join( "\n" );

