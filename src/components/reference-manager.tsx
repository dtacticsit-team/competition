"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, RefreshCw, Trash2, Upload, X } from "lucide-react";
import { deleteReferenceAction, updateReferenceAction, uploadReferenceAction } from "@/app/actions/admin";
import { imageUrl } from "@/lib/format";
import type { MsgKey } from "@/lib/i18n-shared";
import { REFERENCE_SECTIONS, type ReferenceSection } from "@/lib/sections";
import { useT } from "./i18n-provider";

export type ReferenceItem = { id: string; section: ReferenceSection; imageId: string; fileName: string; note: string | null };

const ACCEPT = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Upload, preview, replace, remove and re-assign design reference images.
 * Files are sent one at a time so a large batch never exceeds the upload limit.
 */
export function ReferenceManager({ items }: { items: ReferenceItem[] }) {
  const t = useT();
  const router = useRouter();
  const [active, setActive] = useState<ReferenceSection>("homepage");
  const [progress, setProgress] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<ReferenceItem | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const addInput = useRef<HTMLInputElement>(null);
  const replaceInput = useRef<HTMLInputElement>(null);
  const replaceTarget = useRef<string | null>(null);

  useEffect(() => {
    if (preview && !dialog.current?.open) dialog.current?.showModal();
  }, [preview]);

  const counts = Object.fromEntries(REFERENCE_SECTIONS.map((s) => [s, items.filter((i) => i.section === s).length]));
  const shown = items.filter((i) => i.section === active);
  const busy = progress !== null;

  async function upload(files: File[], replaceId?: string) {
    if (!files.length || busy) return;
    const failures: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setProgress(t("refs.uploading", { current: i + 1, total: files.length }));
      if (!ACCEPT.includes(file.type) || file.size > MAX_BYTES) {
        failures.push(`${file.name}: ${t(file.size > MAX_BYTES ? "errors.imageTooLarge" : "errors.imageType")}`);
        continue;
      }
      const fd = new FormData();
      fd.set("file", file);
      fd.set("section", active);
      if (replaceId) fd.set("replaceId", replaceId);
      try {
        const res = await uploadReferenceAction(fd);
        if ("error" in res) failures.push(`${file.name}: ${t(res.error as MsgKey)}`);
      } catch {
        failures.push(`${file.name}: ${t("errors.generic")}`);
      }
    }
    setProgress(null);
    setErrors(failures);
    router.refresh();
  }

  async function mutate(action: (fd: FormData) => Promise<void>, fields: Record<string, string>) {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.set(k, v);
    setErrors([]);
    try {
      await action(fd);
    } catch {
      setErrors([t("errors.generic")]);
    }
    router.refresh();
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    void upload(Array.from(e.dataTransfer.files));
  }

  return (
    <div>
      {/* Section picker */}
      <div role="tablist" aria-label={t("refs.sectionsLabel")} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:px-0">
        {REFERENCE_SECTIONS.map((s) => (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={active === s}
            onClick={() => setActive(s)}
            className={`inline-flex min-h-10 shrink-0 cursor-pointer items-center gap-2 rounded-full border px-3.5 text-sm font-semibold transition ${
              active === s ? "border-navy bg-navy text-white" : "border-line bg-paper text-ink/80 hover:border-navy/40"
            }`}
          >
            {t(`refs.sections.${s}`)}
            <span className={`rounded-full px-1.5 text-xs tabular-nums ${active === s ? "bg-white/20" : "bg-sand text-muted"}`}>{counts[s]}</span>
          </button>
        ))}
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`mt-4 flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-5 py-8 text-center transition ${
          dragging ? "border-navy bg-navy/5" : "border-line bg-paper/70"
        }`}
      >
        <Upload className="h-7 w-7 text-navy/70" aria-hidden="true" />
        <p className="text-[15px] font-semibold text-ink">{t("refs.dropTitle", { section: t(`refs.sections.${active}`) })}</p>
        <p className="text-xs text-muted">{t("image.hint")}</p>
        <button type="button" disabled={busy} onClick={() => addInput.current?.click()} className="btn btn-primary">
          {busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Upload className="h-4 w-4" aria-hidden="true" />}
          {t("refs.add")}
        </button>
        <p role="status" aria-live="polite" className="min-h-5 text-sm font-medium text-navy">
          {progress}
        </p>
        <input
          ref={addInput}
          type="file"
          multiple
          accept={ACCEPT.join(",")}
          className="sr-only"
          tabIndex={-1}
          aria-label={t("refs.add")}
          onChange={(e) => {
            void upload(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
        <input
          ref={replaceInput}
          type="file"
          accept={ACCEPT.join(",")}
          className="sr-only"
          tabIndex={-1}
          aria-label={t("refs.replace")}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file && replaceTarget.current) void upload([file], replaceTarget.current);
            e.target.value = "";
          }}
        />
      </div>

      {errors.length > 0 && (
        <ul role="alert" className="mt-4 space-y-1 rounded-xl border border-rose/25 bg-rose/5 px-4 py-3 text-sm font-medium text-rose">
          {errors.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}

      {/* References in the selected section */}
      {shown.length === 0 ? (
        <p className="mt-6 text-center text-[15px] text-muted">{t("refs.empty")}</p>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((item) => (
            <li key={item.id} className="card overflow-hidden">
              <button type="button" onClick={() => setPreview(item)} className="block aspect-[4/3] w-full cursor-zoom-in overflow-hidden bg-sand" aria-label={`${t("refs.preview")}: ${item.fileName}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageUrl(item.imageId, true)} alt="" loading="lazy" className="h-full w-full object-cover object-top transition duration-300 hover:scale-[1.03]" />
              </button>
              <div className="space-y-3 p-3.5">
                <p className="truncate text-sm font-semibold text-ink" title={item.fileName}>
                  {item.fileName}
                </p>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-muted">{t("refs.section")}</span>
                  <select
                    className="input min-h-10 py-1.5 text-sm"
                    value={item.section}
                    onChange={(e) => mutate(updateReferenceAction, { id: item.id, section: e.target.value, note: item.note ?? "" })}
                  >
                    {REFERENCE_SECTIONS.map((s) => (
                      <option key={s} value={s}>
                        {t(`refs.sections.${s}`)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-muted">{t("refs.note")}</span>
                  <input
                    className="input min-h-10 py-1.5 text-sm"
                    defaultValue={item.note ?? ""}
                    maxLength={500}
                    placeholder={t("refs.notePlaceholder")}
                    onBlur={(e) => {
                      if (e.target.value.trim() !== (item.note ?? "")) void mutate(updateReferenceAction, { id: item.id, section: item.section, note: e.target.value });
                    }}
                  />
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      replaceTarget.current = item.id;
                      replaceInput.current?.click();
                    }}
                    className="btn btn-outline btn-sm flex-1"
                  >
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                    {t("refs.replace")}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      if (window.confirm(t("refs.removeConfirm", { name: item.fileName }))) void mutate(deleteReferenceAction, { id: item.id });
                    }}
                    className="btn btn-danger btn-sm flex-1"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    {t("refs.remove")}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Full-size preview */}
      <dialog
        ref={dialog}
        onClose={() => setPreview(null)}
        onClick={(e) => e.target === dialog.current && dialog.current?.close()}
        className="m-auto max-h-[92vh] w-[min(96vw,72rem)] overflow-hidden rounded-2xl bg-paper p-0 shadow-2xl backdrop:bg-navy-deep/80"
      >
        {preview && (
          <div className="flex max-h-[92vh] flex-col">
            <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
              <p className="min-w-0 truncate text-sm font-semibold text-ink">
                {t(`refs.sections.${preview.section}`)} · {preview.fileName}
              </p>
              <button type="button" onClick={() => dialog.current?.close()} className="inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full hover:bg-sand" aria-label={t("common.close")}>
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div className="overflow-auto bg-sand">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl(preview.imageId)} alt={preview.fileName} className="mx-auto h-auto max-w-full" />
            </div>
          </div>
        )}
      </dialog>
    </div>
  );
}
