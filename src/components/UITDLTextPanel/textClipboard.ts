// src/components/UITDLTextPanel/textClipboard.ts
// Copies text with an observable legacy fallback for restricted browsers.

export async function copyText( text: string ): Promise<void> {
    if ( navigator.clipboard?.writeText ) {
        try {
            await navigator.clipboard.writeText( text );
            return;
        } catch ( error ) {
            console.warn( "[UITDL text] Clipboard API failed.", {
                cause: error,
                fallback: "Try document.execCommand with a temporary textarea.",
                impact: "The browser may still deny the copy operation.",
            } );
        }
    } else {
        console.info( "[UITDL text] Clipboard API is unavailable.", {
            fallback: "Try document.execCommand with a temporary textarea.",
            impact: "Copy support depends on the browser's legacy clipboard behavior.",
        } );
    }

    const textarea = document.createElement( "textarea" );
    textarea.value = text;
    textarea.setAttribute( "readonly", "" );
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild( textarea );
    textarea.select();

    let copied = false;
    try {
        copied = document.execCommand( "copy" );
    } finally {
        textarea.remove();
    }
    if ( !copied ) {
        throw new Error( "The browser rejected both clipboard methods." );
    }
}
