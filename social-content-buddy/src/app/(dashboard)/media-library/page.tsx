"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { useWorkspace } from "@/components/workspace-context";
import { Upload, Trash2, Loader2, ImageIcon, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface MediaAsset {
  id: string;
  url: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
}

const MAX_MEDIA = 100;

export default function MediaLibraryPage() {
  const { activeWorkspace } = useWorkspace();
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchAssets = useCallback(async () => {
    if (!activeWorkspace) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/media?workspace=${activeWorkspace.id}`);
      if (res.ok) {
        const data = await res.json();
        setAssets(data.assets);
      }
    } catch {
      toast.error("Failed to load media library");
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  async function handleUpload(files: FileList | null) {
    if (!files || !activeWorkspace) return;

    const fileArray = Array.from(files);
    const remaining = MAX_MEDIA - assets.length;

    if (fileArray.length > remaining) {
      toast.error(
        `Can only upload ${remaining} more image${remaining === 1 ? "" : "s"} (${MAX_MEDIA} max)`
      );
      return;
    }

    setUploading(true);
    let uploaded = 0;

    for (const file of fileArray) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name} exceeds 5MB limit`);
        continue;
      }
      if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
        toast.error(`${file.name} is not a supported format`);
        continue;
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("workspaceId", activeWorkspace.id);

      try {
        const res = await fetch("/api/media", {
          method: "POST",
          body: formData,
        });
        if (res.ok) {
          const data = await res.json();
          setAssets((prev) => [...prev, data.asset]);
          uploaded++;
        } else {
          const data = await res.json().catch(() => ({ error: "Upload failed" }));
          toast.error(data.error || `Failed to upload ${file.name}`);
        }
      } catch {
        toast.error(`Failed to upload ${file.name}`);
      }
    }

    if (uploaded > 0) {
      toast.success(`Uploaded ${uploaded} image${uploaded === 1 ? "" : "s"}`);
    }
    setUploading(false);
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch("/api/media", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setAssets((prev) => prev.filter((a) => a.id !== id));
        toast.success("Image deleted");
      } else {
        toast.error("Failed to delete image");
      }
    } catch {
      toast.error("Failed to delete image");
    } finally {
      setDeletingId(null);
    }
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (!activeWorkspace) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-3">
        <AlertCircle className="w-8 h-8" />
        <p className="text-sm">Select a workspace to view its media library.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight italic">
            Media Library
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {assets.length} / {MAX_MEDIA} images &middot; {activeWorkspace.name}
          </p>
        </div>
        <label
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
            uploading || assets.length >= MAX_MEDIA
              ? "bg-slate-100 text-slate-400 cursor-not-allowed"
              : "bg-violet-600 text-white hover:bg-violet-700 shadow-sm"
          }`}
        >
          {uploading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Upload className="w-4 h-4" />
          )}
          {uploading ? "Uploading..." : "Upload Images"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            className="hidden"
            disabled={uploading || assets.length >= MAX_MEDIA}
            onChange={(e) => {
              handleUpload(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
      </div>

      {/* Capacity bar */}
      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            assets.length >= MAX_MEDIA ? "bg-red-500" : "bg-violet-500"
          }`}
          style={{ width: `${Math.min((assets.length / MAX_MEDIA) * 100, 100)}%` }}
        />
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-6 h-6 text-violet-500 animate-spin" />
        </div>
      ) : assets.length === 0 ? (
        <label className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-slate-200 rounded-2xl hover:border-violet-300 hover:bg-violet-50/30 transition-colors cursor-pointer gap-3">
          <ImageIcon className="w-10 h-10 text-slate-300" />
          <p className="text-sm text-slate-400">
            No images yet. Click to upload your first product photos.
          </p>
          <p className="text-xs text-slate-300">PNG, JPG, WebP &middot; Max 5MB each</p>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            className="hidden"
            onChange={(e) => {
              handleUpload(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {assets.map((asset) => (
            <div
              key={asset.id}
              className="group relative aspect-square rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow"
            >
              <Image
                src={asset.url}
                alt={asset.filename}
                fill
                className="object-contain p-2"
                unoptimized
              />
              {/* Overlay on hover */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-end justify-between p-2 opacity-0 group-hover:opacity-100">
                <span className="text-[10px] text-white/80 truncate max-w-[70%]">
                  {formatSize(asset.sizeBytes)}
                </span>
                <button
                  onClick={() => handleDelete(asset.id)}
                  disabled={deletingId === asset.id}
                  className="w-7 h-7 rounded-lg bg-red-500/90 hover:bg-red-600 flex items-center justify-center text-white transition-colors cursor-pointer"
                >
                  {deletingId === asset.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
