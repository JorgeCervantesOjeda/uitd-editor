#!/usr/bin/env node
// scripts/sync-uitdl-authoring-skill.mjs
// Copies the global UITDL authoring skill into the generated app bundle input.

import { copyFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname( fileURLToPath( import.meta.url ) );
const repositoryRoot = path.resolve( scriptDirectory, '..' );
const configuredSkillRoot = process.env.UITDL_AUTHORING_SKILL_ROOT?.trim();
const defaultSkillRoot = path.resolve( repositoryRoot, '..', '..', 'codex', 'skills', 'uitdl-authoring' );
const sourceSkillRoot = path.resolve( repositoryRoot, configuredSkillRoot || defaultSkillRoot );
const generatedSkillRoot = path.join( repositoryRoot, 'src', 'ai', 'generated', 'uitdl-authoring' );

const skillFiles = [
    'SKILL.md',
    path.join( 'references', 'uitdl-grammar-and-validation.md' ),
];

const describeError = ( error ) => error instanceof Error ? error.message : String( error );

const assertRegularFile = async( filePath ) => {
    const fileStats = await stat( filePath );
    if ( !fileStats.isFile() ) {
        throw new Error( `Expected a regular file but found another filesystem entry: ${filePath}` );
    }
};

const syncSkill = async() => {
    console.info( `[uitdl-authoring-sync] source=${sourceSkillRoot}` );
    console.info( `[uitdl-authoring-sync] destination=${generatedSkillRoot}` );

    for ( const relativeFile of skillFiles ) {
        const sourceFile = path.join( sourceSkillRoot, relativeFile );
        const generatedFile = path.join( generatedSkillRoot, relativeFile );

        await assertRegularFile( sourceFile );
        await mkdir( path.dirname( generatedFile ), { recursive: true } );
        await copyFile( sourceFile, generatedFile );
        console.info( `[uitdl-authoring-sync] copied=${relativeFile}` );
    }
};

syncSkill().catch( error => {
    console.error( '[uitdl-authoring-sync] ERROR: global skill synchronization failed.' );
    console.error( `[uitdl-authoring-sync] cause=${describeError( error )}` );
    console.error( '[uitdl-authoring-sync] fallback=none' );
    console.error( '[uitdl-authoring-sync] impact=dev, test, build, and deploy are aborted.' );
    process.exitCode = 1;
} );
