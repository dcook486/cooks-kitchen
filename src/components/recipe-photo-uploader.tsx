"use client";

import { FormEvent, useState } from "react";
import { saveRecipePhotoPath } from "@/app/recipes/actions";
import { createClient } from "@/lib/supabase/client";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

type Props = {
  recipeId: string;
  householdId: string;
  hasPhoto?: boolean;
};

export function RecipePhotoUploader({ recipeId, householdId, hasPhoto = false }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!file) {
      setError("Choose a photo first.");
      return;
    }

    const extension = EXTENSIONS[file.type];
    if (!extension) {
      setError("Use a JPG, PNG, or WebP image.");
      return;
    }

    if (file.size > MAX_FILE_BYTES) {
      setError("Keep recipe photos under 5 MB.");
      return;
    }

    setUploading(true);
    const supabase = createClient();
    const path = `${householdId}/${recipeId}/${crypto.randomUUID()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("recipe-photos")
      .upload(path, file, { contentType: file.type, upsert: false, cacheControl: "3600" });

    if (uploadError) {
      setError(uploadError.message);
      setUploading(false);
      return;
    }

    try {
      const formData = new FormData();
      formData.set("id", recipeId);
      formData.set("path", path);
      await saveRecipePhotoPath(formData);
      window.location.assign(`/recipes/${recipeId}?photo=1`);
    } catch (saveError) {
      await supabase.storage.from("recipe-photos").remove([path]);
      setError(saveError instanceof Error ? saveError.message : "Could not save that photo.");
      setUploading(false);
    }
  }

  return (
    <form className="recipe-photo-upload-form" onSubmit={handleSubmit}>
      <input
        className="recipe-photo-file"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        disabled={uploading}
      />
      <button className="secondary" type="submit" disabled={uploading}>
        {uploading ? "Uploading…" : hasPhoto ? "Replace photo" : "Upload photo"}
      </button>
      {error && <span className="recipe-photo-error">{error}</span>}
    </form>
  );
}
