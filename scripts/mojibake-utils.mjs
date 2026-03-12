import fs from "node:fs";
import path from "node:path";

export const ROOT = process.cwd();

export const TEXT_EXT = new Set( [
    ".ts", ".tsx", ".js", ".mjs", ".cjs",
    ".json", ".md", ".txt", ".css", ".html", ".svg",
    ".yml", ".yaml", ".d2", ".xml",
] );

const IGNORE_DIRS = new Set( [
    ".git",
    "node_modules",
    "dist",
    ".firebase",
] );

const MOJIBAKE_PATTERNS = [
    /\u00C3[\u0080-\u00BF]/g,
    /\u00C2[\u0080-\u00BF]/g,
    /\u00E2[\u0080-\u00BF]{1,2}/g,
    /\uFFFD/g,
];

function isProbablyTextBuffer( buf ) {
    if ( buf.length === 0 ) return true;
    let nul = 0;
    for ( const b of buf ) if ( b === 0 ) nul++;
    return nul === 0;
}

export function listCandidateFiles( dir = ROOT ) {
    const out = [];
    const stack = [ dir ];

    while ( stack.length ) {
        const cur = stack.pop();
        const entries = fs.readdirSync( cur, { withFileTypes: true } );
        for ( const ent of entries ) {
            const abs = path.join( cur, ent.name );
            if ( ent.isDirectory() ) {
                if ( IGNORE_DIRS.has( ent.name ) ) continue;
                stack.push( abs );
                continue;
            }
            if ( !ent.isFile() ) continue;
            if ( !TEXT_EXT.has( path.extname( ent.name ).toLowerCase() ) ) continue;
            out.push( abs );
        }
    }
    return out;
}

export function readUtf8IfText( file ) {
    const buf = fs.readFileSync( file );
    if ( !isProbablyTextBuffer( buf ) ) return null;
    return buf.toString( "utf8" );
}

export function mojibakeScore( text ) {
    let score = 0;
    for ( const re of MOJIBAKE_PATTERNS ) {
        const m = text.match( re );
        if ( m ) score += m.length;
    }
    return score;
}

export function bestFixCandidate( original ) {
    let best = original;
    let bestScore = mojibakeScore( original );

    let cur = original;
    for ( let i = 0; i < 2; i++ ) {
        const next = Buffer.from( cur, "latin1" ).toString( "utf8" );
        const nextScore = mojibakeScore( next );
        if ( nextScore < bestScore ) {
            best = next;
            bestScore = nextScore;
        }
        cur = next;
    }
    return { text: best, score: bestScore };
}

