import React, { useEffect, useRef, useState } from "react";
import { btn, menuWrap } from "./styles";

type Props = {
    title: string;
    icon: React.ReactNode;
    disabled?: boolean;
    children: React.ReactNode;
};

export function MenuButton( { title, icon, disabled, children }: Props ) {
    const [ open, setOpen ] = useState( false );
    const ref = useRef<HTMLDivElement | null>( null );

    useEffect( () => {
        function onDocClick( e: MouseEvent ) {
            const t = e.target as Node | null;
            if ( !ref.current || !t ) return;
            if ( !ref.current.contains( t ) ) setOpen( false );
        }
        document.addEventListener( "click", onDocClick );
        return () => document.removeEventListener( "click", onDocClick );
    }, [] );

    return (
        <div ref={ ref } style={ { position: "relative", pointerEvents: "auto" } }>
            <button
                type="button"
                disabled={ disabled }
                title={ title }
                aria-haspopup="menu"
                aria-expanded={ open }
                onClick={ ( e ) => {
                    e.stopPropagation();
                    if ( disabled ) return;
                    setOpen( ( v ) => !v );
                } }
                style={ btn( !disabled ) }
            >
                { icon }
                { title } ▾
            </button>
            { open && (
                <div role="menu" style={ menuWrap } onClick={ ( e ) => e.stopPropagation() }>
                    { children }
                </div>
            ) }
        </div>
    );
}
