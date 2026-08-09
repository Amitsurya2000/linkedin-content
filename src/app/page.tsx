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

export default async function LandingPage() {
  const session = await auth();
  const isLoggedIn = !!session;

  return (
    <div className="min-h-screen bg-[#0f172a] text-white antialiased">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-[#0f172a]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#ED383B] flex items-center justify-center shadow-lg shadow-[#ED383B]/25">
              <Linkedin className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight">LI Post Gen</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="#features" className="text-sm text-white/50 hover:text-white transition-colors hidden sm:block">
              Features
            </a>
            <a href="#how-it-works" className="text-sm text-white/50 hover:text-white transition-colors hidden sm:block">
              How it works
            </a>
            {isLoggedIn ? (
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-[#ED383B] text-white text-sm font-semibold hover:bg-[#ED383B]/90 transition-colors"
              >
                Dashboard
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            ) : (
              <div className="flex items-center gap-3">
                <Link
                  href="/login"
                  className="text-sm text-white/60 hover:text-white font-medium transition-colors"
                >
                  Log In
                </Link>
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-[#ED383B] text-white text-sm font-semibold hover:bg-[#ED383B]/90 transition-colors"
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
        <div className="absolute top-40 left-1/4 w-[400px] h-[400px] bg-[#ED383B]/10 blur-3xl rounded-full" />
        <div className="absolute top-60 right-1/4 w-[300px] h-[300px] bg-[#ED383B]/8 blur-3xl rounded-full" />

        {/* Grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M60 0H0v60' fill='none' stroke='white' stroke-width='0.5'/%3E%3C/svg%3E")`,
          }}
        />

        <div className="relative max-w-5xl mx-auto px-6 pt-28 pb-24 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-[#ED383B] text-xs font-medium mb-8 backdrop-blur-sm">
            <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
            AI-Powered LinkedIn Content
          </div>

          <h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tight leading-[1.1] mb-6">
            Generate LinkedIn Posts{" "}
            <span className="bg-gradient-to-r from-[#ED383B] via-[#DB272A] to-[#ED383B] bg-clip-text text-transparent">
              That Go Viral
            </span>
          </h1>

          <p className="text-lg md:text-xl text-white/40 max-w-2xl mx-auto mb-12 leading-relaxed">
            AI-powered content engine that crafts scroll-stopping LinkedIn posts,
            carousels, articles, and polls. Write once, get noticed everywhere.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link
              href={isLoggedIn ? "/create" : "/signup"}
              className="group inline-flex items-center gap-2 px-8 py-3.5 rounded-lg bg-gradient-to-r from-[#ED383B] to-[#DB272A] hover:from-[#ED383B]/90 hover:to-[#DB272A]/90 text-white font-semibold transition-all shadow-xl shadow-[#ED383B]/25 hover:shadow-[#ED383B]/40"
            >
              <Zap className="w-4 h-4" />
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
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="w-9 h-9 rounded-full border-2 border-[#0f172a] bg-gradient-to-br from-[#ED383B] to-[#DB272A] flex items-center justify-center text-white text-xs font-bold"
                >
                  {String.fromCharCode(64 + i)}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <span className="text-sm text-white/40">
                Loved by content creators
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works - 3 Steps */}
      <section id="how-it-works" className="border-y border-white/5 bg-white/[0.02]">
        <div className="max-w-5xl mx-auto px-6 py-28">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-[#ED383B] text-xs font-medium mb-6">
              <TrendingUp className="w-3.5 h-3.5" />
              Simple Workflow
            </div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              Three steps to{" "}
              <span className="bg-gradient-to-r from-[#ED383B] to-[#DB272A] bg-clip-text text-transparent">
                viral content
              </span>
            </h2>
            <p className="text-white/40 max-w-xl mx-auto">
              No copywriter needed. Just tell us your topic and let AI do the heavy lifting.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <StepCard
              number="01"
              title="Enter Your Topic"
              description="Type what you want to post about. Add your industry, target audience, and preferred tone for best results."
              gradient="from-[#ED383B] to-[#DB272A]"
            />
            <StepCard
              number="02"
              title="AI Generates Posts"
              description="Our AI crafts multiple post variations with hooks, body text, hashtags, and engagement strategies tailored to LinkedIn."
              gradient="from-[#DB272A] to-[#F77274]"
            />
            <StepCard
              number="03"
              title="Copy & Post to LinkedIn"
              description="Review the LinkedIn-style previews, pick your favorite, copy with one click, and paste directly into LinkedIn."
              gradient="from-[#F77274] to-[#ED383B]"
            />
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="max-w-6xl mx-auto px-6 py-28">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-[#ED383B] text-xs font-medium mb-6">
            <Zap className="w-3.5 h-3.5" />
            Content Types
          </div>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
            Everything you need to{" "}
            <span className="bg-gradient-to-r from-[#ED383B] to-[#DB272A] bg-clip-text text-transparent">
              dominate LinkedIn
            </span>
          </h2>
          <p className="text-white/40 max-w-xl mx-auto">
            Four content formats, endless possibilities. Generate the right format for your message.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FeatureCard
            icon={<FileText className="w-6 h-6 text-[#ED383B]" />}
            title="Text Posts"
            description="Classic LinkedIn text posts with scroll-stopping hooks, compelling body copy, and strategic hashtags. The most popular format on LinkedIn."
            tag="Most Popular"
          />
          <FeatureCard
            icon={<Layers className="w-6 h-6 text-[#ED383B]" />}
            title="Carousel Posts"
            description="Multi-slide document posts that drive the highest engagement. Each slide crafted with clear messaging and visual flow."
            tag="Highest Engagement"
          />
          <FeatureCard
            icon={<MessageSquare className="w-6 h-6 text-[#ED383B]" />}
            title="Article Outlines"
            description="Long-form article outlines with structured sections, key talking points, and SEO-optimized headlines for LinkedIn articles."
            tag="Thought Leadership"
          />
          <FeatureCard
            icon={<BarChart3 className="w-6 h-6 text-[#ED383B]" />}
            title="Poll Ideas"
            description="Interactive polls with context posts that spark conversation and boost your visibility in the LinkedIn algorithm."
            tag="Algorithm Boost"
          />
        </div>
      </section>

      {/* Capabilities */}
      <section className="max-w-5xl mx-auto px-6 py-28">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
            Built for LinkedIn{" "}
            <span className="bg-gradient-to-r from-[#ED383B] to-[#DB272A] bg-clip-text text-transparent">
              creators
            </span>
          </h2>
          <p className="text-white/40 max-w-xl mx-auto">
            Every feature is designed to maximize your LinkedIn reach and engagement.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { icon: Zap, text: "Psychology-driven hooks that stop the scroll" },
            { icon: Lightbulb, text: "Multiple post variations to A/B test your content" },
            { icon: FileText, text: "LinkedIn-optimized hashtag suggestions" },
            { icon: BarChart3, text: "Content calendar to plan your posting schedule" },
            { icon: CheckCircle2, text: "One-click copy to clipboard for instant posting" },
            { icon: MessageSquare, text: "Caption variations for different audiences" },
          ].map(({ icon: Icon, text }, i) => (
            <div
              key={i}
              className="flex items-center gap-4 rounded-xl bg-[#1e293b]/50 border border-[#334155] px-5 py-4 hover:border-[#ED383B]/40 transition-all"
            >
              <Icon className="w-5 h-5 text-[#ED383B] shrink-0" />
              <span className="text-sm text-white/60">{text}</span>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#ED383B]/10 to-transparent" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#ED383B]/15 blur-3xl rounded-full" />

        <div className="relative max-w-4xl mx-auto px-6 py-28 text-center">
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-6">
            Stop overthinking.{" "}
            <span className="bg-gradient-to-r from-[#ED383B] via-[#DB272A] to-[#F77274] bg-clip-text text-transparent">
              Start posting.
            </span>
          </h2>
          <p className="text-lg text-white/40 mb-10 max-w-lg mx-auto">
            Join thousands of professionals creating high-impact LinkedIn content with AI.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href={isLoggedIn ? "/dashboard" : "/login"}
              className="group inline-flex items-center gap-2 px-8 py-4 rounded-lg bg-gradient-to-r from-[#ED383B] to-[#DB272A] hover:from-[#ED383B]/90 hover:to-[#DB272A]/90 text-white font-bold text-lg transition-all shadow-xl shadow-[#ED383B]/25 hover:shadow-[#ED383B]/40"
            >
              {isLoggedIn ? "Go to Dashboard" : "Get Started Free"}
              <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-lg bg-white/5 border border-white/10 text-white/70 font-semibold hover:bg-white/10 hover:text-white transition-all"
            >
              Create Account
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-[#ED383B] flex items-center justify-center">
                <Linkedin className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-sm font-bold">LI Post Gen</span>
            </div>
            <div className="flex items-center gap-6 text-xs text-white/30">
              <span className="hover:text-white/60 cursor-pointer transition-colors">Privacy</span>
              <span className="hover:text-white/60 cursor-pointer transition-colors">Terms</span>
              <span className="hover:text-white/60 cursor-pointer transition-colors">Support</span>
            </div>
            <p className="text-xs text-white/20">
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
  title,
  description,
  tag,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  tag: string;
}) {
  return (
    <div className="rounded-2xl bg-[#1e293b]/60 border border-[#334155] p-8 hover:border-[#ED383B]/40 transition-all group">
      <div className="flex items-center justify-between mb-5">
        <div className="w-12 h-12 rounded-xl bg-[#ED383B]/10 border border-[#ED383B]/20 flex items-center justify-center">
          {icon}
        </div>
        <span className="text-[10px] font-medium uppercase tracking-wider text-[#ED383B] bg-[#ED383B]/10 px-2.5 py-1 rounded-full border border-[#ED383B]/20">
          {tag}
        </span>
      </div>
      <h3 className="text-xl font-bold mb-2">{title}</h3>
      <p className="text-white/40 leading-relaxed text-sm">{description}</p>
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
    <div className="relative rounded-2xl bg-[#1e293b]/40 border border-[#334155] p-8 hover:border-[#ED383B]/30 transition-all group">
      <div className={`text-5xl font-extrabold bg-gradient-to-br ${gradient} bg-clip-text text-transparent opacity-30 mb-4`}>
        {number}
      </div>
      <h3 className="text-lg font-bold mb-3">{title}</h3>
      <p className="text-sm text-white/40 leading-relaxed">{description}</p>
    </div>
  );
}
