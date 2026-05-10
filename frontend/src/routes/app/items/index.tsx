import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../../../lib/api/api";

interface Item {
  id: string;
  category: string;
  title: string;
  condition: string;
  status: "draft" | "active" | "revoked";
  created_at: string;
}

export const Route = createFileRoute("/app/items/")({ component: ItemsPage });

function ItemsPage() {
  const { data: items, isLoading } = useQuery<Item[]>({
    queryKey: ["items"],
    queryFn: () => apiFetch<Item[]>("/api/v1/items"),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="text-ink font-bold" style={{ fontSize: 32, letterSpacing: "-0.01em" }}>
            My Items
          </h1>
          <p className="text-ink-soft mt-1 text-sm">Manage drafts and issued certificates.</p>
        </div>
        <Link to="/app/items/new" className="btn-primary">
          <PlusIcon /> New item
        </Link>
      </div>

      {isLoading && <p className="text-ink-soft">Loading…</p>}

      {!isLoading && (!items || items.length === 0) && (
        <div className="card p-12 text-center">
          <p className="text-2xl mb-2">📦</p>
          <p className="font-semibold text-ink mb-1">No items yet</p>
          <p className="text-ink-soft text-sm mb-5">Add an item, upload photos, and issue your first certificate.</p>
          <Link to="/app/items/new" className="btn-primary">
            Create your first item
          </Link>
        </div>
      )}

      <div className="space-y-3">
        {items?.map((item) => (
          <Link
            key={item.id}
            to="/app/items/$id"
            params={{ id: item.id }}
            className="card p-4 hover:shadow-cardHover flex items-center justify-between transition-shadow"
          >
            <div>
              <p className="font-semibold text-ink">{item.title}</p>
              <p className="text-xs text-ink-mute mt-0.5 capitalize">
                {item.category.replace(/_/g, " ")} · {item.condition.replace(/_/g, " ")}
              </p>
            </div>
            <span className={item.status === "active" ? "badge-active" : item.status === "revoked" ? "badge-revoked" : "badge-draft"}>
              {item.status}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
