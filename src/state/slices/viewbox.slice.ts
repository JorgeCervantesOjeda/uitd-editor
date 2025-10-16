import type { AppState } from "../types";

export const viewboxSlice = ( set: any ) =>
( {
    setViewBox: ( w: number, h: number ) => set( { viewBox: { w, h } } ),
} satisfies Partial<AppState> );
