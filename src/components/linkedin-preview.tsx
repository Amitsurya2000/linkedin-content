"use client";

import { ThumbsUp, MessageSquare, Repeat2, Send } from "lucide-react";

interface LinkedInPreviewProps {
  name: string;
  hook: string;
  body: string;
  hashtags: string[];
  postType?: string;
}

/**
 * A facsimile of a LinkedIn feed card, so a draft can be judged the way it will
 * actually be seen.
 *
 * It renders in LinkedIn's light chrome, which is both what the platform
 * defaults to and what the surrounding app is now. It had been LinkedIn dark
 * mode, and when the app was converted to light the two lines that carry the
 * post — the author name and the hook — were swept from white to #1A1414 while
 * the card stayed #1e1e1e. That is 1.09:1: the hook, the single most important
 * line in the draft, was rendering invisible.
 *
 * Colours below are LinkedIn's own: rgba(0,0,0,.9) for primary text, .6 for
 * secondary, #0A66C2 for links. All clear AA on white (5.7:1 at the weakest).
 */
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

  const hashtagText = hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ");

  return (
    <div className="bg-white rounded-xl border border-[#E0DFDC] overflow-hidden max-w-[550px] w-full shadow-sm">
      {/* Header */}
      <div className="p-4 flex items-start gap-3">
        {/* White on LinkedIn blue — 5.69:1. */}
        <div className="w-12 h-12 rounded-full bg-[#0A66C2] flex items-center justify-center text-white font-bold text-sm shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[#191919] font-semibold text-sm">{name}</p>
          <p className="text-[#666666] text-xs">
            {postType === "carousel" ? "Document" : "Post"} · 1st
          </p>
          <p className="text-[#666666] text-xs">Just now · 🌐</p>
        </div>
        <span className="text-[#666666] text-lg leading-none">···</span>
      </div>

      {/* Content */}
      <div className="px-4 pb-3">
        {/* Hook — bold and prominent */}
        <p className="text-[#191919] font-semibold text-[15px] leading-relaxed whitespace-pre-line mb-1">
          {hook}
        </p>

        {/* Body */}
        <div className="text-[#333333] text-[14px] leading-[1.6] whitespace-pre-line mt-2">
          {body}
        </div>

        {/* Hashtags */}
        {hashtags.length > 0 && (
          <p className="text-[#0A66C2] text-[14px] mt-3 font-medium">{hashtagText}</p>
        )}
      </div>

      {/* Engagement stats */}
      <div className="mx-4 py-2 border-t border-[#E0DFDC] flex items-center justify-between text-xs text-[#666666]">
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
      <div className="mx-2 py-1 border-t border-[#E0DFDC] flex items-center justify-around">
        {[
          { icon: ThumbsUp, label: "Like" },
          { icon: MessageSquare, label: "Comment" },
          { icon: Repeat2, label: "Repost" },
          { icon: Send, label: "Send" },
        ].map(({ icon: Icon, label }) => (
          <button
            key={label}
            className="flex items-center gap-2 px-4 py-3 rounded-lg text-[#666666] hover:bg-[#F3F2EF] hover:text-[#191919] transition-colors text-xs font-medium"
          >
            <Icon className="w-4 h-4" />
            <span>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
