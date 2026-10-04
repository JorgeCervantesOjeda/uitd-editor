import { beforeEach, describe, expect, it, vi } from "vitest";
import { D2_LAYOUT_STORAGE_KEY, readD2LayoutPreference, writeD2LayoutPreference } from "./d2LayoutPreference";

describe( "D2 layout preference", () => {
    beforeEach( () => {
        window.localStorage.clear();
        vi.restoreAllMocks();
    } );

    it( "defaults to ELK and persists a valid layout", () => {
        expect( readD2LayoutPreference() ).toBe( "elk" );

        writeD2LayoutPreference( "dagre" );

        expect( window.localStorage.getItem( D2_LAYOUT_STORAGE_KEY ) ).toBe( "dagre" );
        expect( readD2LayoutPreference() ).toBe( "dagre" );
    } );

    it( "ignores invalid values", () => {
        window.localStorage.setItem( D2_LAYOUT_STORAGE_KEY, "invalid" );

        expect( readD2LayoutPreference() ).toBe( "elk" );
    } );

    it( "falls back without breaking the panel when storage is unavailable", () => {
        vi.spyOn( window.localStorage, "getItem" ).mockImplementation( () => {
            throw new Error( "storage unavailable" );
        } );

        expect( readD2LayoutPreference() ).toBe( "elk" );
    } );
} );
