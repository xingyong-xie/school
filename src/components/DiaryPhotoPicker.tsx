"use client";

import { useState } from "react";

const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
const MAX_TOTAL_PHOTOS = 6;

type ExistingPhoto = { id: number; url: string };

export function DiaryPhotoPicker({
  existing = [],
  maxTotal = MAX_TOTAL_PHOTOS,
}: {
  existing?: ExistingPhoto[];
  maxTotal?: number;
}) {
  const [removedIds, setRemovedIds] = useState<number[]>([]);
  const [error, setError] = useState("");
  const [hint, setHint] = useState("");

  const kept = existing.filter((photo) => !removedIds.includes(photo.id));
  const remaining = Math.max(0, maxTotal - kept.length);

  function toggleRemove(id: number) {
    setError("");
    setRemovedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }

  function handleFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const files = Array.from(input.files ?? []);
    if (!files.length) {
      setHint("");
      return;
    }

    if (files.length > remaining) {
      setError(`每篇日记最多 ${maxTotal} 张照片，本次还能添加 ${remaining} 张`);
      input.value = "";
      setHint("");
      return;
    }
    const tooLarge = files.find((file) => file.size > MAX_PHOTO_BYTES);
    if (tooLarge) {
      setError(`「${tooLarge.name}」超过 2MB，请压缩后重试`);
      input.value = "";
      setHint("");
      return;
    }
    const notImage = files.find((file) => !file.type.startsWith("image/"));
    if (notImage) {
      setError("仅支持 JPG / PNG / WebP / GIF 图片");
      input.value = "";
      setHint("");
      return;
    }

    setError("");
    setHint(`已选择 ${files.length} 张新照片，保存后生效`);
  }

  return (
    <div className="photo-picker-wrap">
      {existing.length ? (
        <div className="photo-picker">
          {existing.map((photo) => {
            const isRemoved = removedIds.includes(photo.id);
            return (
              <div
                key={photo.id}
                className={`photo-item ${isRemoved ? "photo-item--removed" : ""}`}
              >
                <img src={photo.url} alt="" className="diary-photo-thumb" />
                <button
                  type="button"
                  className="photo-remove"
                  title={isRemoved ? "恢复这张照片" : "移除这张照片"}
                  onClick={() => toggleRemove(photo.id)}
                >
                  {isRemoved ? "↺" : "×"}
                </button>
                {isRemoved ? (
                  <>
                    <input type="hidden" name="removePhotoIds" value={photo.id} />
                    <span className="photo-removed-label">待移除</span>
                  </>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      <div className="photo-picker">
        <label className="btn btn-secondary btn-sm">
          + 添加照片
          <input
            type="file"
            name="photos"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            className="file-hidden"
            onChange={handleFiles}
          />
        </label>
        <span className="muted small">
          最多 {maxTotal} 张，每张不超过 2MB，单次合计不超过 8MB
        </span>
      </div>

      {hint ? <div className="muted small">{hint}</div> : null}
      {error ? <div className="form-error">{error}</div> : null}
    </div>
  );
}
