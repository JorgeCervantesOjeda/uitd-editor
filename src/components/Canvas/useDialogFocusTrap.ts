import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE_SELECTOR = [
    'button:not([disabled])',
    'a[href]',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
].join( "," );

function getFocusableElements( root: HTMLElement | null ) {
    if ( !root ) return [];
    return Array.from( root.querySelectorAll<HTMLElement>( FOCUSABLE_SELECTOR ) )
        .filter( ( el ) => !el.hasAttribute( "disabled" ) && el.getAttribute( "aria-hidden" ) !== "true" );
}

export function useDialogFocusTrap( open: boolean, containerRef: RefObject<HTMLElement | null> ) {
    const previousFocusRef = useRef<HTMLElement | null>( null );
    const wasOpenRef = useRef( false );

    useEffect( () => {
        if ( open && !wasOpenRef.current ) {
            previousFocusRef.current = document.activeElement instanceof HTMLElement
                ? document.activeElement
                : null;

            const id = window.requestAnimationFrame( () => {
                const root = containerRef.current;
                const items = getFocusableElements( root );
                ( items[ 0 ] ?? root )?.focus();
            } );

            wasOpenRef.current = true;
            return () => window.cancelAnimationFrame( id );
        }

        if ( !open && wasOpenRef.current ) {
            wasOpenRef.current = false;
            const previous = previousFocusRef.current;
            previousFocusRef.current = null;
            if ( previous ) {
                const id = window.requestAnimationFrame( () => previous.focus() );
                return () => window.cancelAnimationFrame( id );
            }
        }

        return undefined;
    }, [ containerRef, open ] );

    useEffect( () => {
        if ( !open ) return;

        function onKeyDown( e: KeyboardEvent ) {
            if ( e.key !== "Tab" ) return;
            const root = containerRef.current;
            const items = getFocusableElements( root );
            if ( !root ) return;

            if ( items.length === 0 ) {
                e.preventDefault();
                root.focus();
                return;
            }

            const first = items[ 0 ];
            const last = items[ items.length - 1 ];
            const active = document.activeElement as HTMLElement | null;

            if ( e.shiftKey ) {
                if ( active === first || !root.contains( active ) ) {
                    e.preventDefault();
                    last.focus();
                }
                return;
            }

            if ( active === last ) {
                e.preventDefault();
                first.focus();
            }
        }

        document.addEventListener( "keydown", onKeyDown, true );
        return () => document.removeEventListener( "keydown", onKeyDown, true );
    }, [ containerRef, open ] );
}
