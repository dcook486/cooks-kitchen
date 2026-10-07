"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { deleteRecipeFromDetail, removeRecipePhotoNow } from "@/app/recipes/actions";
import { RecipePhotoUploader } from "@/components/recipe-photo-uploader";
import { Toast, ToastRegion } from "@/components/toast";
import { flushRecipeChange, useUndoable } from "@/lib/use-undoable";

/**
 * "Delete recipe" sends you back to the recipe bank, where the recipe is hidden and an
 * Undo toast appears; the real delete runs only after the undo window. Without JavaScript
 * the form falls back to the immediate server delete.
 */
export function DeleteRecipeButton({ recipeId }: { recipeId: string }) {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);

  return (
    <form
      action={deleteRecipeFromDetail}
      onSubmit={(event) => {
        event.preventDefault();
        setLeaving(true);
        router.push(`/?section=recipes&deleted=${encodeURIComponent(recipeId)}`);
      }}
    >
      <input type="hidden" name="id" value={recipeId} />
      <button className="danger-link" type="submit" disabled={leaving} aria-busy={leaving || undefined}>
        {leaving ? "Deleting…" : "Delete recipe"}
      </button>
    </form>
  );
}

type PhotoProps = {
  recipeId: string;
  householdId: string;
  recipeName: string;
  imageUrl: string | null;
};

/** Recipe photo block with "Remove photo" that can be undone for a few seconds. */
export function RecipePhotoSection({ recipeId, householdId, recipeName, imageUrl }: PhotoProps) {
  const router = useRouter();
  const [error, setError] = useState("");
  const removal = useUndoable<{ id: string }>({
    commit: async (item) => {
      const result = await removeRecipePhotoNow(item.id);
      if (!result.ok) setError("Couldn’t remove the photo, so it’s back. Try again in a moment.");
      router.refresh();
      return result.ok;
    },
    flush: (item) => flushRecipeChange("remove_photo", item.id),
  });

  const showPhoto = Boolean(imageUrl) && !removal.isHidden(recipeId);

  return (
    <>
      {showPhoto && imageUrl ? (
        <section className="recipe-photo-block">
          <div className="recipe-user-photo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt={recipeName} />
          </div>
          <div className="recipe-photo-controls">
            <RecipePhotoUploader recipeId={recipeId} householdId={householdId} hasPhoto />
            <button className="text-button" type="button" onClick={() => { setError(""); removal.start({ id: recipeId }); }}>Remove photo</button>
          </div>
        </section>
      ) : (
        <section className="recipe-photo-prompt">
          <div>
            <p className="eyebrow">OPTIONAL PHOTO</p>
            <h3>Add your own photo</h3>
            <p>Use a photo of your family&apos;s version instead of relying on an image hosted by the recipe website.</p>
          </div>
          {removal.pending ? (
            <p className="recipe-photo-pending-note">Photo removed. You can undo for a few seconds.</p>
          ) : (
            <RecipePhotoUploader recipeId={recipeId} householdId={householdId} />
          )}
        </section>
      )}

      <ToastRegion>
        {removal.pending && (
          <Toast
            key="photo-undo"
            message="Photo removed"
            tone="info"
            duration={7000}
            actionLabel="Undo"
            onAction={removal.undo}
            onDismiss={removal.expire}
          />
        )}
        {error && <Toast key={error} message={error} tone="error" duration={7000} onDismiss={() => setError("")} />}
      </ToastRegion>
    </>
  );
}

/** Shows a one-time success toast (e.g. after ?saved=1) and removes the flag from the URL so refresh doesn't repeat it. */
export function FlashToast({ message, params }: { message: string; params: string[] }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const url = new URL(window.location.href);
    let changed = false;
    for (const param of params) {
      if (url.searchParams.has(param)) {
        url.searchParams.delete(param);
        changed = true;
      }
    }
    if (changed) window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  }, [params]);

  if (!visible) return null;
  return (
    <ToastRegion>
      <Toast message={message} onDismiss={() => setVisible(false)} />
    </ToastRegion>
  );
}
