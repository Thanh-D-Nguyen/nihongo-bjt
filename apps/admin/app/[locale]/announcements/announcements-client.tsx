"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AdminToastContainer,
  FormError,
  FormField,
  FormInput,
  FormSelect,
  useAdminToast,
} from "@nihongo-bjt/ui";
import { adminApiFetch } from "@/lib/admin-api";
import { useFormErrors, parseApiError, validateFields, validators } from "@/lib/form-errors";

type Announcement = {
  id: string;
  type: "info" | "event" | "promo";
  message: string;
  href: string | null;
  active: boolean;
  sortOrder: number;
  format: "banner" | "modal";
  target: "all" | "free_only" | "premium_only";
  priority: number;
  titleVi: string | null;
  titleEn: string | null;
  titleJa: string | null;
  bodyVi: string | null;
  bodyEn: string | null;
  bodyJa: string | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
  imageUrl: string | null;
  effect: string;
  bgPreset: string;
  allowCloseButton: boolean;
  allowClickOutside: boolean;
  dismissDelay: number;
  showFrequency: string;
  startsAt: string | null;
  endsAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

type FormData = {
  type: "info" | "event" | "promo";
  message: string;
  href: string;
  active: boolean;
  sortOrder: number;
  format: "banner" | "modal";
  target: "all" | "free_only" | "premium_only";
  priority: number;
  titleVi: string;
  titleEn: string;
  titleJa: string;
  bodyVi: string;
  bodyEn: string;
  bodyJa: string;
  ctaLabel: string;
  ctaUrl: string;
  imageUrl: string;
  effect: string;
  bgPreset: string;
  allowCloseButton: boolean;
  allowClickOutside: boolean;
  dismissDelay: number;
  showFrequency: string;
  startsAt: string;
  endsAt: string;
};

const EMPTY: FormData = {
  type: "info", message: "", href: "", active: true, sortOrder: 0,
  format: "banner", target: "all", priority: 0,
  titleVi: "", titleEn: "", titleJa: "",
  bodyVi: "", bodyEn: "", bodyJa: "",
  ctaLabel: "", ctaUrl: "", imageUrl: "",
  effect: "none", bgPreset: "default", allowCloseButton: true,
  allowClickOutside: true, dismissDelay: 0, showFrequency: "once_ever",
  startsAt: "", endsAt: "",
};

const TYPE_OPTIONS = [
  { label: "ℹ️ Info", value: "info" },
  { label: "📅 Event", value: "event" },
  { label: "🎁 Promo", value: "promo" },
] as const;

const FORMAT_OPTIONS = [
  { label: "📢 Banner (thanh trên)", value: "banner" },
  { label: "💬 Modal (popup)", value: "modal" },
] as const;

const EFFECT_OPTIONS = [
  { label: "Không", value: "none" },
  { label: "🎊 Confetti", value: "confetti" },
  { label: "✨ Particles", value: "particles" },
  { label: "💎 Shimmer", value: "shimmer" },
  { label: "🌌 Aurora", value: "aurora" },
  { label: "🌸 Sakura", value: "sakura" },
] as const;

const BG_PRESET_OPTIONS = [
  { label: "⬜ Trắng (mặc định)", value: "default" },
  { label: "🔵 Gradient xanh", value: "gradient-blue" },
  { label: "🟣 Gradient tím", value: "gradient-violet" },
  { label: "🟠 Gradient ấm", value: "gradient-warm" },
  { label: "⬛ Gradient tối", value: "gradient-dark" },
  { label: "🖼️ Chỉ ảnh", value: "image-only" },
] as const;

const FREQUENCY_OPTIONS = [
  { label: "🔄 Mỗi lần truy cập", value: "every_visit" },
  { label: "📅 1 lần / ngày", value: "once_per_day" },
  { label: "☑️ 1 lần duy nhất", value: "once_ever" },
] as const;

const TARGET_OPTIONS = [
  { label: "🌐 Tất cả", value: "all" },
  { label: "🆓 Chỉ user miễn phí", value: "free_only" },
  { label: "⭐ Chỉ user premium", value: "premium_only" },
] as const;

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toISOString().slice(0, 16);
  } catch { return ""; }
}

function statusBadge(a: Announcement) {
  const now = Date.now();
  if (!a.active) return { label: "Ẩn", cls: "bg-neutral-200 text-neutral-500" };
  if (a.startsAt && new Date(a.startsAt).getTime() > now)
    return { label: "Lên lịch", cls: "bg-blue-100 text-blue-700" };
  if (a.endsAt && new Date(a.endsAt).getTime() < now)
    return { label: "Hết hạn", cls: "bg-amber-100 text-amber-700" };
  return { label: "Đang hiển thị", cls: "bg-green-100 text-green-700" };
}

/* ── Image upload + URL combo field ── */
function ImageUploadField({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (url: string) => void;
  error?: string;
}) {
  const [mode, setMode] = useState<"upload" | "url">(value && !value.startsWith("http://localhost") ? "url" : "upload");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setUploadError("Chỉ chấp nhận file ảnh (JPEG, PNG, WebP, GIF)");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("File quá lớn (tối đa 5 MB)");
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await adminApiFetch("/api/admin/media/upload", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => "Upload thất bại");
        setUploadError(errText);
        return;
      }
      const data = await res.json();
      onChange(data.url);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Upload thất bại");
    } finally {
      setUploading(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) void handleFile(file);
  };

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
    e.target.value = "";
  };

  return (
    <div className="space-y-3">
      {/* Toggle */}
      <div className="flex gap-1 rounded-lg bg-neutral-100 p-0.5">
        <button
          type="button"
          className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${mode === "upload" ? "bg-white text-neutral-800 shadow-sm" : "text-neutral-500 hover:text-neutral-700"}`}
          onClick={() => setMode("upload")}
        >
          📤 Upload ảnh
        </button>
        <button
          type="button"
          className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${mode === "url" ? "bg-white text-neutral-800 shadow-sm" : "text-neutral-500 hover:text-neutral-700"}`}
          onClick={() => setMode("url")}
        >
          🔗 Dán URL
        </button>
      </div>

      {mode === "upload" ? (
        <div
          className={`relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 transition-colors cursor-pointer ${
            dragOver ? "border-blue-400 bg-blue-50" : uploading ? "border-neutral-300 bg-neutral-50" : "border-neutral-300 hover:border-blue-300 hover:bg-blue-50/50"
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => !uploading && fileInputRef.current?.click()}
        >
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onFileSelect} />
          {uploading ? (
            <>
              <div className="size-8 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
              <span className="text-xs text-neutral-500">Đang upload...</span>
            </>
          ) : (
            <>
              <span className="text-3xl">🖼️</span>
              <span className="text-xs text-neutral-500">
                Kéo thả ảnh vào đây hoặc <span className="font-medium text-blue-600">chọn file</span>
              </span>
              <span className="text-[10px] text-neutral-400">JPEG, PNG, WebP, GIF · Tối đa 5 MB</span>
            </>
          )}
        </div>
      ) : (
        <FormInput
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://images.example.com/banner.jpg"
          error={error}
        />
      )}

      {uploadError && <p className="text-xs text-red-600">{uploadError}</p>}

      {/* Preview */}
      {value && (
        <div className="relative overflow-hidden rounded-lg border bg-neutral-50">
          <img
            src={value}
            alt="Preview"
            className="h-36 w-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
          <button
            type="button"
            className="absolute right-2 top-2 rounded-full bg-black/50 p-1 text-white hover:bg-black/70 transition-colors"
            onClick={() => onChange("")}
            title="Xóa ảnh"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>
      )}
    </div>
  );
}

export default function AnnouncementsClient() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY);
  const [saving, setSaving] = useState(false);
  const { errors, fieldError, setFieldErrors, setFormError, clearFieldError, clearAll } = useFormErrors();
  const toast = useAdminToast();

  const load = useCallback(async () => {
    setLoading(true);
    clearAll();
    try {
      const res = await adminApiFetch("/api/admin/announcements");
      if (!res.ok) throw new Error(`Không thể tải danh sách thông báo (HTTP ${res.status})`);
      setItems(await res.json());
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Không thể tải dữ liệu");
    } finally {
      setLoading(false);
    }
  }, [clearAll, setFormError]);

  useEffect(() => { void load(); }, [load]);

  const startCreate = () => {
    setEditId("new");
    setForm(EMPTY);
    clearAll();
  };

  const startEdit = (a: Announcement) => {
    setEditId(a.id);
    setForm({
      type: a.type,
      message: a.message,
      href: a.href ?? "",
      active: a.active,
      sortOrder: a.sortOrder,
      format: a.format,
      target: a.target,
      priority: a.priority,
      titleVi: a.titleVi ?? "",
      titleEn: a.titleEn ?? "",
      titleJa: a.titleJa ?? "",
      bodyVi: a.bodyVi ?? "",
      bodyEn: a.bodyEn ?? "",
      bodyJa: a.bodyJa ?? "",
      ctaLabel: a.ctaLabel ?? "",
      ctaUrl: a.ctaUrl ?? "",
      imageUrl: a.imageUrl ?? "",
      effect: a.effect ?? "none",
      bgPreset: a.bgPreset ?? "default",
      allowCloseButton: a.allowCloseButton ?? true,
      allowClickOutside: a.allowClickOutside ?? true,
      dismissDelay: a.dismissDelay ?? 0,
      showFrequency: a.showFrequency ?? "once_ever",
      startsAt: toLocalInput(a.startsAt),
      endsAt: toLocalInput(a.endsAt),
    });
    clearAll();
  };

  const cancel = () => {
    setEditId(null);
    setForm(EMPTY);
    clearAll();
  };

  const save = async () => {
    clearAll();
    const fieldErrors = validateFields([
      { field: "message", value: form.message, message: "Nội dung thông báo không được để trống", validate: validators.required },
      { field: "message", value: form.message, message: "Nội dung thông báo phải có ít nhất 3 ký tự", validate: validators.minLength(3) },
      { field: "href", value: form.href, message: "Link không hợp lệ", validate: validators.isUrl },
      { field: "ctaUrl", value: form.ctaUrl, message: "CTA URL không hợp lệ", validate: validators.isUrl },
    ]);
    if (Object.keys(fieldErrors).length > 0) { setFieldErrors(fieldErrors); return; }

    setSaving(true);
    try {
      const body = {
        type: form.type,
        message: form.message.trim(),
        href: form.href.trim() || null,
        active: form.active,
        sortOrder: form.sortOrder,
        format: form.format,
        target: form.target,
        priority: form.priority,
        titleVi: form.titleVi.trim() || null,
        titleEn: form.titleEn.trim() || null,
        titleJa: form.titleJa.trim() || null,
        bodyVi: form.bodyVi.trim() || null,
        bodyEn: form.bodyEn.trim() || null,
        bodyJa: form.bodyJa.trim() || null,
        ctaLabel: form.ctaLabel.trim() || null,
        ctaUrl: form.ctaUrl.trim() || null,
        imageUrl: form.imageUrl.trim() || null,
        effect: form.effect,
        bgPreset: form.bgPreset,
        allowCloseButton: form.allowCloseButton,
        allowClickOutside: form.allowClickOutside,
        dismissDelay: form.dismissDelay,
        showFrequency: form.showFrequency,
        startsAt: form.startsAt || null,
        endsAt: form.endsAt || null,
      };
      if (editId === "new") {
        const res = await adminApiFetch("/api/admin/announcements", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
        if (!res.ok) {
          const apiErr = await parseApiError(res, "Tạo thông báo thất bại");
          if (apiErr.form) setFormError(apiErr.form);
          if (Object.keys(apiErr.fields).length > 0) setFieldErrors(apiErr.fields);
          return;
        }
        toast.success("Tạo thông báo thành công");
      } else if (editId) {
        const res = await adminApiFetch(`/api/admin/announcements/${editId}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
        if (!res.ok) {
          const apiErr = await parseApiError(res, "Cập nhật thông báo thất bại");
          if (apiErr.form) setFormError(apiErr.form);
          if (Object.keys(apiErr.fields).length > 0) setFieldErrors(apiErr.fields);
          return;
        }
        toast.success("Cập nhật thông báo thành công");
      }
      setEditId(null);
      setForm(EMPTY);
      await load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Lưu thất bại. Vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Xóa thông báo này?")) return;
    try {
      const res = await adminApiFetch(`/api/admin/announcements/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const apiErr = await parseApiError(res, "Xóa thông báo thất bại");
        toast.error("Xóa thất bại", apiErr.form ?? undefined);
        return;
      }
      toast.success("Đã xóa thông báo");
      await load();
    } catch (e) {
      toast.error("Xóa thất bại", e instanceof Error ? e.message : undefined);
    }
  };

  const toggleActive = async (a: Announcement) => {
    try {
      const res = await adminApiFetch(`/api/admin/announcements/${a.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: !a.active }),
      });
      if (!res.ok) {
        const apiErr = await parseApiError(res, "Chuyển trạng thái thất bại");
        toast.error("Thao tác thất bại", apiErr.form ?? undefined);
        return;
      }
      toast.success(a.active ? "Đã ẩn thông báo" : "Đã hiển thị thông báo");
      await load();
    } catch (e) {
      toast.error("Thao tác thất bại", e instanceof Error ? e.message : undefined);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Quản lý thông báo</h1>
          <p className="text-sm text-neutral-500">
            Thông báo banner/modal hiển thị cho learner, hỗ trợ lên lịch và nhắm mục tiêu
          </p>
        </div>
        <button
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          onClick={startCreate}
          type="button"
        >
          + Tạo thông báo
        </button>
      </div>

      <FormError message={errors.form} />

      {/* Edit / Create form */}
      {editId && (
        <div className="rounded-xl border bg-white p-4 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold">{editId === "new" ? "Tạo mới" : "Chỉnh sửa"}</h2>

          {/* Row 1: Type, Format, Target */}
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField label="Loại" required>
              <FormSelect value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as FormData["type"] })}>
                {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </FormSelect>
            </FormField>
            <FormField label="Định dạng" required>
              <FormSelect value={form.format} onChange={(e) => setForm({ ...form, format: e.target.value as FormData["format"] })}>
                {FORMAT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </FormSelect>
            </FormField>
            <FormField label="Đối tượng">
              <FormSelect value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value as FormData["target"] })}>
                {TARGET_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </FormSelect>
            </FormField>
          </div>

          {/* Row 2: Priority, Sort Order */}
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField label="Ưu tiên (cao hơn = hiển thị trước)">
              <FormInput type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: parseInt(e.target.value) || 0 })} />
            </FormField>
            <FormField label="Thứ tự">
              <FormInput type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })} />
            </FormField>
            <div className="flex items-end pb-1">
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} id="ann-active" />
                <label htmlFor="ann-active" className="text-sm">Đang hiển thị</label>
              </div>
            </div>
          </div>

          {/* Message (legacy + primary display) */}
          <FormField label="Nội dung chính (banner text)" required error={fieldError("message")}>
            <FormInput
              error={fieldError("message")}
              value={form.message}
              onChange={(e) => { setForm({ ...form, message: e.target.value }); clearFieldError("message"); }}
              placeholder="Chào mừng bạn đến NihonGo BJT..."
            />
          </FormField>

          {/* i18n Title */}
          <fieldset className="rounded-lg border border-neutral-200 p-3 space-y-3">
            <legend className="text-xs font-semibold text-neutral-500 px-1">Tiêu đề (i18n) — dùng cho Modal</legend>
            <div className="grid gap-3 sm:grid-cols-3">
              <FormField label="🇻🇳 Tiêu đề VI">
                <FormInput value={form.titleVi} onChange={(e) => setForm({ ...form, titleVi: e.target.value })} placeholder="Tiêu đề tiếng Việt" />
              </FormField>
              <FormField label="🇬🇧 Title EN">
                <FormInput value={form.titleEn} onChange={(e) => setForm({ ...form, titleEn: e.target.value })} placeholder="English title" />
              </FormField>
              <FormField label="🇯🇵 タイトル JA">
                <FormInput value={form.titleJa} onChange={(e) => setForm({ ...form, titleJa: e.target.value })} placeholder="日本語タイトル" />
              </FormField>
            </div>
          </fieldset>

          {/* i18n Body */}
          <fieldset className="rounded-lg border border-neutral-200 p-3 space-y-3">
            <legend className="text-xs font-semibold text-neutral-500 px-1">Nội dung chi tiết (i18n) — dùng cho Modal body</legend>
            <div className="grid gap-3 sm:grid-cols-3">
              <FormField label="🇻🇳 Nội dung VI">
                <FormInput value={form.bodyVi} onChange={(e) => setForm({ ...form, bodyVi: e.target.value })} placeholder="Chi tiết tiếng Việt" />
              </FormField>
              <FormField label="🇬🇧 Body EN">
                <FormInput value={form.bodyEn} onChange={(e) => setForm({ ...form, bodyEn: e.target.value })} placeholder="English body" />
              </FormField>
              <FormField label="🇯🇵 本文 JA">
                <FormInput value={form.bodyJa} onChange={(e) => setForm({ ...form, bodyJa: e.target.value })} placeholder="日本語本文" />
              </FormField>
            </div>
          </fieldset>

          {/* CTA */}
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="CTA Label" error={fieldError("ctaLabel")}>
              <FormInput value={form.ctaLabel} onChange={(e) => setForm({ ...form, ctaLabel: e.target.value })} placeholder="Xem thêm / Learn more" />
            </FormField>
            <FormField label="CTA URL" error={fieldError("ctaUrl")}>
              <FormInput
                error={fieldError("ctaUrl")}
                value={form.ctaUrl}
                onChange={(e) => { setForm({ ...form, ctaUrl: e.target.value }); clearFieldError("ctaUrl"); }}
                placeholder="https://..."
              />
            </FormField>
          </div>

          {/* Hero image (for modal) — Upload + URL */}
          <fieldset className="rounded-lg border border-neutral-200 p-3 space-y-3">
            <legend className="text-xs font-semibold text-neutral-500 px-1">🖼️ Hero Image (hiển thị đầu popup Modal)</legend>
            <ImageUploadField
              value={form.imageUrl}
              onChange={(url) => setForm({ ...form, imageUrl: url })}
              error={fieldError("imageUrl")}
            />
          </fieldset>

          {/* ── Modal Configuration ── */}
          {form.format === "modal" && (
            <fieldset className="rounded-lg border border-violet-200 bg-violet-50/30 p-4 space-y-4">
              <legend className="text-xs font-bold text-violet-700 px-1">⚙️ Cấu hình Modal</legend>

              <div className="grid gap-4 sm:grid-cols-2">
                {/* Effect */}
                <FormField label="Hiệu ứng">
                  <FormSelect value={form.effect} onChange={(e) => setForm({ ...form, effect: e.target.value })}>
                    {EFFECT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </FormSelect>
                </FormField>

                {/* Background preset */}
                <FormField label="Nền Modal">
                  <FormSelect value={form.bgPreset} onChange={(e) => setForm({ ...form, bgPreset: e.target.value })}>
                    {BG_PRESET_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </FormSelect>
                </FormField>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {/* Show frequency */}
                <FormField label="Tần suất hiển thị">
                  <FormSelect value={form.showFrequency} onChange={(e) => setForm({ ...form, showFrequency: e.target.value })}>
                    {FREQUENCY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </FormSelect>
                </FormField>

                {/* Dismiss delay */}
                <FormField label="Đếm ngược trước khi cho đóng (giây)">
                  <FormInput
                    type="number"
                    min={0}
                    max={30}
                    value={String(form.dismissDelay)}
                    onChange={(e) => setForm({ ...form, dismissDelay: Math.max(0, Math.min(30, Number(e.target.value) || 0)) })}
                    placeholder="0 = đóng ngay"
                  />
                </FormField>
              </div>

              {/* Toggles */}
              <div className="flex flex-wrap gap-5">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.allowCloseButton}
                    onChange={(e) => setForm({ ...form, allowCloseButton: e.target.checked })}
                    className="rounded border-neutral-300"
                  />
                  <span>Hiện nút ✕ đóng</span>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.allowClickOutside}
                    onChange={(e) => setForm({ ...form, allowClickOutside: e.target.checked })}
                    className="rounded border-neutral-300"
                  />
                  <span>Click bên ngoài để đóng</span>
                </label>
              </div>
            </fieldset>
          )}

          {/* Legacy Link */}
          <FormField label="Link cũ (href) — dành cho banner" error={fieldError("href")}>
            <FormInput
              error={fieldError("href")}
              value={form.href}
              onChange={(e) => { setForm({ ...form, href: e.target.value }); clearFieldError("href"); }}
              placeholder="https://..."
            />
          </FormField>

          {/* Schedule */}
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Bắt đầu hiển thị">
              <FormInput type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} />
            </FormField>
            <FormField label="Kết thúc hiển thị">
              <FormInput type="datetime-local" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} />
            </FormField>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              disabled={saving} onClick={save} type="button"
            >
              {saving ? "Đang lưu..." : "Lưu"}
            </button>
            <button
              className="rounded-lg border px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-50"
              onClick={cancel} type="button"
            >
              Hủy
            </button>
          </div>
        </div>
      )}

      <AdminToastContainer onRemove={toast.removeToast} toasts={toast.toasts} />

      {/* List */}
      {loading ? (
        <div className="py-8 text-center text-sm text-neutral-400">Đang tải...</div>
      ) : items.length === 0 ? (
        <div className="py-8 text-center text-sm text-neutral-400">Chưa có thông báo nào</div>
      ) : (
        <div className="space-y-2">
          {items.map((a) => {
            const badge = statusBadge(a);
            return (
              <div
                key={a.id}
                className={`flex items-center gap-3 rounded-xl border p-3 ${
                  a.active ? "bg-white" : "bg-neutral-50 opacity-60"
                }`}
              >
                <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${
                  a.type === "info" ? "bg-blue-500" : a.type === "event" ? "bg-amber-400" : "bg-violet-400"
                }`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{a.message}</p>
                  <div className="flex items-center gap-2 text-[10px] text-neutral-400">
                    <span className="uppercase">{a.format}</span>
                    <span>·</span>
                    <span>{a.target === "all" ? "Tất cả" : a.target === "free_only" ? "Free" : "Premium"}</span>
                    {a.startsAt && <><span>·</span><span>Từ {new Date(a.startsAt).toLocaleDateString("vi")}</span></>}
                    {a.endsAt && <><span>·</span><span>Đến {new Date(a.endsAt).toLocaleDateString("vi")}</span></>}
                  </div>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${badge.cls}`}>
                  {badge.label}
                </span>
                <span className="shrink-0 text-[10px] text-neutral-400">P{a.priority}</span>
                <button
                  className={`shrink-0 rounded px-2 py-1 text-xs font-medium ${
                    a.active ? "bg-green-100 text-green-700" : "bg-neutral-200 text-neutral-500"
                  }`}
                  onClick={() => toggleActive(a)}
                  type="button"
                >
                  {a.active ? "ON" : "OFF"}
                </button>
                <button
                  className="shrink-0 rounded px-2 py-1 text-xs text-blue-600 hover:bg-blue-50"
                  onClick={() => startEdit(a)}
                  type="button"
                >
                  Sửa
                </button>
                <button
                  className="shrink-0 rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                  onClick={() => remove(a.id)}
                  type="button"
                >
                  Xóa
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
