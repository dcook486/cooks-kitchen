"use client";

import { useState } from "react";
import { deleteAccount } from "@/app/profile/actions";

type Props = {
  consequence: string;
};

export function DeleteAccountForm({ consequence }: Props) {
  const [confirmation, setConfirmation] = useState("");

  return (
    <form
      className="delete-account-form"
      action={deleteAccount}
      onSubmit={(event) => {
        if (confirmation !== "DELETE") {
          event.preventDefault();
          return;
        }
        const confirmed = window.confirm(`Permanently delete your Cook's Kitchen account? ${consequence}`);
        if (!confirmed) event.preventDefault();
      }}
    >
      <label>
        Type <strong>DELETE</strong> to confirm
        <input
          name="confirmation"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          autoComplete="off"
          spellCheck={false}
          placeholder="DELETE"
        />
      </label>
      <button className="delete-account-button" type="submit" disabled={confirmation !== "DELETE"}>
        Delete my account
      </button>
    </form>
  );
}
