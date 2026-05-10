import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiFetch, apiPost, apiDelete } from "../../../lib/api/api";
import { queryClient } from "../../../lib/queryClient";
import { useRef, useState } from "react";

interface Photo {
  id: string;
  position: number;
  s3_key: string;
}

interface ItemDetail {
  id: string;
  title: string;
  category: string;
  condition: string;
  status: "draft" | "active" | "revoked";
  brand: string | null;
  model: string | null;
  description: string;
  photos: Photo[];
}

interface IssuedCert {
  id: string;
  slug: string;
  url: string;
}

interface SignResponse {
  uploadKey: string;
  presignedUrl: string;
}

export const Route = createFileRoute("/app/items/$id")({ component: ItemDetailPage });

function ItemDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [issued, setIssued] = useState<IssuedCert | null>(null);

  const { data: item, isLoading } = useQuery<ItemDetail>({
    queryKey: ["items", id],
    queryFn: () => apiFetch<ItemDetail>(`/api/v1/items/${id}`),
  });

  const issueMutation = useMutation({
    mutationFn: () => apiPost<IssuedCert>(`/api/v1/items/${id}/issue`),
    onSuccess: async (cert) => {
      await queryClient.invalidateQueries({ queryKey: ["items"] });
      setIssued(cert);
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (reason: string) => {
      const cert = await apiFetch<{ slug: string }>(`/api/v1/items/${id}`);
      // For active items we have the slug via certificate row; simpler: ask user
      return apiPost(`/api/v1/certificates/${cert.slug ?? ""}/revoke`, { reason });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["items", id] });
    },
  });

  const deletePhotoMutation = useMutation({
    mutationFn: (photoId: string) => apiDelete(`/api/v1/items/${id}/photos/${photoId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["items", id] }),
  });

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !item) return;
    setUploading(true);
    try {
      const { uploadKey, presignedUrl } = await apiPost<SignResponse>(
        `/api/v1/items/${id}/photos/sign`,
        { contentType: file.type, filename: file.name },
      );
      const putRes = await fetch(presignedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!putRes.ok) throw new Error("Upload to S3 failed");
      await apiPost(`/api/v1/items/${id}/photos`, {
        uploadKey,
        position: item.photos.length,
      });
      await queryClient.invalidateQueries({ queryKey: ["items", id] });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  if (isLoading) return <p className="text-ink-soft">Loading…</p>;
  if (!item) return <p className="text-red-600">Item not found</p>;

  if (issued) {
    return (
      <div className="max-w-xl">
        <div className="card p-8 text-center">
          <div className="w-12 h-12 mx-auto rounded-full bg-brand/15 border border-brand/30 flex items-center justify-center mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h1 className="font-bold text-ink mb-2" style={{ fontSize: 24, letterSpacing: "-0.02em" }}>
            Certificate issued
          </h1>
          <p className="text-ink-soft text-sm mb-6">
            Share this URL with buyers, or print the QR PDF.
          </p>
          <div className="bg-bg-muted border border-line rounded-lg p-3 mb-4">
            <code className="text-ink text-sm break-all">{issued.url}</code>
          </div>
          <div className="flex gap-3">
            <a href={`/api/v1/certificates/${issued.slug}/qr.png`} className="btn-secondary flex-1">
              Download QR (PNG)
            </a>
            <a href={`/api/v1/certificates/${issued.slug}/sticker.pdf`} className="btn-primary flex-1">
              Download sticker (PDF)
            </a>
          </div>
          <button onClick={() => void navigate({ to: "/app/items" })} className="btn-ghost mt-4 w-full">
            Back to items
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <Link to="/app/items" className="text-sm text-ink-soft hover:text-ink mb-2 inline-block">
        ← Back to items
      </Link>
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <h1 className="text-ink font-bold" style={{ fontSize: 28, letterSpacing: "-0.01em" }}>
          {item.title}
        </h1>
        <span className={item.status === "active" ? "badge-active" : item.status === "revoked" ? "badge-revoked" : "badge-draft"}>
          {item.status}
        </span>
      </div>

      <div className="card p-6 mb-6">
        <h2 className="font-semibold text-ink mb-4">Details</h2>
        <div className="space-y-2.5 text-sm">
          <Row label="Category" value={item.category.replace(/_/g, " ")} />
          <Row label="Brand" value={item.brand ?? "—"} />
          <Row label="Model" value={item.model ?? "—"} />
          <Row label="Condition" value={item.condition.replace(/_/g, " ")} />
          {item.description && <Row label="Description" value={item.description} />}
        </div>
      </div>

      {item.status === "draft" && (
        <div className="card p-6 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-ink">Photos ({item.photos.length}/8)</h2>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || item.photos.length >= 8}
              className="btn-secondary"
            >
              {uploading ? "Uploading…" : "+ Add photo"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/heic"
              hidden
              onChange={(e) => void handlePhotoUpload(e)}
            />
          </div>
          {item.photos.length === 0 ? (
            <p className="text-ink-soft text-sm">Add at least 3 photos (min 800×800).</p>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {item.photos.map((p) => (
                <div key={p.id} className="relative aspect-square bg-bg-muted rounded-lg border border-line">
                  <button
                    onClick={() => deletePhotoMutation.mutate(p.id)}
                    className="absolute top-1 right-1 bg-white border border-line rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-50"
                    aria-label="Delete photo"
                  >
                    ×
                  </button>
                  <span className="absolute bottom-1 left-1 text-xs bg-white/90 px-1.5 rounded text-ink-soft">
                    #{p.position + 1}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {item.status === "draft" && (
        <button
          onClick={() => issueMutation.mutate()}
          disabled={issueMutation.isPending || item.photos.length < 3}
          className="btn-primary w-full"
        >
          {issueMutation.isPending ? "Issuing…" : "Issue Certificate"}
        </button>
      )}

      {item.status === "active" && (
        <button
          onClick={() => {
            const reason = prompt("Reason for revocation?");
            if (reason !== null) revokeMutation.mutate(reason);
          }}
          disabled={revokeMutation.isPending}
          className="btn-danger w-full"
        >
          {revokeMutation.isPending ? "Revoking…" : "Revoke Certificate"}
        </button>
      )}

      {issueMutation.isError && (
        <p className="text-red-600 text-sm mt-3">{(issueMutation.error as Error).message}</p>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-ink-mute capitalize">{label}</span>
      <span className="text-ink text-right">{value}</span>
    </div>
  );
}
