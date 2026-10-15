import React from "react";
import { FileToolbar } from "../../FileToolbar";

type Props = {
    readOnly?: boolean;
};

export function FileMenu( { readOnly = false }: Props ) {
    return (
        <div style={ { padding: 4, width: 70 } }>
            <FileToolbar readOnly={ readOnly } />
        </div>
    );
}
