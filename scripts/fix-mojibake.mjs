import fs from "node:fs";
import path from "node:path";
import {
    ROOT,
    listCandidateFiles,
    readUtf8IfText,
    mojibakeScore,
    bestFixCandidate,
} from "./mojibake-utils.mjs";

let changed = 0;

for ( const file of listCandidateFiles( ROOT ) ) {
    const text = readUtf8IfText( file );
    if ( text == null ) continue;

    const before = mojibakeScore( text );
    if ( before === 0 ) continue;

    const fixed = bestFixCandidate( text );
    if ( fixed.score >= before || fixed.text === text ) continue;

    fs.writeFileSync( file, fixed.text, "utf8" );
    changed++;
    console.log( `fixed: ${path.relative( ROOT, file )} (${before} -> ${fixed.score})` );
}

console.log( `mojibake fix completed. files changed: ${changed}` );

