// src/ai/uitdlAuthoringSkill.ts
// Bundles the global UITDL authoring skill generated before app workflows run.

import skillMarkdown from "./generated/uitdl-authoring/SKILL.md?raw";
import grammarReferenceMarkdown from "./generated/uitdl-authoring/references/uitdl-grammar-and-validation.md?raw";

export const UITDL_AUTHORING_SKILL_CONTEXT = [
    "# Bundled skill: uitd-authoring/SKILL.md",
    "",
    skillMarkdown,
    "",
    "# Bundled skill reference: uitd-authoring/references/uitdl-grammar-and-validation.md",
    "",
    grammarReferenceMarkdown,
].join( "\n" );

