import type { AppState } from "../types";

type SetState = ( partial: Partial<AppState> | ( ( s: AppState ) => Partial<AppState> ) ) => void;

export const viewboxSlice = ( set: SetState, _get: () => AppState ) =>
{
    void _get;
    return ( {
        setViewBox: ( w: number, h: number ) => set( { viewBox: { w, h } } ),
    } satisfies Partial<AppState> );
};
