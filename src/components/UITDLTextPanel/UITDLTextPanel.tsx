// src/components/UITDLTextPanel/UITDLTextPanel.tsx
// Provides validated textual UITDL editing and explicit application to the visual model.
import Editor, { type Monaco, type OnMount } from "@monaco-editor/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { editor } from "monaco-editor";
import { exportToUITDL } from "../../export/uitdl";
import { importUITDL } from "../../import/uitdl";
import { validateWithOfficialValidator } from "../../import/uitdl/officialValidator";
import type { ParseIssue } from "../../import/uitdl/types";
import { useAppStore } from "../../state/store";
import { registerUITDLLanguage, UITDL_LANGUAGE_ID } from "./uitdlLanguage";
import "./UITDLTextPanel.css";

const DRAFT_STORAGE_KEY = "uitd-editor/uitdl-text-draft";

type Props = {
    onClose: () => void;
};

type Status = {
    kind: "info" | "success" | "error";
    message: string;
};

function readStoredDraft(): string | null {
    try {
        return localStorage.getItem( DRAFT_STORAGE_KEY );
    } catch ( error ) {
        console.warn( "[UITDL text] Draft recovery unavailable; using the current diagram.", {
            cause: error,
            fallback: "Export the current visual diagram as the initial text.",
            impact: "An earlier textual draft cannot be restored.",
        } );
        return null;
    }
}

function saveDraft( text: string ) {
    try {
        localStorage.setItem( DRAFT_STORAGE_KEY, text );
    } catch ( error ) {
        console.warn( "[UITDL text] Draft persistence failed.", {
            cause: error,
            fallback: "Keep the draft in component memory.",
            impact: "The draft may be lost when the page closes.",
        } );
    }
}

function waitForVisibleFeedback(): Promise<void> {
    return new Promise( resolve => {
        window.requestAnimationFrame( () => {
            window.requestAnimationFrame( () => resolve() );
        } );
    } );
}

function applyProjectToStore( project: ReturnType<typeof importUITDL> ) {
    const state = useAppStore.getState();
    state.commitEditingSession?.();
    state.captureDelta( [ "nodes", "actions", "conditions", "edges" ], () => {
        useAppStore.setState( current => ( {
            ...current,
            nodes: project.nodes,
            actions: project.actions,
            conditions: project.conditions,
            edges: project.edges,
            fragmentTitles: project.fragmentTitles ?? {},
            nextId: project.nextId,
            nextActionId: project.nextActionId,
            nextEdgeId: project.nextEdgeId,
            selection: new Set<number>(),
            selectionActions: new Set<number>(),
            selectionConds: new Set<number>(),
            focusTarget: null,
            keyboardMarquee: null,
            marqueeSeed: null,
            pendingConnect: null,
            dragHoverParent: null,
            editingSession: null,
        } ) );
    } );
}

function issueLocation( issue: ParseIssue ): string {
    if ( issue.line == null ) return "General";
    return issue.col == null ? `L${issue.line}` : `L${issue.line}:C${issue.col}`;
}

export function UITDLTextPanel( { onClose }: Props ) {
    const initialDiagramTextRef = useRef( exportToUITDL( useAppStore.getState() ) );
    const storedDraftRef = useRef( readStoredDraft() );
    const [ text, setText ] = useState( storedDraftRef.current ?? initialDiagramTextRef.current );
    const [ appliedText, setAppliedText ] = useState( initialDiagramTextRef.current );
    const [ status, setStatus ] = useState<Status | null>(
        storedDraftRef.current && storedDraftRef.current !== initialDiagramTextRef.current
            ? { kind: "info", message: "Recovered a textual draft. Apply it to update the diagram." }
            : null
    );
    const [ isApplying, setIsApplying ] = useState( false );
    const editorRef = useRef<editor.IStandaloneCodeEditor | null>( null );
    const monacoRef = useRef<Monaco | null>( null );

    const issues = useMemo( () => validateWithOfficialValidator( text ), [ text ] );
    const errors = useMemo( () => issues.filter( issue => issue.kind === "error" ), [ issues ] );
    const warnings = useMemo( () => issues.filter( issue => issue.kind === "warning" ), [ issues ] );
    const isDirty = text !== appliedText;

    const updateMarkers = useCallback( () => {
        const monaco = monacoRef.current;
        const model = editorRef.current?.getModel();
        if ( !monaco || !model ) return;
        monaco.editor.setModelMarkers(
            model,
            UITDL_LANGUAGE_ID,
            issues.map( issue => ( {
                severity: issue.kind === "error"
                    ? monaco.MarkerSeverity.Error
                    : monaco.MarkerSeverity.Warning,
                message: issue.message,
                startLineNumber: issue.line ?? 1,
                startColumn: issue.col ?? 1,
                endLineNumber: issue.line ?? 1,
                endColumn: Math.max( 2, ( issue.col ?? 1 ) + 1 ),
            } ) )
        );
    }, [ issues ] );

    useEffect( () => {
        saveDraft( text );
        updateMarkers();
    }, [ text, updateMarkers ] );

    const handleMount: OnMount = ( mountedEditor, monaco ) => {
        editorRef.current = mountedEditor;
        monacoRef.current = monaco;
        registerUITDLLanguage( monaco );
        monaco.editor.setModelLanguage( mountedEditor.getModel()!, UITDL_LANGUAGE_ID );
        updateMarkers();
    };

    const applyText = async () => {
        if ( errors.length > 0 || isApplying || !isDirty ) return;
        setIsApplying( true );
        setStatus( { kind: "info", message: "Applying validated UITDL to the diagram…" } );
        await waitForVisibleFeedback();

        try {
            const project = importUITDL( text, useAppStore.getState() );
            applyProjectToStore( project );
            setAppliedText( text );
            setStatus( {
                kind: "success",
                message: warnings.length > 0
                    ? `Applied with ${warnings.length} warning(s).`
                    : "UITDL applied to the diagram.",
            } );
        } catch ( error ) {
            console.error( "[UITDL text] Applying the text failed.", error );
            setStatus( {
                kind: "error",
                message: error instanceof Error ? error.message : "Could not apply the UITDL text.",
            } );
        } finally {
            setIsApplying( false );
        }
    };

    const reloadFromDiagram = () => {
        if ( isDirty && !window.confirm( "Discard the current textual draft and reload the diagram?" ) ) return;
        const diagramText = exportToUITDL( useAppStore.getState() );
        setText( diagramText );
        setAppliedText( diagramText );
        setStatus( { kind: "info", message: "Text reloaded from the current diagram." } );
    };

    const focusIssue = ( issue: ParseIssue ) => {
        if ( issue.line == null ) return;
        editorRef.current?.setPosition( { lineNumber: issue.line, column: issue.col ?? 1 } );
        editorRef.current?.revealLineInCenter( issue.line );
        editorRef.current?.focus();
    };

    return (
        <aside className="uitdlTextPanel" aria-label="UITDL text editor">
            <header className="uitdlTextPanel__header">
                <div>
                    <strong>UITDL text</strong>
                    <span className="uitdlTextPanel__summary">
                        { errors.length } error(s), { warnings.length } warning(s)
                        { isDirty ? " · Pending changes" : " · Synchronized" }
                    </span>
                </div>
                <button type="button" onClick={ onClose } aria-label="Close UITDL text editor">×</button>
            </header>

            <div className="uitdlTextPanel__actions">
                <button type="button" onClick={ reloadFromDiagram } disabled={ isApplying }>
                    Reload from diagram
                </button>
                <button
                    type="button"
                    className="uitdlTextPanel__apply"
                    onClick={ applyText }
                    disabled={ errors.length > 0 || isApplying || !isDirty }
                >
                    { isApplying ? "Applying…" : "Apply to diagram" }
                </button>
            </div>

            { status && (
                <div className={ `uitdlTextPanel__status is-${status.kind}` } role="status">
                    <span>{ status.message }</span>
                    <button type="button" onClick={ () => setStatus( null ) } aria-label="Dismiss status">×</button>
                </div>
            ) }

            <div className="uitdlTextPanel__editor">
                <Editor
                    defaultLanguage={ UITDL_LANGUAGE_ID }
                    value={ text }
                    onChange={ value => setText( value ?? "" ) }
                    onMount={ handleMount }
                    loading="Loading UITDL editor…"
                    options={ {
                        automaticLayout: true,
                        minimap: { enabled: false },
                        fontSize: 14,
                        tabSize: 4,
                        insertSpaces: true,
                        wordWrap: "on",
                        folding: true,
                        suggestOnTriggerCharacters: true,
                        scrollBeyondLastLine: false,
                    } }
                />
            </div>

            { issues.length > 0 && (
                <section className="uitdlTextPanel__issues" aria-label="UITDL diagnostics">
                    { issues.map( ( issue, index ) => (
                        <button
                            type="button"
                            key={ `${issue.kind}-${issue.line ?? 0}-${issue.col ?? 0}-${index}` }
                            className={ `uitdlTextPanel__issue is-${issue.kind}` }
                            onClick={ () => focusIssue( issue ) }
                        >
                            <strong>{ issue.kind === "error" ? "Error" : "Warning" } { issueLocation( issue ) }</strong>
                            <span>{ issue.message }</span>
                        </button>
                    ) ) }
                </section>
            ) }
        </aside>
    );
}
