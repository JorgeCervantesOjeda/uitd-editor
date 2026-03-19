import React, {
    forwardRef,
    useCallback,
    useEffect,
    useId,
    useImperativeHandle,
    useRef,
    useState,
} from "react";
import { btn, menuWrap } from "./styles";

export type MenuButtonHandle = {
    openMenu: ( focus?: "first" | "last" ) => void;
    closeMenu: ( restoreFocus?: boolean ) => void;
    focusTrigger: () => void;
};

type Props = {
    title: string;
    icon: React.ReactNode;
    disabled?: boolean;
    children: React.ReactNode;
};

function getFocusableMenuItems( root: HTMLDivElement | null ) {
    if ( !root ) return [];
    return Array.from(
        root.querySelectorAll<HTMLElement>( 'button:not([disabled]), [role="menuitem"]:not([aria-disabled="true"])' )
    );
}

export const MenuButton = forwardRef<MenuButtonHandle, Props>( function MenuButton( { title, icon, disabled, children }, ref ) {
    const [ open, setOpen ] = useState( false );
    const wrapperRef = useRef<HTMLDivElement | null>( null );
    const buttonRef = useRef<HTMLButtonElement | null>( null );
    const menuRef = useRef<HTMLDivElement | null>( null );
    const pendingFocusRef = useRef<"first" | "last" | null>( null );
    const menuId = useId();

    const focusTrigger = useCallback( () => {
        buttonRef.current?.focus();
    }, [] );

    const closeMenu = useCallback( ( restoreFocus = false ) => {
        setOpen( false );
        pendingFocusRef.current = null;
        if ( restoreFocus ) {
            requestAnimationFrame( () => focusTrigger() );
        }
    }, [ focusTrigger ] );

    const openMenu = useCallback( ( focus: "first" | "last" = "first" ) => {
        if ( disabled ) return;
        pendingFocusRef.current = focus;
        setOpen( true );
    }, [ disabled ] );

    useImperativeHandle( ref, () => ( {
        openMenu,
        closeMenu,
        focusTrigger,
    } ), [ closeMenu, focusTrigger, openMenu ] );

    useEffect( () => {
        function onDocPointerDown( e: PointerEvent ) {
            const t = e.target as Node | null;
            if ( !wrapperRef.current || !t ) return;
            if ( !wrapperRef.current.contains( t ) ) {
                closeMenu( false );
            }
        }

        document.addEventListener( "pointerdown", onDocPointerDown, true );
        return () => {
            document.removeEventListener( "pointerdown", onDocPointerDown, true );
        };
    }, [ closeMenu ] );

    useEffect( () => {
        if ( !open ) return;
        const desired = pendingFocusRef.current;
        if ( !desired ) return;
        const id = window.requestAnimationFrame( () => {
            const items = getFocusableMenuItems( menuRef.current );
            if ( !items.length ) return;
            const target = desired === "last" ? items[ items.length - 1 ] : items[ 0 ];
            target.focus();
            pendingFocusRef.current = null;
        } );
        return () => window.cancelAnimationFrame( id );
    }, [ open ] );

    useEffect( () => {
        if ( !open ) return;
        function onDocKeyDown( e: KeyboardEvent ) {
            if ( e.key !== "Escape" ) return;
            e.preventDefault();
            e.stopPropagation();
            closeMenu( true );
        }
        document.addEventListener( "keydown", onDocKeyDown, true );
        return () => document.removeEventListener( "keydown", onDocKeyDown, true );
    }, [ closeMenu, open ] );

    const onTriggerKeyDown = ( e: React.KeyboardEvent<HTMLButtonElement> ) => {
        if ( disabled ) return;
        if ( e.key === "ArrowDown" ) {
            e.preventDefault();
            openMenu( "first" );
            return;
        }
        if ( e.key === "ArrowUp" ) {
            e.preventDefault();
            openMenu( "last" );
            return;
        }
        if ( e.key === "Enter" || e.key === " " ) {
            e.preventDefault();
            if ( open ) closeMenu( false );
            else openMenu( "first" );
        }
    };

    const onMenuKeyDown = ( e: React.KeyboardEvent<HTMLDivElement> ) => {
        const items = getFocusableMenuItems( menuRef.current );
        if ( !items.length ) return;
        const currentIndex = items.findIndex( ( item ) => item === document.activeElement );

        if ( e.key === "ArrowDown" ) {
            e.preventDefault();
            const next = currentIndex < 0 ? 0 : ( currentIndex + 1 ) % items.length;
            items[ next ].focus();
            return;
        }
        if ( e.key === "ArrowUp" ) {
            e.preventDefault();
            const next = currentIndex < 0 ? items.length - 1 : ( currentIndex - 1 + items.length ) % items.length;
            items[ next ].focus();
            return;
        }
        if ( e.key === "Home" ) {
            e.preventDefault();
            items[ 0 ].focus();
            return;
        }
        if ( e.key === "End" ) {
            e.preventDefault();
            items[ items.length - 1 ].focus();
            return;
        }
        if ( e.key === "Tab" ) {
            closeMenu( false );
        }
    };

    return (
        <div ref={ wrapperRef } style={ { position: "relative", pointerEvents: "auto" } }>
            <button
                ref={ buttonRef }
                type="button"
                disabled={ disabled }
                title={ title }
                aria-haspopup="menu"
                aria-expanded={ open }
                aria-controls={ open ? menuId : undefined }
                onKeyDown={ onTriggerKeyDown }
                onClick={ ( e ) => {
                    e.stopPropagation();
                    if ( disabled ) return;
                    if ( open ) closeMenu( false );
                    else openMenu( "first" );
                } }
                style={ btn( !disabled ) }
            >
                { icon }
                { title }
            </button>
            { open && (
                <div
                    id={ menuId }
                    ref={ menuRef }
                    role="menu"
                    aria-label={ title }
                    style={ menuWrap }
                    onKeyDown={ onMenuKeyDown }
                    onClick={ ( e ) => {
                        e.stopPropagation();
                        const target = e.target as HTMLElement | null;
                        if ( target?.closest( '[role="menuitem"], [data-menu-close="true"]' ) ) {
                            closeMenu( true );
                        }
                    } }
                >
                    { children }
                </div>
            ) }
        </div>
    );
} );
