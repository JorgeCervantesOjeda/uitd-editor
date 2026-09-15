// src/test/setup.ts
// Resets shared test state across browser-like and Node test environments.
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach( () => {
    cleanup();
    if ( typeof localStorage !== "undefined" ) localStorage.clear();
    vi.restoreAllMocks();
} );
