import type { AppState } from "../../state/types";
import { parseUITDL } from "./parser";
import { buildProjectFromAST } from "./build";

export function importUITDL( text: string, base: AppState ) {
    const ast = parseUITDL( text );
    console.log( "AST summary:",
        ast.uiBlocks.map( u => ( { key: u.key, name: u.name, actions: u.actions?.length ?? 0 } ) ),
        ast.fragments.map( ( f, i ) => ( { i, draw: f.draw.length, trans: f.transitions.length } ) )
    );
    const project = buildProjectFromAST( ast, base );
    console.log( "Built summary:", {
        nodes: project.nodes.length,
        actions: project.actions.length,
        conditions: project.conditions.length,
        edges: project.edges.length,
    } );
    return project;
}
  