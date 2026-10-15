// src/components/Canvas/RigidBlockNotice.tsx
// Shows persistent accessible feedback for RigidBlock operations.

import { useAppStore } from "../../state/store";

export function RigidBlockNotice() {
    const notice = useAppStore( state => state.rigidBlockNotice );
    const dismiss = useAppStore( state => state.dismissRigidBlockNotice );

    if ( !notice ) return null;

    return (
        <div className={ `rigidBlockNotice rigidBlockNotice--${notice.kind}` } role="status">
            <span>{ notice.message }</span>
            <button type="button" onClick={ dismiss } aria-label="Dismiss">
                Dismiss
            </button>
        </div>
    );
}
