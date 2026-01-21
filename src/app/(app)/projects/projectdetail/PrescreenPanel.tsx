// FILE: src/app/(app)/projects/projectdetail/PrescreenPanel.tsx
"use client";
import React, { useMemo, useState, useEffect } from "react";

/* ----------------------------- tiny UI helpers ----------------------------- */
const Label = ({
  children,
  required = false,
}: {
  children: React.ReactNode;
  required?: boolean;
}) => (
  <label className="mb-1 block text-xs font-medium text-slate-700">
    {children}
    {required && <span className="ml-0.5 text-rose-500">*</span>}
  </label>
);

const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input
    {...props}
    className={[
      "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none",
      "focus:ring-2 focus:ring-emerald-500/30",
      props.className || "",
    ].join(" ")}
  />
);

const Select = (props: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select
    {...props}
    className={[
      "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none",
      "focus:ring-2 focus:ring-emerald-500/30",
      props.className || "",
    ].join(" ")}
  />
);

const Textarea = (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea
    {...props}
    className={[
      "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none",
      "focus:ring-2 focus:ring-emerald-500/30",
      props.className || "",
    ].join(" ")}
  />
);

/* ----------------------------- action icon helpers ----------------------------- */
const IconButton = ({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    title={title}
    onClick={onClick}
    className="rounded p-1 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
  >
    {children}
  </button>
);

const PencilIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
  </svg>
);

const TrashIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </svg>
);

/* ------------------------------ types & consts ----------------------------- */
type ControlType = "TEXT" | "RADIO" | "CHECKBOX";
type TextType = "EMAIL" | "CONTACTNO" | "ZIPCODE" | "CUSTOM";

const CONTROL_TYPE_OPTIONS: { value: ControlType; label: string }[] = [
  { value: "TEXT", label: "Text" },
  { value: "RADIO", label: "Radio" },
  { value: "CHECKBOX", label: "Checkbox" },
];

const TEXT_TYPE_OPTIONS: { value: TextType; label: string }[] = [
  { value: "EMAIL", label: "Email" },
  { value: "CONTACTNO", label: "ContactNo" },
  { value: "ZIPCODE", label: "ZipCode" },
  { value: "CUSTOM", label: "Custom" },
];

/* ------------------------------ success dialog ----------------------------- */
function SuccessDialog({
  open,
  onClose,
  message = "Created Successfully!",
}: {
  open: boolean;
  onClose: () => void;
  message?: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/30 p-4">
      <div className="w-[min(360px,92vw)] rounded-xl bg-white p-6 text-center shadow-2xl">
        <div className="mb-5 text-lg font-semibold text-slate-900">
          {message}
        </div>
        <button
          onClick={onClose}
          className="rounded-md bg-teal-600 px-6 py-2 text-sm font-medium text-white hover:bg-teal-700"
        >
          OK
        </button>
      </div>
    </div>
  );
}

/* ------------------------------ confirm dialog ----------------------------- */
function ConfirmDialog({
  open,
  message = "Do you want to Delete?",
  yesText = "Yes",
  noText = "No",
  onYes,
  onNo,
}: {
  open: boolean;
  message?: string;
  yesText?: string;
  noText?: string;
  onYes: () => void | Promise<void>;
  onNo: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/30 p-4">
      <div className="w-[min(420px,92vw)] rounded-xl bg-white p-6 text-center shadow-2xl">
        <div className="mb-6 text-xl font-semibold text-slate-900">
          {message}
        </div>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={onYes}
            className="min-w-[88px] rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
          >
            {yesText}
          </button>
          <button
            onClick={onNo}
            className="min-w-[88px] rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50"
          >
            {noText}
          </button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------- Add modal -------------------------------- */
function AddQuestionModal({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: any) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [question, setQuestion] = useState("");
  const [controlType, setControlType] = useState<ControlType | "">("");

  // Text-specific
  const [minLen, setMinLen] = useState<string>("0");
  const [maxLen, setMaxLen] = useState<string>("0");
  const [textType, setTextType] = useState<TextType | "">("");

  // Options-specific
  const [optionDraft, setOptionDraft] = useState("");
  const [options, setOptions] = useState<string[]>([]);

  const canSubmit = useMemo(() => {
    if (!title.trim() || !question.trim() || !controlType) return false;
    if (controlType === "TEXT") {
      if (!textType) return false;
      const min = parseInt(minLen || "0", 10);
      const max = parseInt(maxLen || "0", 10);
      if (
        Number.isNaN(min) ||
        Number.isNaN(max) ||
        min < 0 ||
        max < 0
      )
        return false;
      if (max && min > max) return false;
    } else if (options.length === 0) return false;
    return true;
  }, [title, question, controlType, minLen, maxLen, textType, options.length]);

  const addOption = () => {
    const parts = optionDraft
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!parts.length) return;
    setOptions((prev) => Array.from(new Set([...prev, ...parts])));
    setOptionDraft("");
  };

  const reset = () => {
    setTitle("");
    setQuestion("");
    setControlType("");
    setMinLen("0");
    setMaxLen("0");
    setTextType("");
    setOptionDraft("");
    setOptions([]);
  };

  const handleSubmit = async () => {
    const base = { title: title.trim(), question: question.trim(), controlType };
    const payload =
      controlType === "TEXT"
        ? {
            ...base,
            text: {
              minLength: Number(minLen) || 0,
              maxLength: Number(maxLen) || 0,
              textType,
            },
          }
        : { ...base, options };
    await onSubmit(payload);
    reset();
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-[min(980px,95vw)] flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        {/* header */}
        <div className="flex items-center justify-between bg-slate-800 px-5 py-3 text-white">
          <div className="text-base font-semibold">Add Question</div>
          <button
            onClick={onClose}
            className="rounded px-2 py-1 text-xl leading-none hover:bg-white/10"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* body (scrollable) */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-12 gap-5">
            <div className="col-span-12 md:col-span-6">
              <Label required>Title</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="col-span-12 md:col-span-6">
              <Label required>Control Type</Label>
              <Select
                value={controlType}
                onChange={(e) => setControlType(e.target.value as ControlType)}
                required
              >
                <option value="">-- Select Control Type --</option>
                {CONTROL_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>

            <div className="col-span-12">
              <Label required>Question</Label>
              <Input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                required
              />
            </div>

            {controlType === "TEXT" ? (
              <>
                <div className="col-span-12 md:col-span-4">
                  <Label required>Min-Length</Label>
                  <Input
                    type="number"
                    min={0}
                    value={minLen}
                    onChange={(e) => setMinLen(e.target.value)}
                    required
                  />
                </div>
                <div className="col-span-12 md:col-span-4">
                  <Label required>Max-Length</Label>
                  <Input
                    type="number"
                    min={0}
                    value={maxLen}
                    onChange={(e) => setMaxLen(e.target.value)}
                    required
                  />
                </div>
                <div className="col-span-12 md:col-span-4">
                  <Label required>Text Type</Label>
                  <Select
                    value={textType}
                    onChange={(e) => setTextType(e.target.value as TextType)}
                    required
                  >
                    <option value="">-- Select Control --</option>
                    {TEXT_TYPE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </div>
              </>
            ) : (
              <>
                <div className="col-span-12 md:col-span-6">
                  <Label>Add Option</Label>
                  <Textarea
                    rows={8}
                    value={optionDraft}
                    onChange={(e) => setOptionDraft(e.target.value)}
                    placeholder="Type one option per line"
                  />
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={addOption}
                      className="rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
                    >
                      Add
                    </button>
                  </div>
                </div>
                <div className="col-span-12 md:col-span-6">
                  <Label>Mapped Options</Label>
                  <div className="min-h-[200px] rounded-lg border border-slate-300 p-3">
                    {options.length === 0 ? (
                      <div className="text-sm text-slate-500">
                        None added yet.
                      </div>
                    ) : (
                      <ul className="space-y-2">
                        {options.map((opt) => (
                          <li
                            key={opt}
                            className="flex items-center justify-between rounded border border-slate-200 bg-slate-50 px-3 py-1 text-sm"
                          >
                            <span className="truncate">{opt}</span>
                            <button
                              type="button"
                              onClick={() =>
                                setOptions((prev) =>
                                  prev.filter((x) => x !== opt)
                                )
                              }
                              className="rounded px-2 py-0.5 text-slate-500 hover:bg-white"
                              aria-label={`Remove ${opt}`}
                            >
                              ×
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* footer (sticky) */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 bg-white px-5 py-2 text-sm hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="rounded-md bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ EDIT modal -------------------------------- */
type CreatedQuestion =
  | {
      id: string;
      title: string;
      question: string;
      controlType: Exclude<ControlType, "TEXT">;
      options: any[]; // strings or objects from API
    }
  | {
      id: string;
      title: string;
      question: string;
      controlType: "TEXT";
      text?: { minLength: number; maxLength: number; textType: TextType };
      textMinLength?: number;
      textMaxLength?: number;
      textType?: TextType;
    };

function EditQuestionModal({
  open,
  draft,
  onClose,
  onSubmit,
}: {
  open: boolean;
  draft: CreatedQuestion | null;
  onClose: () => void;
  onSubmit: (payload: any) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [question, setQuestion] = useState("");
  const [controlType, setControlType] = useState<ControlType>("TEXT");

  // text config
  const [minLen, setMinLen] = useState<string>("0");
  const [maxLen, setMaxLen] = useState<string>("0");
  const [textType, setTextType] = useState<TextType>("CUSTOM");

  // options editor
  const [options, setOptions] = useState<string[]>([]);
  const [optionDraft, setOptionDraft] = useState("");

  useEffect(() => {
    if (!draft) return;
    setTitle(draft.title);
    setQuestion(draft.question);
    setControlType(draft.controlType as ControlType);

    if (draft.controlType === "TEXT") {
      const t =
        (draft as any).text ?? {
          minLength: (draft as any).textMinLength,
          maxLength: (draft as any).textMaxLength,
          textType: (draft as any).textType,
        };
      setMinLen(String(t?.minLength ?? 0));
      setMaxLen(String(t?.maxLength ?? 0));
      setTextType((t?.textType as TextType) ?? "CUSTOM");
      setOptions([]);
    } else {
      const raw = Array.isArray((draft as any).options)
        ? (draft as any).options
        : [];
      setOptions(
        raw
          .map((o: any) =>
            typeof o === "string" ? o : String(o.label ?? o.value ?? "")
          )
          .filter(Boolean)
      );
      setMinLen("0");
      setMaxLen("0");
      setTextType("CUSTOM");
    }
  }, [draft]);

  const canSubmit = useMemo(() => {
    if (!title.trim() || !question.trim()) return false;
    if (controlType === "TEXT") {
      const min = parseInt(minLen || "0", 10);
      const max = parseInt(maxLen || "0", 10);
      if (
        Number.isNaN(min) ||
        Number.isNaN(max) ||
        min < 0 ||
        max < 0
      )
        return false;
      if (max && min > max) return false;
      if (!textType) return false;
    } else if (options.length === 0) return false;
    return true;
  }, [title, question, controlType, minLen, maxLen, textType, options.length]);

  const addOption = () => {
    const parts = optionDraft
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!parts.length) return;
    setOptions((prev) => Array.from(new Set([...prev, ...parts])));
    setOptionDraft("");
  };

  const submit = async () => {
    if (!draft) return;
    const base: any = { title: title.trim(), question: question.trim() };
    const payload =
      controlType === "TEXT"
        ? {
            ...base,
            text: {
              minLength: Number(minLen) || 0,
              maxLength: Number(maxLen) || 0,
              textType,
            },
          }
        : {
            ...base,
            options: options.map((label, i) => ({
              label,
              value: label,
              sortOrder: i,
            })),
          };
    await onSubmit(payload);
    onClose();
  };

  if (!open || !draft) return null;

  return (
    <div className="fixed inset-0 z-[170] flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-[min(980px,95vw)] flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        {/* header */}
        <div className="flex items-center justify-between bg-slate-800 px-5 py-3 text-white">
          <div className="text-base font-semibold">Edit Question</div>
          <button
            onClick={onClose}
            className="rounded px-2 py-1 text-xl leading-none hover:bg-white/10"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* body (scrollable) */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-12 gap-5">
            <div className="col-span-12 md:col-span-6">
              <Label required>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>

            <div className="col-span-12 md:col-span-6">
              <Label required>Control Type</Label>
              <Select value={controlType} disabled>
                {CONTROL_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>

            <div className="col-span-12">
              <Label required>Question</Label>
              <Input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
              />
            </div>

            {controlType === "TEXT" ? (
              <>
                <div className="col-span-12 md:col-span-4">
                  <Label required>Min-Length</Label>
                  <Input
                    type="number"
                    min={0}
                    value={minLen}
                    onChange={(e) => setMinLen(e.target.value)}
                  />
                </div>
                <div className="col-span-12 md:col-span-4">
                  <Label required>Max-Length</Label>
                  <Input
                    type="number"
                    min={0}
                    value={maxLen}
                    onChange={(e) => setMaxLen(e.target.value)}
                  />
                </div>
                <div className="col-span-12 md:col-span-4">
                  <Label required>Text Type</Label>
                  <Select
                    value={textType}
                    onChange={(e) => setTextType(e.target.value as TextType)}
                  >
                    {TEXT_TYPE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </div>
              </>
            ) : (
              <>
                <div className="col-span-12 md:col-span-6">
                  <Label>Edit Options</Label>
                  <Textarea
                    rows={8}
                    value={optionDraft}
                    onChange={(e) => setOptionDraft(e.target.value)}
                    placeholder="Type one option per line"
                  />
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={addOption}
                      className="rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
                    >
                      Add
                    </button>
                  </div>
                </div>
                <div className="col-span-12 md:col-span-6">
                  <Label>Mapped Options</Label>
                  <div className="min-h-[200px] rounded-lg border border-slate-300 p-3">
                    {options.length === 0 ? (
                      <div className="text-sm text-slate-500">None.</div>
                    ) : (
                      <ul className="space-y-2">
                        {options.map((opt) => (
                          <li
                            key={opt}
                            className="flex items-center justify-between rounded border border-slate-200 bg-slate-50 px-3 py-1 text-sm"
                          >
                            <span className="truncate">{opt}</span>
                            <button
                              type="button"
                              onClick={() =>
                                setOptions((prev) =>
                                  prev.filter((x) => x !== opt)
                                )
                              }
                              className="rounded px-2 py-0.5 text-slate-500 hover:bg-white"
                              aria-label={`Remove ${opt}`}
                            >
                              ×
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* footer (sticky) */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 bg-white px-5 py-2 text-sm hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={submit}
            className="rounded-md bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ Library modal ----------------------------- */
type LibraryProfile = { key: string; name: string };

type LibraryQuestion = {
  key: string;
  title: string;
  question: string;
  controlType: ControlType;
  options?: { label: string; value?: string }[];
  text?: {
    minLength?: number;
    maxLength?: number | null;
    textType?: TextType | "CUSTOM";
  };
};

function LibraryModal({
  open,
  onClose,
  projectId,
  onAdded,
  setSuccessMessage,
  setSuccessOpen,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  onAdded: () => Promise<void>;
  setSuccessMessage: (m: string) => void;
  setSuccessOpen: (v: boolean) => void;
}) {
  const [profiles, setProfiles] = useState<LibraryProfile[]>([]);
  const [profileKey, setProfileKey] = useState<string>("");
  const [questions, setQuestions] = useState<LibraryQuestion[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string>("");

  const selectedCount = useMemo(
    () => Object.values(selected).filter(Boolean).length,
    [selected]
  );

  useEffect(() => {
    if (!open) return;
    (async () => {
      setError("");
      setLoadingProfiles(true);
      try {
        const r = await fetch(`/api/prescreen-library`, { cache: "no-store" });
        if (!r.ok) throw new Error(await r.text());
        const json = await r.json();
        const list = Array.isArray(json?.profiles) ? json.profiles : [];
        setProfiles(list);
        if (!profileKey && list.length) setProfileKey(String(list[0].key));
      } catch (e: any) {
        setError(e?.message || "Failed to load library profiles.");
      } finally {
        setLoadingProfiles(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!profileKey) {
      setQuestions([]);
      setSelected({});
      return;
    }
    (async () => {
      setError("");
      setLoadingQuestions(true);
      try {
        const r = await fetch(
          `/api/prescreen-library?profile=${encodeURIComponent(profileKey)}`,
          { cache: "no-store" }
        );
        if (!r.ok) throw new Error(await r.text());
        const json = await r.json();
        const qs = Array.isArray(json?.questions) ? json.questions : [];
        setQuestions(qs);
        setSelected({});
      } catch (e: any) {
        setError(e?.message || "Failed to load library questions.");
        setQuestions([]);
        setSelected({});
      } finally {
        setLoadingQuestions(false);
      }
    })();
  }, [open, profileKey]);

  const toggleAllLib = (val: boolean) => {
    const next: Record<string, boolean> = {};
    for (const q of questions) next[q.key] = val;
    setSelected(next);
  };

  const addSelected = async () => {
    const picks = questions.filter((q) => selected[q.key]);
    if (picks.length === 0) return;

    setAdding(true);
    setError("");

    try {
      for (const q of picks) {
        const base: any = {
          title: String(q.title ?? "").trim(),
          question: String(q.question ?? "").trim(),
          controlType: q.controlType,
        };

        let payload: any = base;

        if (q.controlType === "TEXT") {
          payload = {
            ...base,
            text: {
              minLength: Number(q.text?.minLength ?? 0) || 0,
              maxLength: Number(q.text?.maxLength ?? 0) || 0,
              textType: (q.text?.textType as any) || "CUSTOM",
            },
          };
        } else {
          const opts = Array.isArray(q.options) ? q.options : [];
          const labels = opts
            .map((o) => String(o?.label ?? "").trim())
            .filter(Boolean);
          payload = { ...base, options: labels };
        }

        const res = await fetch(`/api/projects/${projectId}/prescreen`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(await res.text());
      }

      await onAdded();
      setSuccessMessage(`Added ${picks.length} question(s) from Library!`);
      setSuccessOpen(true);
      onClose();
    } catch (e: any) {
      setError(e?.message || "Failed to add selected questions.");
    } finally {
      setAdding(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[180] flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-[min(1100px,95vw)] flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        {/* header */}
        <div className="flex items-center justify-between bg-slate-800 px-5 py-3 text-white">
          <div className="text-base font-semibold">Add from Library</div>
          <button
            onClick={onClose}
            className="rounded px-2 py-1 text-xl leading-none hover:bg-white/10"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* body (scrollable) */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-4 grid grid-cols-12 gap-4">
            <div className="col-span-12 md:col-span-5">
              <Label required>Profile</Label>
              <Select
                value={profileKey}
                onChange={(e) => setProfileKey(e.target.value)}
                disabled={loadingProfiles || profiles.length === 0}
              >
                {profiles.length === 0 ? (
                  <option value="">
                    {loadingProfiles
                      ? "Loading profiles..."
                      : "-- No profiles found --"}
                  </option>
                ) : (
                  profiles.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.name}
                    </option>
                  ))
                )}
              </Select>
            </div>

            <div className="col-span-12 md:col-span-7 flex items-end justify-end gap-2">
              <button
                type="button"
                onClick={() => toggleAllLib(true)}
                disabled={questions.length === 0 || loadingQuestions}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
              >
                Select all
              </button>
              <button
                type="button"
                onClick={() => toggleAllLib(false)}
                disabled={questions.length === 0 || loadingQuestions}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
              >
                Clear
              </button>
            </div>
          </div>

          {error ? (
            <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {String(error)}
            </div>
          ) : null}

          {/* table wrapper with its own scroll if many rows */}
          <div className="max-h-[55vh] overflow-auto rounded-lg border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-800 text-white">
                <tr>
                  <th className="w-16 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={
                        questions.length > 0 &&
                        selectedCount === questions.length
                      }
                      onChange={(e) => toggleAllLib(e.target.checked)}
                      disabled={questions.length === 0 || loadingQuestions}
                    />
                  </th>
                  <th className="w-64 px-4 py-3">Title</th>
                  <th className="px-4 py-3">Question</th>
                  <th className="w-36 px-4 py-3">Control</th>
                </tr>
              </thead>

              <tbody>
                {loadingQuestions ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-6 text-center text-slate-500"
                    >
                      Loading questions...
                    </td>
                  </tr>
                ) : questions.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-6 text-center text-slate-500"
                    >
                      No questions found for this profile.
                    </td>
                  </tr>
                ) : (
                  questions.map((q, idx) => (
                    <tr
                      key={q.key}
                      className={idx % 2 ? "bg-slate-50" : "bg-white"}
                    >
                      <td className="px-4 py-2">
                        <input
                          type="checkbox"
                          checked={!!selected[q.key]}
                          onChange={(e) =>
                            setSelected((prev) => ({
                              ...prev,
                              [q.key]: e.target.checked,
                            }))
                          }
                        />
                      </td>
                      <td className="px-4 py-2">{q.title}</td>
                      <td className="px-4 py-2">{q.question}</td>
                      <td className="px-4 py-2">
                        {q.controlType === "TEXT"
                          ? "Text"
                          : q.controlType[0] +
                            q.controlType.slice(1).toLowerCase()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* footer (sticky) */}
        <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4">
          <div className="text-sm text-slate-600">
            Selected: <span className="font-semibold">{selectedCount}</span>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-300 bg-white px-5 py-2 text-sm hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={addSelected}
              disabled={selectedCount === 0 || adding}
              className="rounded-md bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {adding ? "Adding..." : "Add Selected"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ main panel -------------------------------- */

type OptionConfig = {
  id: string;
  label: string;
  enabled: boolean;
  validate: boolean;
  quota: number;
};

/** Stable, server-driven row shape for the saved list */
type SavedRow = {
  id: string;
  title: string;
  question: string;
  controlType: ControlType;
  sortOrder: number; // used for stable suffix numbering
};

type PreScreenPanelProps = {
  projectId: string;
  initialStatus: "ACTIVE" | "CLOSED";
};

export default function PrescreenPanel({
  projectId,
  initialStatus: _initialStatus,
}: PreScreenPanelProps) {
  const [addOpen, setAddOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [showDeleteSuccess, setShowDeleteSuccess] = useState(false);

  // For “configure options” after create OR after edit of non-TEXT
  const [activeQ, setActiveQ] = useState<CreatedQuestion | null>(null);
  const [opts, setOpts] = useState<OptionConfig[]>([]);
  const [saving, setSaving] = useState(false);

  // Saved list + dialog
  const [successOpen, setSuccessOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState("Created Successfully!");
  const [saved, setSaved] = useState<SavedRow[]>([]);

  // Edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [editDraft, setEditDraft] = useState<CreatedQuestion | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Delete confirm
  const [confirmDelete, setConfirmDelete] = useState<{
    open: boolean;
    id: string | null;
  }>({
    open: false,
    id: null,
  });

  // Track if we arrived at the mapping table from an Edit flow (for the right success message)
  const [fromEdit, setFromEdit] = useState(false);

  /** Normalize options (reads optional flags if present). */
  function normalizeOptions(raw: any[]): OptionConfig[] {
    return raw.map((opt: any, idx: number) => {
      if (typeof opt === "string") {
        return {
          id: String(idx),
          label: opt,
          enabled: false,
          validate: false,
          quota: 0,
        };
      }
      const id = String(opt.id ?? `${opt.value ?? opt.label ?? idx}`);
      const label = String(opt.label ?? opt.value ?? `Option ${idx + 1}`);
      const enabled = Boolean(opt.enabled ?? opt.isEnabled ?? false);
      const validate = Boolean(opt.validate ?? opt.isValidate ?? false);
      const quota = Number(opt.quota ?? 0) || 0;
      return { id, label, enabled, validate, quota };
    });
  }

  /** Fetch a question by id and load into mapping view. */
  const fetchAndLoadQuestion = async (questionId: string) => {
    const r = await fetch(
      `/api/projects/${projectId}/prescreen/question/${questionId}`
    );
    if (!r.ok) throw new Error(await r.text());
    const q = (await r.json()) as CreatedQuestion;
    setActiveQ(q);
    if ((q as any).controlType !== "TEXT") {
      const raw = Array.isArray((q as any).options) ? (q as any).options : [];
      setOpts(normalizeOptions(raw));
    } else {
      setOpts([]);
    }
  };

  /** Load a question already in memory into mapping (used after create fetch). */
  const loadIntoState = (q: CreatedQuestion) => {
    setActiveQ(q);
    if ((q as any).controlType !== "TEXT") {
      const raw = Array.isArray((q as any).options) ? (q as any).options : [];
      setOpts(normalizeOptions(raw));
    } else {
      setOpts([]);
    }
  };

  /** Fetch saved list whenever tab mounts or projectId changes */
  const loadSavedList = async () => {
    try {
      const r = await fetch(`/api/projects/${projectId}/prescreen`, {
        cache: "no-store",
      });
      if (!r.ok) throw new Error(await r.text());

      const json: any = await r.json();

      // Normalize to an array regardless of the response shape
      let rows: any[] = [];
      if (Array.isArray(json)) {
        rows = json;
      } else if (Array.isArray(json?.items)) {
        rows = json.items;
      } else if (Array.isArray(json?.data)) {
        rows = json.data;
      } else if (json && typeof json === "object") {
        rows = [json];
      }

      if (!Array.isArray(rows)) {
        console.warn("Unexpected prescreen list shape:", json);
        setSaved([]);
        return;
      }

      // Sort by server-provided sortOrder if available
      try {
        rows.sort((a, b) => (a?.sortOrder ?? 0) - (b?.sortOrder ?? 0));
      } catch {
        /* ignore sort errors */
      }

      // Coerce into the SavedRow shape (WITH sortOrder)
      const normalized: SavedRow[] = rows
        .map((row) => {
          if (!row) return null;
          return {
            id: String(row.id),
            title: String(row.title ?? ""),
            question: String(row.question ?? ""),
            controlType: String(row.controlType ?? "TEXT") as ControlType,
            sortOrder: Number(row.sortOrder ?? 0),
          };
        })
        .filter(Boolean) as SavedRow[];

      setSaved(normalized);
    } catch (e) {
      console.error("Failed to load saved list:", e);
    }
  };

  useEffect(() => {
    loadSavedList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const toggleAll = (field: "enabled" | "validate", val: boolean) =>
    setOpts((prev) => prev.map((o) => ({ ...o, [field]: val })));

  const saveConfig = async () => {
    if (!activeQ) return;
    setSaving(true);
    try {
      const body =
        (activeQ as any).controlType === "TEXT"
          ? { text: (activeQ as any).text }
          : {
              options: opts.map((o, i) => ({
                label: o.label,
                value: o.label,
                sortOrder: i,
                enabled: o.enabled,
                validate: o.validate,
                quota: o.quota || 0,
              })),
            };

      const res = await fetch(
        `/api/projects/${projectId}/prescreen/question/${(activeQ as any).id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      if (!res.ok) throw new Error(await res.text());

      setSuccessMessage(fromEdit ? "Edited successfully!" : "Created Successfully!");
      setSuccessOpen(true);
      setFromEdit(false);

      await loadSavedList();
    } catch (e: any) {
      console.error(e);
      window.alert(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  /* -------------------- EDIT / DELETE handlers for saved list -------------- */
  const handleEdit = async (id: string) => {
    try {
      const r = await fetch(`/api/projects/${projectId}/prescreen/question/${id}`);
      if (!r.ok) throw new Error(await r.text());
      const q = (await r.json()) as CreatedQuestion;
      setEditingId(id);
      setEditDraft(q);
      setEditOpen(true);
    } catch (e: any) {
      window.alert(e?.message || "Failed to load question.");
    }
  };

  const requestDelete = (id: string) => {
    setConfirmDelete({ open: true, id });
  };

  const confirmYes = async () => {
    if (!confirmDelete.id) return;
    try {
      const r = await fetch(
        `/api/projects/${projectId}/prescreen/question/${confirmDelete.id}`,
        { method: "DELETE" }
      );
      if (!r.ok) throw new Error(await r.text());
      await loadSavedList();
      setShowDeleteSuccess(true);
    } catch (e: any) {
      window.alert(e?.message || "Failed to delete.");
    } finally {
      setConfirmDelete({ open: false, id: null });
    }
  };

  const confirmNo = () => setConfirmDelete({ open: false, id: null });

  /* ------------------------------ render ---------------------------------- */
  return (
    <>
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div className="text-sm text-slate-700">Prescreen</div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
            >
              Add a new Question
            </button>

            <button
              type="button"
              onClick={() => setLibraryOpen(true)}
              className="rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
            >
              Add from Library
            </button>
          </div>
        </div>

        {/* mapping table (shown after create OR after edit of non-TEXT) */}
        {activeQ ? (
          <>
            <div className="mb-3 grid grid-cols-[120px_1fr] gap-2 text-sm">
              <div className="text-slate-500">Title</div>
              <div>: {(activeQ as any).title}</div>
              <div className="text-slate-500">Question</div>
              <div>: {(activeQ as any).question}</div>
              <div className="text-slate-500">Control Type</div>
              <div>
                :{" "}
                {(activeQ as any).controlType === "TEXT"
                  ? "Text"
                  : (activeQ as any).controlType[0] +
                    (activeQ as any).controlType.slice(1).toLowerCase()}
              </div>
            </div>

            {(activeQ as any).controlType !== "TEXT" ? (
              <div className="overflow-auto rounded-lg border border-slate-200">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-800 text-white">
                    <tr>
                      <th className="w-28 px-4 py-2">
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="checkbox"
                            onChange={(e) => toggleAll("enabled", e.target.checked)}
                          />{" "}
                          Enable
                        </label>
                      </th>
                      <th className="px-4 py-2">Option</th>
                      <th className="w-32 px-4 py-2">
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="checkbox"
                            onChange={(e) => toggleAll("validate", e.target.checked)}
                          />{" "}
                          Validate
                        </label>
                      </th>
                      <th className="w-32 px-4 py-2">Quota</th>
                    </tr>
                  </thead>
                  <tbody>
                    {opts.map((o, i) => (
                      <tr key={o.id} className={i % 2 ? "bg-slate-50" : "bg-white"}>
                        <td className="px-4 py-2">
                          <input
                            type="checkbox"
                            checked={o.enabled}
                            onChange={(e) =>
                              setOpts((prev) =>
                                prev.map((x) =>
                                  x.id === o.id ? { ...x, enabled: e.target.checked } : x
                                )
                              )
                            }
                          />
                        </td>
                        <td className="px-4 py-2">{o.label}</td>
                        <td className="px-4 py-2">
                          <input
                            type="checkbox"
                            checked={o.validate}
                            onChange={(e) =>
                              setOpts((prev) =>
                                prev.map((x) =>
                                  x.id === o.id ? { ...x, validate: e.target.checked } : x
                                )
                              )
                            }
                          />
                        </td>
                        <td className="px-4 py-2">
                          <Input
                            type="number"
                            min={0}
                            value={String(o.quota ?? 0)}
                            onChange={(e) =>
                              setOpts((prev) =>
                                prev.map((x) =>
                                  x.id === o.id
                                    ? { ...x, quota: Math.max(0, Number(e.target.value || 0)) }
                                    : x
                                )
                              )
                            }
                            className="w-24"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setActiveQ(null);
                  setOpts([]);
                  setFromEdit(false);
                  loadSavedList();
                }}
                className="rounded-md border border-slate-300 bg-white px-5 py-2 text-sm hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveConfig}
                disabled={saving}
                className="rounded-md bg-teal-600 px-5 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </>
        ) : (
          <div className="overflow-auto rounded-lg border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-800 text-white">
                <tr>
                  <th className="w-20 px-4 py-3">ID</th>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Question</th>
                  <th className="w-36 px-4 py-3">Control</th>
                  <th className="w-28 px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {saved.length === 0 ? (
                  <tr>
                    <td
                      className="px-4 py-6 text-center text-slate-500"
                      colSpan={5}
                    >
                      Add a question to configure prescreen options.
                    </td>
                  </tr>
                ) : (
                  saved.map((q, i) => {
                    const displayTitle = `${q.title}_${1000 + (q.sortOrder ?? 0)}`;
                    return (
                      <tr key={q.id} className={i % 2 ? "bg-slate-50" : "bg-white"}>
                        <td className="px-4 py-2">{i + 1}</td>
                        <td className="px-4 py-2">{displayTitle}</td>
                        <td className="px-4 py-2">{q.question}</td>
                        <td className="px-4 py-2">
                          {q.controlType === "TEXT"
                            ? "Text"
                            : q.controlType[0] + q.controlType.slice(1).toLowerCase()}
                        </td>
                        <td className="px-2 py-2">
                          <div className="flex items-center gap-1">
                            <IconButton title="Edit" onClick={() => handleEdit(q.id)}>
                              <PencilIcon />
                            </IconButton>
                            <IconButton title="Delete" onClick={() => requestDelete(q.id)}>
                              <TrashIcon />
                            </IconButton>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Create modal */}
        <AddQuestionModal
          open={addOpen}
          onClose={() => setAddOpen(false)}
          onSubmit={async (payload) => {
            const res = await fetch(`/api/projects/${projectId}/prescreen`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });
            if (!res.ok) throw new Error(await res.text());
            const created = (await res.json()) as CreatedQuestion | { id: string };
            if ("title" in created) {
              loadIntoState(created);
            } else {
              await fetchAndLoadQuestion((created as any).id);
            }
            await loadSavedList();
          }}
        />

        {/* Library modal */}
        <LibraryModal
          open={libraryOpen}
          onClose={() => setLibraryOpen(false)}
          projectId={projectId}
          onAdded={async () => {
            await loadSavedList();
          }}
          setSuccessMessage={setSuccessMessage}
          setSuccessOpen={setSuccessOpen}
        />

        {/* EDIT modal */}
        <EditQuestionModal
          open={editOpen}
          draft={editDraft}
          onClose={() => setEditOpen(false)}
          onSubmit={async (payload) => {
            if (!editingId) return;
            const res = await fetch(
              `/api/projects/${projectId}/prescreen/question/${editingId}`,
              {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              }
            );
            if (!res.ok) throw new Error(await res.text());
            const updated = (await res.json()) as CreatedQuestion;

            if ((updated as any).controlType !== "TEXT") {
              setEditOpen(false);
              setFromEdit(true);
              await fetchAndLoadQuestion((updated as any).id);
              return;
            }

            await loadSavedList();
            setSuccessMessage("Edited successfully!");
            setSuccessOpen(true);
          }}
        />

        {/* Success dialog */}
        <SuccessDialog
          open={successOpen}
          onClose={() => {
            setSuccessOpen(false);
            setActiveQ(null);
            setOpts([]);
            loadSavedList();
          }}
          message={successMessage}
        />

        {/* Delete confirm dialog */}
        <ConfirmDialog
          open={confirmDelete.open}
          message="Do you want to Delete?"
          yesText="Yes"
          noText="No"
          onYes={confirmYes}
          onNo={confirmNo}
        />

        {/* Delete success dialog */}
        {showDeleteSuccess && (
          <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/40 p-4">
            <div className="w-[min(360px,92vw)] rounded-md bg-white p-6 text-center">
              <h3 className="mb-4 text-lg font-semibold">
                Question deleted successfully!
              </h3>

              <button
                onClick={() => setShowDeleteSuccess(false)}
                className="rounded-md bg-teal-600 px-6 py-2 text-sm font-medium text-white hover:bg-teal-700"
              >
                OK
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
