import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { apiPost } from "../../../lib/api/api";
import { queryClient } from "../../../lib/queryClient";

const CATEGORIES = [
  { value: "phone", label: "Phone" },
  { value: "laptop", label: "Laptop" },
  { value: "tablet", label: "Tablet" },
  { value: "watch_luxury", label: "Luxury watch" },
  { value: "handbag_luxury", label: "Luxury handbag" },
  { value: "sneaker", label: "Sneaker" },
  { value: "electronics_other", label: "Other electronics" },
  { value: "other", label: "Other" },
] as const;

const CONDITIONS = [
  { value: "new", label: "New" },
  { value: "like_new", label: "Like new" },
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
] as const;

export const Route = createFileRoute("/app/items/new")({ component: NewItemPage });

function NewItemPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    category: "phone",
    title: "",
    brand: "",
    model: "",
    condition: "like_new",
    description: "",
    serial_number: "",
    imei: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const payload: Record<string, unknown> = { ...form };
      if (!form.serial_number) delete payload.serial_number;
      if (!form.imei) delete payload.imei;
      const item = await apiPost<{ id: string }>("/api/v1/items", payload);
      await queryClient.invalidateQueries({ queryKey: ["items"] });
      void navigate({ to: "/app/items/$id", params: { id: item.id } });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create item");
    } finally {
      setLoading(false);
    }
  }

  function setField(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="max-w-xl">
      <Link to="/app/items" className="text-sm text-ink-soft hover:text-ink mb-2 inline-block">
        ← Back to items
      </Link>
      <h1 className="text-ink font-bold mb-1" style={{ fontSize: 28, letterSpacing: "-0.01em" }}>
        New Item
      </h1>
      <p className="text-ink-soft text-sm mb-6">Fill in the details. You can add photos in the next step.</p>

      <form onSubmit={(e) => void handleSubmit(e)} className="card p-6 space-y-5">
        <div>
          <label className="label">Category</label>
          <select
            value={form.category}
            onChange={(e) => setField("category", e.target.value)}
            className="input"
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Title</label>
          <input
            type="text"
            required
            value={form.title}
            onChange={(e) => setField("title", e.target.value)}
            className="input"
            placeholder="e.g. iPhone 14 Pro 256GB"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Brand</label>
            <input
              type="text"
              value={form.brand}
              onChange={(e) => setField("brand", e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="label">Model</label>
            <input
              type="text"
              value={form.model}
              onChange={(e) => setField("model", e.target.value)}
              className="input"
            />
          </div>
        </div>
        <div>
          <label className="label">Condition</label>
          <select
            value={form.condition}
            onChange={(e) => setField("condition", e.target.value)}
            className="input"
          >
            {CONDITIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        {form.category === "phone" ? (
          <div>
            <label className="label">IMEI (encrypted at rest, never shown publicly)</label>
            <input
              type="text"
              value={form.imei}
              onChange={(e) => setField("imei", e.target.value)}
              className="input"
              placeholder="15-digit IMEI"
              maxLength={20}
            />
          </div>
        ) : (
          <div>
            <label className="label">Serial number (encrypted at rest)</label>
            <input
              type="text"
              value={form.serial_number}
              onChange={(e) => setField("serial_number", e.target.value)}
              className="input"
            />
          </div>
        )}
        <div>
          <label className="label">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => setField("description", e.target.value)}
            rows={3}
            maxLength={1000}
            className="input resize-none"
            placeholder="Anything a buyer would want to know."
          />
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => void navigate({ to: "/app/items" })}
            className="btn-secondary flex-1"
          >
            Cancel
          </button>
          <button type="submit" disabled={loading} className="btn-primary flex-1">
            {loading ? "Creating…" : "Create draft"}
          </button>
        </div>
      </form>
    </div>
  );
}
