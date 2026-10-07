"use client";

import { useSyncExternalStore } from "react";
import {
  dismissInstallHint,
  getInstallHintKind,
  getServerInstallHintKind,
  promptInstall,
  subscribeInstallHint,
} from "@/lib/install-prompt";

/** Small, dismissible "install the app" tip. Hidden when already installed or once dismissed on this device. */
export function InstallHint() {
  const kind = useSyncExternalStore(subscribeInstallHint, getInstallHintKind, getServerInstallHintKind);
  if (kind === "none") return null;

  return (
    <aside className="install-hint" aria-label="Install Cook's Kitchen">
      <span className="install-hint-icon" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="" width={32} height={32} />
      </span>
      <p className="install-hint-copy">
        {kind === "prompt" ? (
          <><strong>Install Cook&apos;s Kitchen</strong> for one-tap access to your plan.</>
        ) : (
          <><strong>Add Cook&apos;s Kitchen to your Home Screen:</strong> tap Share{" "}
            <svg className="install-hint-share" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
              <path d="M12 3v12M7.5 7.5 12 3l4.5 4.5M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>{" "}
            then “Add to Home Screen”.</>
        )}
      </p>
      {kind === "prompt" && (
        <button className="secondary install-hint-action" type="button" onClick={() => void promptInstall()}>Install</button>
      )}
      <button className="install-hint-close" type="button" onClick={dismissInstallHint} aria-label="Dismiss install tip">×</button>
    </aside>
  );
}
