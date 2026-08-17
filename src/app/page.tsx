import Link from "next/link";
import { auth } from "@/lib/auth";
import {
  Linkedin,
  ArrowRight,
  Zap,
  FileText,
  Layers,
  BarChart3,
  MessageSquare,
  Lightbulb,
  CheckCircle2,
  TrendingUp,
  Star,
} from "lucide-react";
import { AccentIcon, ACCENTS, type Accent } from "@/components/accent-icon";

/**
 * Colour rules this page follows, all measured rather than eyeballed:
 *
 * · Body copy is #6B5B5A (6.4:1 on white, 5.9:1 on blush). It used to be
 *   #C9B4B2 — the --text-deco token, which is decorative-only at 1.97:1 and was
 *   never meant to carry a sentence.
 * · Red as TEXT is #C9282A, never #ED383B. Brand red is 4.02:1 on white, which
 *   is fine for an icon (3:1) and short of AA for a word.
 * · Text on a red fill is white, and the fill is #D4302E→#C21D1D rather than
 *   #ED383B→#FF6A3D. White on that orange end was 2.85:1; on this one the worst
 *   end is 4.93:1.
 * · No near-black at partial alpha. #1A1414/30 on blush is 2.2:1 — the alpha was
 *   a holdover from the dark theme, where the same utility lightened text
 *   towards the background instead of erasing it.
 */
export default async function LandingPage() {
  const session = await auth();
  const isLoggedIn = !!session;

  return (
    <div className="min-h-screen bg-[#FDF3F2] text-[#1A1414] antialiased">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-[#FDF3F2]/85 backdrop-blur-xl border-b border-[#F2DAD8]">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* The mark is the one place the LinkedIn glyph should be LinkedIn's
                own blue rather than the app's red — it names the platform, not
                the product. White on #0A66C2 is 5.69:1. */}
            <div className="w-8 h-8 rounded-lg bg-[#0A66C2] flex items-center justify-center shadow-lg shadow-[#0A66C2]/25">
              <Linkedin className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight">LI Post Gen</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="#features" className="text-sm font-medium text-[#6B5B5A] hover:text-[#1A1414] transition-colors hidden sm:block">
              Features
            </a>
            <a href="#how-it-works" className="text-sm font-medium text-[#6B5B5A] hover:text-[#1A1414] transition-colors hidden sm:block">
              How it works
            </a>
            {isLoggedIn ? (
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-[#D4302E] text-white text-sm font-semibold hover:bg-[#C21D1D] transition-colors"
              >
                Dashboard
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            ) : (
              <div className="flex items-center gap-3">
                <Link
                  href="/login"
                  className="text-sm text-[#6B5B5A] hover:text-[#1A1414] font-medium transition-colors"
                >
                  Log In
                </Link>
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-[#D4302E] text-white text-sm font-semibold hover:bg-[#C21D1D] transition-colors"
                >
                  Sign Up
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        {/* Gradient orbs */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-gradient-to-b from-[#ED383B]/20 via-[#ED383B]/10 to-transparent blur-3xl rounded-full" />
        <div className="absolute top-40 left-1/4 w-[400px] h-[400px] bg-[#ED383B]/[.10] blur-3xl rounded-full" />
        <div className="absolute top-60 right-1/4 w-[300px] h-[300px] bg-[#ED383B]/8 blur-3xl rounded-full" />

        {/* Grid pattern overlay. Stroked in red — it was stroked in white, which
            on a blush ground drew nothing at all. */}
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M60 0H0v60' fill='none' stroke='%23C21D1D' stroke-width='0.5'/%3E%3C/svg%3E")`,
          }}
        />

        <div className="relative max-w-5xl mx-auto px-6 pt-28 pb-24 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-[#EFCB93] text-[#B45309] text-xs font-semibold mb-8 shadow-sm">
            <div className="w-1.5 h-1.5 rounded-full bg-[#B45309] animate-pulse" />
            AI-Powered LinkedIn Content
          </div>

          <h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tight leading-[1.1] mb-6">
            Generate LinkedIn Posts{" "}
            <span className="bg-gradient-to-r from-[#D4302E] via-[#C21D1D] to-[#D4302E] bg-clip-text text-transparent">
              That Go Viral
            </span>
          </h1>

          <p className="text-lg md:text-xl text-[#6B5B5A] max-w-2xl mx-auto mb-12 leading-relaxed">
            AI-powered content engine that crafts scroll-stopping LinkedIn posts,
            carousels, and articles. Write once, get noticed everywhere.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link
              href={isLoggedIn ? "/create" : "/signup"}
              className="group inline-flex items-center gap-2 px-8 py-3.5 rounded-lg bg-gradient-to-r from-[#D4302E] to-[#C21D1D] hover:from-[#C21D1D] hover:to-[#A81818] text-white font-semibold transition-all shadow-xl shadow-[#ED383B]/25 hover:shadow-[#ED383B]/40"
            >
              <Zap className="w-4 h-4" />
              {isLoggedIn ? "Create Posts" : "Start Creating for Free"}
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-lg bg-white border border-[#F2DAD8] text-[#453838] font-semibold hover:border-[#ED383B]/50 hover:text-[#1A1414] transition-all shadow-sm"
            >
              See How It Works
            </a>
          </div>

          {/* Social proof */}
          <div className="flex flex-col items-center gap-4">
            <div className="flex -space-x-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="w-9 h-9 rounded-full border-2 border-white bg-gradient-to-br from-[#D4302E] to-[#C21D1D] flex items-center justify-center text-white text-xs font-bold"
                >
                  {String.fromCharCode(64 + i)}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                ))}
              </div>
              <span className="text-sm text-[#6B5B5A]">
                Loved by content creators
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works - 3 Steps. White band against the blush page, which is the
          alternation the design system asks for — bg-white/[0.02] was invisible. */}
      <section id="how-it-works" className="border-y border-[#F2DAD8] bg-white">
        <div className="max-w-5xl mx-auto px-6 py-28">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#D7EBCE] border border-[#B2D8A4] text-[#44712E] text-xs font-semibold mb-6">
              <TrendingUp className="w-3.5 h-3.5" />
              Simple Workflow
            </div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              Three steps to{" "}
              <span className="bg-gradient-to-r from-[#D4302E] to-[#C21D1D] bg-clip-text text-transparent">
                viral content
              </span>
            </h2>
            <p className="text-[#6B5B5A] max-w-xl mx-auto">
              No copywriter needed. Just tell us your topic and let AI do the heavy lifting.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <StepCard
              number="01"
              title="Enter Your Topic"
              description="Type what you want to post about. Add your target audience and preferred tone for best results."
              gradient="from-[#D4302E] to-[#C21D1D]"
            />
            <StepCard
              number="02"
              title="AI Generates Posts"
              description="Our AI crafts multiple post variations with hooks, body text, hashtags, and engagement strategies tailored to LinkedIn."
              gradient="from-[#C21D1D] to-[#8E1B18]"
            />
            <StepCard
              number="03"
              title="Copy & Post to LinkedIn"
              description="Review the LinkedIn-style previews, pick your favorite, copy with one click, and paste directly into LinkedIn."
              gradient="from-[#8E1B18] to-[#D4302E]"
            />
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="max-w-6xl mx-auto px-6 py-28">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#DCE6F1] border border-[#B7CDE7] text-[#0A66C2] text-xs font-semibold mb-6">
            <Zap className="w-3.5 h-3.5" />
            Content Types
          </div>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
            Everything you need to{" "}
            <span className="bg-gradient-to-r from-[#D4302E] to-[#C21D1D] bg-clip-text text-transparent">
              dominate LinkedIn
            </span>
          </h2>
          <p className="text-[#6B5B5A] max-w-xl mx-auto">
            Three content formats, endless possibilities. Generate the right format for your message.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FeatureCard
            icon={FileText}
            accent="linkedin"
            title="Text Posts"
            description="Classic LinkedIn text posts with scroll-stopping hooks, compelling body copy, and strategic hashtags. The most popular format on LinkedIn."
            tag="Most Popular"
          />
          <FeatureCard
            icon={Layers}
            accent="amber"
            title="Carousel Posts"
            description="Multi-slide document posts that drive the highest engagement. Each slide crafted with clear messaging and visual flow."
            tag="Highest Engagement"
          />
          <FeatureCard
            icon={MessageSquare}
            accent="slate"
            title="Article Outlines"
            description="Long-form article outlines with structured sections, key talking points, and SEO-optimized headlines for LinkedIn articles."
            tag="Thought Leadership"
          />
        </div>
      </section>

      {/* Capabilities */}
      <section className="max-w-5xl mx-auto px-6 py-28">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
            Built for LinkedIn{" "}
            <span className="bg-gradient-to-r from-[#D4302E] to-[#C21D1D] bg-clip-text text-transparent">
              creators
            </span>
          </h2>
          <p className="text-[#6B5B5A] max-w-xl mx-auto">
            Every feature is designed to maximize your LinkedIn reach and engagement.
          </p>
        </div>

        {/* The accent is chosen by what the line MEANS — amber for the two that
            are about generating an idea, LinkedIn blue for the two that are
            about the platform, green for the one that completes something,
            slate for the one that is scaffolding. Six identical red icons told
            the reader nothing. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { icon: Zap, text: "Psychology-driven hooks that stop the scroll", accent: "amber" as const, glow: true },
            { icon: Lightbulb, text: "Multiple post variations to A/B test your content", accent: "amber" as const, glow: true },
            { icon: FileText, text: "LinkedIn-optimized hashtag suggestions", accent: "linkedin" as const },
            { icon: BarChart3, text: "Content calendar to plan your posting schedule", accent: "slate" as const },
            { icon: CheckCircle2, text: "One-click copy to clipboard for instant posting", accent: "green" as const },
            { icon: MessageSquare, text: "Caption variations for different audiences", accent: "linkedin" as const },
          ].map(({ icon: Icon, text, accent, glow }, i) => (
            <div
              key={i}
              className="flex items-center gap-4 rounded-xl bg-white border border-[#F2DAD8] px-5 py-4 hover:border-[#ED383B]/40 transition-all shadow-sm"
            >
              <AccentIcon icon={Icon} accent={accent} size="sm" glow={glow} />
              <span className="text-sm text-[#453838]">{text}</span>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#ED383B]/10 to-transparent" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#ED383B]/[.18] blur-3xl rounded-full" />

        <div className="relative max-w-4xl mx-auto px-6 py-28 text-center">
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-6">
            Stop overthinking.{" "}
            <span className="bg-gradient-to-r from-[#D4302E] via-[#C21D1D] to-[#8E1B18] bg-clip-text text-transparent">
              Start posting.
            </span>
          </h2>
          <p className="text-lg text-[#6B5B5A] mb-10 max-w-lg mx-auto">
            Join thousands of professionals creating high-impact LinkedIn content with AI.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href={isLoggedIn ? "/dashboard" : "/login"}
              className="group inline-flex items-center gap-2 px-8 py-4 rounded-lg bg-gradient-to-r from-[#D4302E] to-[#C21D1D] hover:from-[#C21D1D] hover:to-[#A81818] text-white font-bold text-lg transition-all shadow-xl shadow-[#ED383B]/25 hover:shadow-[#ED383B]/40"
            >
              {isLoggedIn ? "Go to Dashboard" : "Get Started Free"}
              <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-lg bg-white border border-[#F2DAD8] text-[#453838] font-semibold hover:border-[#ED383B]/50 hover:text-[#1A1414] transition-all shadow-sm"
            >
              Create Account
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#F2DAD8] bg-white">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-[#0A66C2] flex items-center justify-center">
                <Linkedin className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-sm font-bold">LI Post Gen</span>
            </div>
            <div className="flex items-center gap-6 text-xs font-medium text-[#6B5B5A]">
              <span className="hover:text-[#C9282A] cursor-pointer transition-colors">Privacy</span>
              <span className="hover:text-[#C9282A] cursor-pointer transition-colors">Terms</span>
              <span className="hover:text-[#C9282A] cursor-pointer transition-colors">Support</span>
            </div>
            <p className="text-xs text-[#776462]">
              &copy; {new Date().getFullYear()} LI Post Gen. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  accent,
  title,
  description,
  tag,
}: {
  icon: React.ElementType;
  accent: Accent;
  title: string;
  description: string;
  tag: string;
}) {
  const a = ACCENTS[accent];
  return (
    <div className="rounded-2xl bg-white border border-[#F2DAD8] p-8 hover:border-[#ED383B]/40 transition-all group shadow-sm">
      <div className="flex items-center justify-between gap-3 mb-5">
        <AccentIcon icon={icon} accent={accent} size="lg" />
        {/* The tag takes the card's accent as TEXT on white, where the palette
            measures 5:1 and up — not on its own tint, where it would not. */}
        <span
          className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border bg-white"
          style={{ color: a.fg, borderColor: a.ring }}
        >
          {tag}
        </span>
      </div>
      <h3 className="text-xl font-bold mb-2">{title}</h3>
      <p className="text-[#6B5B5A] leading-relaxed text-sm">{description}</p>
    </div>
  );
}

function StepCard({
  number,
  title,
  description,
  gradient,
}: {
  number: string;
  title: string;
  description: string;
  gradient: string;
}) {
  return (
    <div className="relative rounded-2xl bg-[#FDF3F2] border border-[#F2DAD8] p-8 hover:border-[#ED383B]/30 transition-all group">
      {/* The step number used to sit at opacity-30 over a light gradient, which
          measured about 1.3:1 — a numeral nobody could read. At full strength on
          the darkened ramp it clears AA-large several times over. */}
      <div className={`text-5xl font-extrabold bg-gradient-to-br ${gradient} bg-clip-text text-transparent mb-4`}>
        {number}
      </div>
      <h3 className="text-lg font-bold mb-3">{title}</h3>
      <p className="text-sm text-[#6B5B5A] leading-relaxed">{description}</p>
    </div>
  );
}
