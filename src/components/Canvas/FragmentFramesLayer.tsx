import { useEffect, useMemo, useRef, useState } from "react";
import { buildFragmentGroups, resolveFragmentTitle } from "../../fragments/fragmentModel";
import { getActionSizeCached, getConditionSizeCached, getNodeSizeCached } from "../../layout/measurement";
import { useAppStore } from "../../state/store";

type FragmentBounds = {
    id: string;
    title: string;
    nodeIds: number[];
    actionIds: number[];
    conditionIds: number[];
    x: number;
    y: number;
    w: number;
    h: number;
};

function expand(
    bounds: { minX: number; minY: number; maxX: number; maxY: number },
    x: number,
    y: number,
    w: number,
    h: number
) {
    bounds.minX = Math.min( bounds.minX, x - w / 2 );
    bounds.minY = Math.min( bounds.minY, y - h / 2 );
    bounds.maxX = Math.max( bounds.maxX, x + w / 2 );
    bounds.maxY = Math.max( bounds.maxY, y + h / 2 );
}

function FragmentTitleInput( props: {
    fragment: FragmentBounds;
    draft: string;
    setDraft: ( value: string ) => void;
    commit: () => void;
    cancel: () => void;
} ) {
    const { fragment, draft, setDraft, commit, cancel } = props;
    const inputRef = useRef<HTMLInputElement | null>( null );

    useEffect( () => {
        inputRef.current?.focus();
        inputRef.current?.select();
    }, [] );

    return (
        <foreignObject
            x={ fragment.x + 8 }
            y={ fragment.y + 5 }
            width={ Math.max( 160, Math.min( fragment.w - 16, 320 ) ) }
            height={ 32 }
            pointerEvents="all"
        >
            <input
                ref={ inputRef }
                value={ draft }
                aria-label="Fragment title"
                onChange={ ( e ) => setDraft( e.currentTarget.value ) }
                onBlur={ commit }
                onKeyDown={ ( e ) => {
                    if ( e.key === "Enter" ) {
                        e.preventDefault();
                        commit();
                    }
                    if ( e.key === "Escape" ) {
                        e.preventDefault();
                        cancel();
                    }
                } }
                style={ {
                    boxSizing: "border-box",
                    width: "100%",
                    height: 28,
                    border: "1px solid #2563eb",
                    borderRadius: 6,
                    padding: "3px 7px",
                    font: "700 15px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto",
                    color: "#0f172a",
                    background: "#ffffff",
                    outline: "2px solid rgba(37, 99, 235, 0.18)",
                } }
            />
        </foreignObject>
    );
}

export function FragmentFramesLayer() {
    const nodes = useAppStore( s => s.nodes );
    const actions = useAppStore( s => s.actions );
    const conditions = useAppStore( s => s.conditions );
    const edges = useAppStore( s => s.edges );
    const canvasDark = useAppStore( s => s.canvasDark );
    const fragmentTitles = useAppStore( s => s.fragmentTitles );
    const setFragmentTitle = useAppStore( s => s.setFragmentTitle );
    const isCanvasLocked = useAppStore( s => s.isCanvasLockedByUITDLLiveSync );

    const [ editingId, setEditingId ] = useState<string | null>( null );
    const [ draft, setDraft ] = useState( "" );
    const framePressRef = useRef<{ id: string; x: number; y: number } | null>( null );

    const fragments = useMemo<FragmentBounds[]>( () => {
        const groups = buildFragmentGroups( { nodes, actions, conditions, edges } );
        const nodesById = new Map( nodes.map( n => [ n.id, n ] ) );
        const actionsById = new Map( actions.map( a => [ a.id, a ] ) );
        const conditionsById = new Map( conditions.map( c => [ c.id, c ] ) );
        const pad = 34;

        return groups
            .map( ( group, idx ) => {
                const bounds = {
                    minX: Number.POSITIVE_INFINITY,
                    minY: Number.POSITIVE_INFINITY,
                    maxX: Number.NEGATIVE_INFINITY,
                    maxY: Number.NEGATIVE_INFINITY,
                };

                for ( const nodeId of group.nodeIds ) {
                    const node = nodesById.get( nodeId );
                    if ( !node ) continue;
                    const m = getNodeSizeCached( node );
                    expand( bounds, node.x, node.y, m.w, m.h );
                }

                for ( const actionId of group.actionIds ) {
                    const action = actionsById.get( actionId );
                    if ( !action ) continue;
                    const m = getActionSizeCached( action );
                    expand( bounds, action.x, action.y, m.w, m.h );
                }

                for ( const conditionId of group.conditionIds ) {
                    const condition = conditionsById.get( conditionId );
                    if ( !condition ) continue;
                    const m = getConditionSizeCached( condition );
                    expand( bounds, condition.x, condition.y, m.w, m.h );
                }

                if ( !Number.isFinite( bounds.minX ) || !Number.isFinite( bounds.minY ) ) return null;

                return {
                    id: group.id,
                    title: resolveFragmentTitle( fragmentTitles, group.id, idx ),
                    nodeIds: group.nodeIds,
                    actionIds: group.actionIds,
                    conditionIds: group.conditionIds,
                    x: bounds.minX - pad,
                    y: bounds.minY - pad,
                    w: bounds.maxX - bounds.minX + 2 * pad,
                    h: bounds.maxY - bounds.minY + 2 * pad,
                };
            } )
            .filter( ( fragment ): fragment is FragmentBounds => fragment != null );
    }, [ nodes, actions, conditions, edges, fragmentTitles ] );

    const commitEdit = () => {
        if ( !editingId ) return;
        if ( isCanvasLocked ) {
            setEditingId( null );
            return;
        }
        const title = draft.trim();
        const fragment = fragments.find( f => f.id === editingId );
        setFragmentTitle( editingId, title || fragment?.title || "Fragment" );
        setEditingId( null );
    };

    const cancelEdit = () => {
        setEditingId( null );
    };

    const selectFragment = ( fragment: FragmentBounds ) => {
        useAppStore.setState( {
            selection: new Set( fragment.nodeIds ),
            selectionActions: new Set( fragment.actionIds ),
            selectionConds: new Set( fragment.conditionIds ),
            focusTarget:
                fragment.nodeIds[ 0 ] != null
                    ? { kind: "node", id: fragment.nodeIds[ 0 ] }
                    : fragment.actionIds[ 0 ] != null
                        ? { kind: "action", id: fragment.actionIds[ 0 ] }
                        : fragment.conditionIds[ 0 ] != null
                            ? { kind: "condition", id: fragment.conditionIds[ 0 ] }
                            : null,
            keyboardMarquee: null,
            marqueeSeed: null,
        } );
    };

    const stroke = canvasDark ? "#93c5fd" : "#2563eb";
    const fill = canvasDark ? "rgba(59, 130, 246, 0.08)" : "rgba(37, 99, 235, 0.05)";
    const labelBg = canvasDark ? "#0b1220" : "#ffffff";

    useEffect( () => {
        if ( isCanvasLocked ) setEditingId( null );
    }, [ isCanvasLocked ] );

    if ( fragments.length === 0 ) return null;

    return (
        <g data-layer="fragment-frames" aria-hidden="true">
            { fragments.map( ( fragment ) => {
                const isEditing = editingId === fragment.id;

                return (
                    <g key={ fragment.id }>
                        <rect
                            x={ fragment.x }
                            y={ fragment.y }
                            width={ fragment.w }
                            height={ fragment.h }
                            rx={ 10 }
                            ry={ 10 }
                            fill={ fill }
                            stroke={ stroke }
                            strokeWidth={ 2 }
                            strokeDasharray="12 8"
                            pointerEvents="all"
                            style={ { cursor: "pointer" } }
                            onMouseDown={ ( e ) => {
                                if ( e.button !== 0 ) {
                                    framePressRef.current = null;
                                    return;
                                }
                                framePressRef.current = {
                                    id: fragment.id,
                                    x: e.clientX,
                                    y: e.clientY,
                                };
                            } }
                            onMouseUp={ ( e ) => {
                                if ( e.button !== 0 ) return;

                                const press = framePressRef.current;
                                framePressRef.current = null;
                                if ( !press || press.id !== fragment.id ) return;

                                const dx = e.clientX - press.x;
                                const dy = e.clientY - press.y;
                                const moved = Math.hypot( dx, dy );
                                if ( moved > 4 ) return;

                                e.preventDefault();
                                selectFragment( fragment );
                            } }
                        />
                        { isEditing ? (
                            <FragmentTitleInput
                                fragment={ fragment }
                                draft={ draft }
                                setDraft={ setDraft }
                                commit={ commitEdit }
                                cancel={ cancelEdit }
                            />
                        ) : (
                            <text
                                x={ fragment.x + 14 }
                                y={ fragment.y + 22 }
                                fontSize={ 15 }
                                fontFamily="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto"
                                fontWeight={ 700 }
                                fill={ stroke }
                                stroke={ labelBg }
                                strokeWidth={ 4 }
                                paintOrder="stroke"
                                pointerEvents="all"
                                style={ { cursor: "text", userSelect: "none" } }
                                onDoubleClick={ ( e ) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if ( isCanvasLocked ) return;
                                    setEditingId( fragment.id );
                                    setDraft( fragment.title );
                                } }
                            >
                                { fragment.title }
                            </text>
                        ) }
                    </g>
                );
            } ) }
        </g>
    );
}
