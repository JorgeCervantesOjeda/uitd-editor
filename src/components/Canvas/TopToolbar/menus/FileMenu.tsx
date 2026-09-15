import React from "react";
import { FileToolbar } from "../../FileToolbar";

type Props = {
    onRequestClose?: () => void;
    readOnly?: boolean;
};

export function FileMenu( { onRequestClose, readOnly = false }: Props ) {
    return (
        <div style={ { padding: 4, width: 70 } }>
            <FileToolbar onRequestClose={ onRequestClose } readOnly={ readOnly } />
        </div>
    );
}
