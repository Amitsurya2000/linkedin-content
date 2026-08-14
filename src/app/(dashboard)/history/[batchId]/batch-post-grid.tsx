"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Copy, Check, Layers } from "lucide-react";
import { SwipeDeck } from "@/components/swipe-deck";

interface Post {
  id: string;
  postType: string;
  hookCategory: string;
  hook: string;
  body: string;
  hashtags: string;
  cta: string;
  imageUrl?: string | null;
  carouselImages?: string | null;
  approvalStatus: string;
}

function parseArr(v?: string | null): string[] {
  if (!v) return [];
  try {
    const p = JSON.parse(v);
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
}

function PostItem({ post }: { post: Post }) {
  const [copied, setCopied] = useState(false);
  const hashtags = parseArr(post.hashtags);
  const carousel = parseArr(post.carouselImages);

  async function copyPost() {
    const tags = hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ");
    const full = `${post.hook}\n\n${post.body}${tags ? `\n\n${tags}` : ""}`;
    try {
      await navigator.clipboard.writeText(full);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Copied — paste into LinkedIn");
    } catch {
      toast.error("Failed to copy");
    }
  }

  return (
    <div className="bg-[#FFFFFF] border border-[#F5C5C7] rounded-2xl overflow-hidden">
      <div className="p-5 space-y-3">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full bg-[#ED383B]/10 text-[#ED383B] border border-[#ED383B]/20">
          {post.hookCategory}
        </span>
        <p className="text-[#1A1A1A] font-semibold leading-snug">{post.hook}</p>
        <p className="text-sm text-[#6B6B6B] whitespace-pre-line line-clamp-6">{post.body}</p>
      </div>

      {carousel.length > 0 ? (
        <div className="px-5 pb-3">
          <p className="text-xs text-[#6B6B6B] mb-2 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-[#ED383B]" /> {carousel.length} slides
          </p>
          <SwipeDeck slideClassName="w-[45%]" label="Carousel slides">
            {carousel.map((url, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={url} alt={`Slide ${i + 1}`} className="w-full rounded-lg border border-[#F5C5C7] select-none pointer-events-none" draggable={false} />
            ))}
          </SwipeDeck>
        </div>
      ) : post.imageUrl ? (
        <div className="px-5 pb-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={post.imageUrl} alt="Post visual" className="w-full rounded-xl border border-[#F5C5C7]" />
        </div>
      ) : null}

      <div className="px-5 py-4">
        <button
          onClick={copyPost}
          className="w-full h-10 bg-[#ED383B] hover:bg-[#ED383B]/90 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors"
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          {copied ? "Copied!" : "Copy Post"}
        </button>
      </div>
    </div>
  );
}

export function BatchPostGrid({ initialPosts }: { initialPosts: Post[]; batchId: string }) {
  if (!initialPosts.length) {
    return <p className="text-[#6B6B6B] text-sm">No posts in this batch.</p>;
  }
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {initialPosts.map((p) => (
        <PostItem key={p.id} post={p} />
      ))}
    </div>
  );
}
