// src/validation/uitdlCanonical/index.js
// Canonical project-owned UITDL parser and semantic validator.

export { parseUITDL, validVerbs } from './TokenParser.js';
export { tokenize } from './lexer.js';
export { validateData } from './validation.js';
export { Token, TokenType, Tokens } from './tokens.js';
export {
    debounce,
    formatDrawRef,
    formatUIRef,
    getInnermostUIRef,
    getInnermostUIStr
} from './utils.js';


