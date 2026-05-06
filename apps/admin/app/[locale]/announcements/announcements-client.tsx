"use client";

import { useCallback, useEffect, useState } from "react";
import { adminApiFetch } from "@/lib/admin-api";

type Announcement = {
  id: string;
  type: "info" | "event" | "promo";
  message: string;
  href: string | null;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

type FormData = {
  type: "info" | "event" | "promo";
  message: string;
  href: string;
  active: boolean;
  sortOrder: number;
};

const EMPTY: FormData = { type: "info", message: "", href: "", active: true, sortOrder: 0 };

const TYPE_OPTIONS = [
  { label: "ℹ️ Info", value: "info" },
  { label: "📅 Event", value: "event" },
  { label: "🎁 Promo", value: "promo" },
] as const;

export default function AnnouncementsClient() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApiFetch("/api/admin/announcements");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setItems(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const startCreate = () => {
    setEditId("new");
    setForm(EMPTY);
  };

  const startEdit = (a: Announcement) => {
    setEditId(a.id);
    setForm({
      type: a.type,
      message: a.message,
      href: a.href ?? "",
      active: a.active,
      sortOrder: a.sortOrder,
    });
  };

  const cancel = () => {
    setEditId(null);
    setForm(EMPTY);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const body = {
        type: form.type,
        message: form.message.trim(),
        href: form.href.trim() || null,
        active: form.active,
        sortOrder: form.sortOrder,
      };
      if (editId === "new") {
        const res = await adminApiFetch("/api/admin/announcements", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`Create failed: ${res.status}`);
      } else if (editId) {
        const res = await adminApiFetch(`/api/admin/announcements/${editId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`Update failed: ${res.status}`);
      }
      setEditId(null);
      setForm(EMPTY);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Xóa thông báo này?")) return;
    try {
      const res = await adminApiFetch(`/api/admin/announcements/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const toggleActive = async (a: Announcement) => {
    try {
      const res = await adminApiFetch(`/api/admin/announcements/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !a.active }),
      });
      if (!res.ok) throw new Error(`Toggle failed: ${res.status}`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Toggle failed");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Quản lý thông báo</h1>
          <p className="text-sm text-neutral-500">Thông báo hiển thị trên thanh strip trang chủ learner</p>
        </div>
        <button
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          onClick={startCreate}
          type="button"
        >
          + Tạo thông báo
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {/* Edit / Create form */}
      {editId && (
        <div className="rounded-xl border bg-white p-4 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold">{editId === "new" ? "Tạo mới" : "Chỉnh sửa"}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Loại</label>
              <select
                className="w-full rounded-lg border px-3 py-2 text-sm"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as FormData["type"] })}
              >
                {TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Thứ tự</label>
              <input
                className="w-full rounded-lg border px-3 py-2 text-sm"
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">Nội dung *</label>
            <input
              className="w-full rounded-lg border px-3 py-2 text-sm"
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              placeholder="Chào mừng bạn đến NihonGo BJT..."
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">Link (tùy chọn)</label>
            <input
              className="w-full rounded-lg border px-3 py-2 text-sm"
              value={form.href}
              onChange={(e) => setForm({ ...form, href: e.target.value })}
              placeholder="https://..."
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
              id="ann-active"
            />
            <label htmlFor="ann-active" className="text-sm">Đang hiển thị</label>
          </div>
          <div className="flex gap-2">
            <button
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              disabled={saving || !form.message.trim()}
              onClick={save}
              type="button"
            >
              {saving ? "Đang lưu..." : "Lưu"}
            </button>
            <button
              className="rounded-lg border px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-50"
              onClick={cancel}
              type="button"
            >
              Hủy
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="py-8 text-center text-sm text-neutral-400">Đang tải...</div>
      ) : items.length === 0 ? (
        <div className="py-8 text-center text-sm text-neutral-400">Chưa có thông báo nào</div>
      ) : (
        <div className="space-y-2">
          {items.map((a) => (
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
                {a.href && <p className="text-xs text-neutral-400 truncate">{a.href}</p>}
              </div>
              <span className="shrink-0 text-[10px] text-neutral-400">#{a.sortOrder}</span>
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
          ))}
        </div>
      )}
    </div>
  );
}
