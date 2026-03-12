import path from "node:path";
import {
    ROOT,
    listCandidateFiles,
    readUtf8IfText,
    mojibakeScore,
} from "./mojibake-utils.mjs";

const offenders = [];

for ( const file of listCandidateFiles( ROOT ) ) {
    const text = readUtf8IfText( file );
    if ( text == null ) continue;
    const score = mojibakeScore( text );
    if ( score > 0 ) {
        offenders.push( { file: path.relative( ROOT, file ), score } );
    }
}

if ( offenders.length > 0 ) {
    console.error( "Mojibake detected in text files:" );
    for ( const o of offenders ) {
        console.error( ` - ${o.file} (score=${o.score})` );
    }
    console.error( "Run: npm run fix:mojibake" );
    process.exit( 1 );
}

console.log( "No mojibake detected." );

