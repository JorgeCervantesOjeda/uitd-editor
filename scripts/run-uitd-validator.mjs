#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath( import.meta.url );
const __dirname = path.dirname( __filename );
const repoRoot = path.resolve( __dirname, ".." );

const candidateValidatorPaths = [
    process.env.UITDL_VALIDATE_SCRIPT,
    process.env.UITDL_VALIDATOR_SCRIPT,
    path.resolve( repoRoot, "..", "..", "UITD text language", "uitd-editor", "scripts", "validate-uitd.js" ),
].filter( Boolean );

const validatorScript = candidateValidatorPaths.find( ( candidate ) => existsSync( candidate ) );

if ( !validatorScript ) {
    console.error(
        [
            "Unable to locate the external UITDL validator.",
            "Looked for:",
            ...candidateValidatorPaths.map( ( candidate ) => `- ${candidate}` ),
            'Set UITDL_VALIDATE_SCRIPT to the shared validate-uitd.js path if needed.',
        ].join( "\n" )
    );
    process.exit( 1 );
}

const child = spawn(
    process.execPath,
    [ validatorScript, ...process.argv.slice( 2 ) ],
    { stdio: "inherit" }
);

child.on( "exit", ( code, signal ) => {
    if ( signal ) {
        process.kill( process.pid, signal );
        return;
    }
    process.exit( code ?? 1 );
} );

child.on( "error", ( err ) => {
    console.error( err instanceof Error ? err.message : String( err ) );
    process.exit( 1 );
} );
