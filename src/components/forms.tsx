"use client";

import { startTransition, useActionState, useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ImagePlus, LoaderCircle } from "lucide-react";
import type { FormState, MsgKey } from "@/lib/i18n-shared";
import { useT } from "./i18n-provider";

type Action = (state: FormState, fd: FormData) => Promise<FormState>;
type FormButton = { label: string; name?: string; value?: string; className?: string };

/**
 * Form wired to a server action. Submitting through a transition (instead of
 * React's automatic form reset) keeps what the user typed when validation
 * fails; without JavaScript it still posts natively.
 */
export function ActionForm({
  action,
  children,
  buttons,
  className = "space-y-4",
  buttonsClassName = "flex flex-wrap gap-3 pt-1",
}: {
  action: Action;
  children: ReactNode;
  buttons: FormButton[];
  className?: string;
  buttonsClassName?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const t = useT();

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter;
    const fd = new FormData(e.currentTarget, submitter);
    startTransition(() => formAction(fd));
  }

  return (
    <form action={formAction} onSubmit={onSubmit} className={className}>
      {children}
      {state?.error && (
        <p role="alert" className="rounded-xl border border-rose/25 bg-rose/5 px-3.5 py-2.5 text-sm font-medium text-rose">
          {t(state.error as MsgKey)}
        </p>
      )}
      {state?.ok && (
        <p role="status" className="rounded-xl border border-leaf/20 bg-leaf-soft px-3.5 py-2.5 text-sm font-medium text-leaf">
          {t(state.ok as MsgKey)}
        </p>
      )}
      <div className={buttonsClassName}>
        {buttons.map((b, i) => (
          <button key={i} type="submit" name={b.name} value={b.value} disabled={pending} className={b.className ?? "btn btn-primary"}>
            {pending && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {b.label}
          </button>
        ))}
      </div>
    </form>
  );
}

const ACCEPT = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 10 * 1024 * 1024;

/** File picker with instant preview. The server re-validates everything. */
export function ImageInput({
  name,
  label,
  currentUrl,
  required = false,
  shape = "square",
}: {
  name: string;
  label: string;
  currentUrl?: string | null;
  required?: boolean;
  shape?: "square" | "wide" | "avatar" | "logo";
}) {
  const t = useT();
  const id = useId();
  const ref = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<MsgKey | null>(null);

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  function onChange() {
    const file = ref.current?.files?.[0];
    setError(null);
    if (!file) return setPreview(null);
    const bad: MsgKey | null = !ACCEPT.includes(file.type) ? "errors.imageType" : file.size > MAX_BYTES ? "errors.imageTooLarge" : null;
    if (bad) {
      if (ref.current) ref.current.value = "";
      setPreview(null);
      return setError(bad);
    }
    setPreview(URL.createObjectURL(file));
  }

  const shown = preview ?? currentUrl ?? null;
  const frame = {
    square: "aspect-square w-full max-w-md",
    wide: "aspect-[16/7] w-full",
    avatar: "h-24 w-24 rounded-full",
    logo: "h-28 w-44",
  }[shape];

  return (
    <div>
      <span className="label" id={`${id}-label`}>
        {label}
      </span>
      <label
        htmlFor={id}
        className={`group relative flex cursor-pointer items-center justify-center overflow-hidden border-2 border-dashed border-line bg-white text-center transition hover:border-navy/40 has-[:focus-visible]:border-navy ${frame} ${shape === "avatar" ? "" : "rounded-2xl"}`}
      >
        {shown ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={shown} alt={t("image.preview")} className={`h-full w-full ${shape === "logo" ? "object-contain p-2" : "object-cover"}`} />
            <span className="absolute inset-x-0 bottom-0 bg-navy-deep/70 py-1.5 text-xs font-semibold text-white opacity-0 transition group-hover:opacity-100 group-has-[:focus-visible]:opacity-100">
              {t("image.change")}
            </span>
          </>
        ) : (
          <span className="flex flex-col items-center gap-1.5 p-3 text-muted">
            <ImagePlus className="h-7 w-7 text-navy/60" aria-hidden="true" />
            {shape !== "avatar" && <span className="text-sm font-semibold text-ink">{t("image.choose")}</span>}
          </span>
        )}
        <input
          ref={ref}
          id={id}
          name={name}
          type="file"
          accept={ACCEPT.join(",")}
          required={required && !currentUrl}
          onChange={onChange}
          aria-labelledby={`${id}-label`}
          className="sr-only"
        />
      </label>
      <p className="mt-1.5 text-xs text-muted">{t("image.hint")}</p>
      {error && (
        <p role="alert" className="mt-1 text-sm font-medium text-rose">
          {t(error)}
        </p>
      )}
    </div>
  );
}

/** Submit button that asks for confirmation before a destructive action. */
export function ConfirmButton({ message, className, children }: { message: string; className?: string; children: ReactNode }) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
