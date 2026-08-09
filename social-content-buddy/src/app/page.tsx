import Link from "next/link";
import { auth } from "@/lib/auth";
import {
  Sparkles,
  ImageIcon,
  Layers,
  Calendar,
  ArrowRight,
  Zap,
  Globe,
  Palette,
  BarChart3,
  Users,
  Clock,
  CheckCircle2,
  Star,
  TrendingUp,
  MousePointerClick,
} from "lucide-react";

export default async function LandingPage() {
  const session = await auth();
  const isLoggedIn = !!session;

  return (
    <div className="min-h-screen bg-[#09090b] text-white antialiased">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-[#09090b]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight">PostAI</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="#features" className="text-sm text-white/50 hover:text-white transition-colors hidden sm:block">
              Features
            </a>
            <a href="#how-it-works" className="text-sm text-white/50 hover:text-white transition-colors hidden sm:block">
              How it works
            </a>
            <Link
              href={isLoggedIn ? "/dashboard" : "/login"}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-white text-[#09090b] text-sm font-semibold hover:bg-white/90 transition-colors"
            >
              {isLoggedIn ? "Dashboard" : "Get Started"}
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        {/* Gradient orbs */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-gradient-to-b from-violet-600/20 via-purple-600/10 to-transparent blur-3xl rounded-full" />
        <div className="absolute top-40 left-1/4 w-[400px] h-[400px] bg-violet-500/10 blur-3xl rounded-full" />
        <div className="absolute top-60 right-1/4 w-[300px] h-[300px] bg-purple-500/10 blur-3xl rounded-full" />

        {/* Grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M60 0H0v60' fill='none' stroke='white' stroke-width='0.5'/%3E%3C/svg%3E")`,
          }}
        />

        <div className="relative max-w-5xl mx-auto px-6 pt-28 pb-24 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-violet-300 text-xs font-medium mb-8 backdrop-blur-sm">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Now in Early Access
          </div>

          <h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tight leading-[1.1] mb-6">
            Turn any business into a{" "}
            <span className="bg-gradient-to-r from-violet-400 via-purple-400 to-violet-400 bg-clip-text text-transparent">
              content machine
            </span>
          </h1>

          <p className="text-lg md:text-xl text-white/40 max-w-2xl mx-auto mb-12 leading-relaxed">
            AI-powered Instagram content that looks like you hired a design agency.
            Generate scroll-stopping posts, captions, and hashtags — then publish
            with one click.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link
              href={isLoggedIn ? "/create" : "/login"}
              className="group inline-flex items-center gap-2 px-8 py-3.5 rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-semibold transition-all shadow-xl shadow-violet-500/25 hover:shadow-violet-500/40"
            >
              <Sparkles className="w-4 h-4" />
              {isLoggedIn ? "Create Posts" : "Start Creating for Free"}
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-lg bg-white/5 border border-white/10 text-white/70 font-semibold hover:bg-white/10 hover:text-white transition-all backdrop-blur-sm"
            >
              See How It Works
            </a>
          </div>

          {/* Social proof */}
          <div className="flex flex-col items-center gap-4">
            <div className="flex -space-x-3">
              {[
                "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&fit=crop&crop=face",
                "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=80&h=80&fit=crop&crop=face",
                "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&h=80&fit=crop&crop=face",
                "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop&crop=face",
                "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=80&h=80&fit=crop&crop=face",
              ].map((src, i) => (
                <img
                  key={i}
                  src={src}
                  alt=""
                  className="w-9 h-9 rounded-full border-2 border-[#09090b] object-cover"
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <span className="text-sm text-white/40">
                Loved by early adopters
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="border-y border-white/5 bg-white/[0.02]">
        <div className="max-w-5xl mx-auto px-6 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { value: "10x", label: "Faster than manual design", icon: Zap },
              { value: "1080px", label: "Instagram-ready quality", icon: ImageIcon },
              { value: "10+", label: "Posts per batch", icon: Layers },
              { value: "<60s", label: "Average generation time", icon: Clock },
            ].map((stat, i) => (
              <div key={i} className="text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <stat.icon className="w-4 h-4 text-violet-400" />
                  <span className="text-2xl md:text-3xl font-extrabold bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
                    {stat.value}
                  </span>
                </div>
                <p className="text-xs text-white/30 font-medium">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features — Bento Grid */}
      <section id="features" className="max-w-6xl mx-auto px-6 py-28">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-violet-300 text-xs font-medium mb-6">
            <Zap className="w-3.5 h-3.5" />
            Powerful Features
          </div>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
            Everything you need to{" "}
            <span className="bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
              dominate social
            </span>
          </h2>
          <p className="text-white/40 max-w-xl mx-auto">
            A complete content engine — from ideation to publishing — built for
            businesses that take their brand seriously.
          </p>
        </div>

        {/* Bento grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Large card */}
          <div className="md:col-span-2 rounded-2xl bg-gradient-to-br from-violet-600/10 to-purple-600/5 border border-white/5 p-8 hover:border-violet-500/20 transition-all group">
            <div className="w-12 h-12 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mb-5">
              <Sparkles className="w-6 h-6 text-violet-400" />
            </div>
            <h3 className="text-xl font-bold mb-2">AI-Powered Design Intelligence</h3>
            <p className="text-white/40 leading-relaxed max-w-lg">
              Our AI reads your website, understands your brand, and generates
              psychology-driven design briefs with proven hook categories. Every post
              is crafted to stop the scroll and drive engagement.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {["Hook Psychology", "Brand Analysis", "Caption Variations", "Hashtag Research"].map((tag) => (
                <span key={tag} className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-white/50">
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Small card */}
          <BentoCard
            icon={<ImageIcon className="w-5 h-5 text-violet-400" />}
            title="Studio-Quality Images"
            description="Generate pixel-perfect 1080x1080 Instagram graphics that look like a professional designer made them."
          />

          <BentoCard
            icon={<Layers className="w-5 h-5 text-violet-400" />}
            title="Batch Generation"
            description="Create up to 10 posts simultaneously with real-time streaming. Watch them appear as they're generated."
          />

          <BentoCard
            icon={<Palette className="w-5 h-5 text-violet-400" />}
            title="Brand Kit Integration"
            description="Upload your colors, fonts, and guidelines. Every generated post stays perfectly on-brand, every time."
          />

          {/* Large card */}
          <div className="md:col-span-2 lg:col-span-1 rounded-2xl bg-gradient-to-br from-purple-600/10 to-fuchsia-600/5 border border-white/5 p-8 hover:border-purple-500/20 transition-all">
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-5">
              <Calendar className="w-6 h-6 text-purple-400" />
            </div>
            <h3 className="text-xl font-bold mb-2">Visual Content Calendar</h3>
            <p className="text-white/40 leading-relaxed">
              Drag-and-drop scheduling with approval workflows. Plan your entire
              month, get team approval, and publish — all from one beautiful calendar.
            </p>
          </div>

          <BentoCard
            icon={<Globe className="w-5 h-5 text-violet-400" />}
            title="One-Click Publishing"
            description="Connect your Instagram account and publish directly. No downloads, no manual uploads. Just click and go."
          />

          <BentoCard
            icon={<Users className="w-5 h-5 text-violet-400" />}
            title="Team Workspaces"
            description="Manage multiple brands from one account. Each workspace has its own profile, brand kit, and content pipeline."
          />

          <BentoCard
            icon={<MousePointerClick className="w-5 h-5 text-violet-400" />}
            title="Inline Editing"
            description="Edit captions, hashtags, and hooks right where you see them. Pick from AI-generated caption variations instantly."
          />
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="border-y border-white/5 bg-white/[0.02]">
        <div className="max-w-5xl mx-auto px-6 py-28">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-violet-300 text-xs font-medium mb-6">
              <TrendingUp className="w-3.5 h-3.5" />
              Simple Workflow
            </div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              Three steps to{" "}
              <span className="bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
                stunning content
              </span>
            </h2>
            <p className="text-white/40 max-w-xl mx-auto">
              No design skills required. No complicated setup. Just tell us about
              your business and watch the magic happen.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <StepCard
              number="01"
              title="Set Up Your Brand"
              description="Create a workspace, add your business details, and configure your brand kit with colors, fonts, and guidelines."
              gradient="from-violet-500 to-purple-500"
            />
            <StepCard
              number="02"
              title="Generate Content"
              description="Hit create and watch AI analyze your brand, generate psychology-driven design briefs, and produce stunning visuals in real-time."
              gradient="from-purple-500 to-fuchsia-500"
            />
            <StepCard
              number="03"
              title="Review & Publish"
              description="Edit captions inline, pick from AI variations, schedule via the content calendar, and publish to Instagram with one click."
              gradient="from-fuchsia-500 to-pink-500"
            />
          </div>
        </div>
      </section>

      {/* Capabilities showcase */}
      <section className="max-w-5xl mx-auto px-6 py-28">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
            Built for teams that{" "}
            <span className="bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
              move fast
            </span>
          </h2>
          <p className="text-white/40 max-w-xl mx-auto">
            Every feature is designed to eliminate bottlenecks in your content
            pipeline.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { icon: BarChart3, text: "Psychology-driven hook categories that maximize engagement" },
            { icon: Layers, text: "Generate up to 10 on-brand posts in a single batch" },
            { icon: Palette, text: "Brand kit ensures every post matches your visual identity" },
            { icon: Calendar, text: "Visual calendar with drag-and-drop scheduling" },
            { icon: Users, text: "Multi-workspace support for agencies and multi-brand businesses" },
            { icon: Globe, text: "Direct Instagram publishing — no manual downloads needed" },
            { icon: CheckCircle2, text: "Approval workflows: Draft → Approved → Scheduled → Published" },
            { icon: Clock, text: "Timezone-aware scheduling for global teams" },
          ].map(({ icon: Icon, text }, i) => (
            <div
              key={i}
              className="flex items-center gap-4 rounded-xl bg-white/[0.03] border border-white/5 px-5 py-4 hover:border-violet-500/20 transition-all"
            >
              <Icon className="w-5 h-5 text-violet-400 shrink-0" />
              <span className="text-sm text-white/60">{text}</span>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-violet-600/10 to-transparent" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-violet-500/15 blur-3xl rounded-full" />

        <div className="relative max-w-4xl mx-auto px-6 py-28 text-center">
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-6">
            Stop designing.{" "}
            <span className="bg-gradient-to-r from-violet-400 via-purple-400 to-fuchsia-400 bg-clip-text text-transparent">
              Start publishing.
            </span>
          </h2>
          <p className="text-lg text-white/40 mb-10 max-w-lg mx-auto">
            Join the next generation of businesses creating professional social
            content at scale with AI.
          </p>
          <Link
            href={isLoggedIn ? "/dashboard" : "/login"}
            className="group inline-flex items-center gap-2 px-8 py-4 rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-bold text-lg transition-all shadow-xl shadow-violet-500/25 hover:shadow-violet-500/40"
          >
            {isLoggedIn ? "Go to Dashboard" : "Get Started — It's Free"}
            <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-sm font-bold">PostAI</span>
            </div>
            <div className="flex items-center gap-6 text-xs text-white/30">
              <span className="hover:text-white/60 cursor-pointer transition-colors">Privacy</span>
              <span className="hover:text-white/60 cursor-pointer transition-colors">Terms</span>
              <span className="hover:text-white/60 cursor-pointer transition-colors">Support</span>
            </div>
            <p className="text-xs text-white/20">
              &copy; {new Date().getFullYear()} PostAI. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function BentoCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-6 hover:border-violet-500/20 hover:bg-white/[0.04] transition-all group">
      <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-4 group-hover:border-violet-500/30 transition-colors">
        {icon}
      </div>
      <h3 className="text-base font-semibold mb-2">{title}</h3>
      <p className="text-sm text-white/35 leading-relaxed">{description}</p>
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
    <div className="relative rounded-2xl bg-white/[0.02] border border-white/5 p-8 hover:border-violet-500/20 transition-all group">
      <div className={`text-5xl font-extrabold bg-gradient-to-br ${gradient} bg-clip-text text-transparent opacity-20 mb-4`}>
        {number}
      </div>
      <h3 className="text-lg font-bold mb-3">{title}</h3>
      <p className="text-sm text-white/40 leading-relaxed">{description}</p>
    </div>
  );
}
