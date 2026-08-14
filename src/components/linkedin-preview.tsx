"use client";

import { ThumbsUp, MessageSquare, Repeat2, Send } from "lucide-react";

interface LinkedInPreviewProps {
  name: string;
  hook: string;
  body: string;
  hashtags: string[];
  postType?: string;
}

export function LinkedInPreview({
  name,
  hook,
  body,
  hashtags,
  postType = "text",
}: LinkedInPreviewProps) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const fullPost = `${hook}\n\n${body}`;
  const hashtagText = hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ");

  return (
    <div className="bg-[#1e1e1e] rounded-xl border border-[#333] overflow-hidden max-w-[550px] w-full">
      {/* Header */}
      <div className="p-4 flex items-start gap-3">
        {/* Stays white: this avatar sits on LinkedIn blue, not on a KOYOPO surface. */}
        <div className="w-12 h-12 rounded-full bg-[#0A66C2] flex items-center justify-center text-white font-bold text-sm shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[#1A1A1A] font-semibold text-sm">{name}</p>
          <p className="text-[#8b8b8b] text-xs">
            {postType === "carousel" ? "Document" : "Post"} · 1st
          </p>
          <p className="text-[#8b8b8b] text-xs">Just now · 🌐</p>
        </div>
        <span className="text-[#8b8b8b] text-lg">···</span>
      </div>

      {/* Content */}
      <div className="px-4 pb-3">
        {/* Hook - bold and prominent */}
        <p className="text-[#1A1A1A] font-semibold text-[15px] leading-relaxed whitespace-pre-line mb-1">
          {hook}
        </p>

        {/* Body */}
        <div className="text-[#d1d1d1] text-[14px] leading-[1.6] whitespace-pre-line mt-2">
          {body}
        </div>

        {/* Hashtags */}
        {hashtags.length > 0 && (
          <p className="text-[#71b7fb] text-[14px] mt-3">{hashtagText}</p>
        )}
      </div>

      {/* Engagement stats */}
      <div className="mx-4 py-2 border-t border-[#333] flex items-center justify-between text-xs text-[#8b8b8b]">
        <div className="flex items-center gap-1">
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#0A66C2] text-[8px]">
            👍
          </span>
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#df704d] -ml-1 text-[8px]">
            ❤️
          </span>
          <span className="ml-1">42</span>
        </div>
        <span>3 comments · 2 reposts</span>
      </div>

      {/* Action buttons */}
      <div className="mx-2 py-1 border-t border-[#333] flex items-center justify-around">
        {[
          { icon: ThumbsUp, label: "Like" },
          { icon: MessageSquare, label: "Comment" },
          { icon: Repeat2, label: "Repost" },
          { icon: Send, label: "Send" },
        ].map(({ icon: Icon, label }) => (
          <button
            key={label}
            className="flex items-center gap-2 px-4 py-3 rounded-lg text-[#8b8b8b] hover:bg-[#333] transition-colors text-xs font-medium"
          >
            <Icon className="w-4 h-4" />
            <span>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
