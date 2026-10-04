#!/usr/bin/env node
// scripts/validate-uitd.mjs
// Runs the canonical UITDL validator owned by this project.

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { parseUITDL } from '../src/validation/uitdlCanonical/index.js';

export const ERROR_SEVERITY = 8;

const readStdin = async( stdin ) => {
    const chunks = [];

    for await( const chunk of stdin ) {
        chunks.push( chunk );
    }

    return chunks.join( '' );
};

export const normalizeArgs = ( args ) => {
    const json = args.includes( '--json' );
    const files = args.filter( arg => arg !== '--json' );

    return { json, files };
};

const getCandidateBaseDirs = () => {
    const npmPackageJson = process.env.npm_package_json ?
        path.dirname( process.env.npm_package_json ) :
        null;

    return [
        process.cwd(),
        process.env.INIT_CWD || null,
        process.env.npm_config_local_prefix || null,
        npmPackageJson,
        process.env.PWD || null,
    ].filter( ( value, index, values ) => value && values.indexOf( value ) === index );
};

const resolveInputFile = ( inputPath ) => {
    if( path.isAbsolute( inputPath ) ) {
        return inputPath;
    }

    const candidates = getCandidateBaseDirs()
        .map( baseDir => path.resolve( baseDir, inputPath ) );
    const resolved = candidates.find( candidate => existsSync( candidate ) );

    if( resolved ) {
        return resolved;
    }

    const attemptedPaths = candidates.join( ', ' );
    throw new Error( `Unable to resolve "${inputPath}". Tried: ${attemptedPaths}` );
};

const sortMarkers = ( markers ) =>
    [ ...markers ].sort( ( left, right ) => {
        if( left.startLineNumber !== right.startLineNumber ) {
            return left.startLineNumber - right.startLineNumber;
        }

        return ( left.startColumn || 0 ) - ( right.startColumn || 0 );
    } );

const formatSeverity = ( severity ) =>
    severity >= ERROR_SEVERITY ? 'ERROR' : 'WARNING';

const toCliLines = ( label, markers ) =>
    sortMarkers( markers )
.map( marker => {
        const line = marker.startLineNumber ?? 0;
        const column = marker.startColumn ?? 0;

        return `${formatSeverity( marker.severity )} ${label}:${line}:${column} ${marker.message}`;
    } );

export const validateSource = ( label, source ) => {
    const parsed = parseUITDL( source );
    const markers = sortMarkers( parsed.errors );
    const hasErrors = markers.some( marker => marker.severity >= ERROR_SEVERITY );

    return {
        file: label,
        markers,
        hasErrors,
        parsedName: parsed.name,
    };
};

export const formatTextResults = ( results ) =>
    results.map( result => {
        if( result.markers.length === 0 ) {
            return `${result.file}: no validation issues.`;
        }

        return toCliLines( result.file, result.markers )
.join( '\n' );
    } )
.join( '\n' );

export const runCli = async( {
    args = process.argv.slice( 2 ),
    stdin = process.stdin,
    stdout = process.stdout,
    stderr = process.stderr,
} = {} ) => {
    const { json, files } = normalizeArgs( args );
    const results = [];

    if( files.length === 0 ) {
        if( stdin.isTTY ) {
            stderr.write( 'Usage: npm run validate:uitd -- <file.uitd> [more files] [--json]\n' );
            stderr.write( '   or: <command producing UITDL> | npm run validate:uitd -- [--json]\n' );
            return { results, exitCode: 1, output: '' };
        }

        const source = await readStdin( stdin );
        results.push( validateSource( '<stdin>', source ) );
    } else {
        for( const file of files ) {
            const resolvedFile = resolveInputFile( file );
            const source = await readFile( resolvedFile, 'utf8' );
            results.push( validateSource( file, source ) );
        }
    }

    const output = json ?
        JSON.stringify( results, null, 2 ) :
        formatTextResults( results );

    if( json ) {
        stdout.write( `${output}\n` );
    } else {
        stdout.write( `${output}\n` );
    }

    return {
        results,
        output,
        exitCode: results.some( result => result.hasErrors ) ? 1 : 0,
    };
};

const isDirectRun = process.argv[ 1 ] &&
    path.resolve( process.argv[ 1 ] ) === fileURLToPath( import.meta.url );

if( isDirectRun ) {
    runCli()
.then( ( { exitCode } ) => {
        process.exitCode = exitCode;
    } )
.catch( error => {
        process.stderr.write( `${error.message}\n` );
        process.exit( 1 );
    } );
}


