import React from "react";
import { FileToolbar } from "../../FileToolbar";

type Props = {
    onRequestClose?: () => void;
};

export function FileMenu( { onRequestClose }: Props ) {
    return (
        <div style={ { padding: 4, width: 70 } }>
            <FileToolbar onRequestClose={ onRequestClose } />
        </div>
    );
}
