"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, KeyRound } from "lucide-react";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, inviteCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to create account.");
        return;
      }
      const signInResult = await signIn("credentials", { email, password, redirect: false });
      if (signInResult?.error) {
        toast.error("Account created but sign-in failed. Please log in manually.");
        router.push("/login");
        return;
      }
      toast.success("Welcome aboard!");
      router.push("/dashboard");
      router.refresh();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="w-full max-w-[420px] relative">
        {/* Logo */}
        <div className="flex flex-col items-center gap-2 mb-8">
          <div className="flex items-center gap-2">
            <div className="flex gap-0.5">
              <div className="w-2.5 h-6 bg-violet-600 rounded-full" />
              <div className="w-2.5 h-6 bg-violet-600 rounded-full" />
              <div className="w-2.5 h-6 bg-violet-600 rounded-full" />
            </div>
            <span className="text-xl font-bold text-slate-900 tracking-tight">PostAI</span>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
          <div className="mb-6 text-center">
            <h2 className="text-xl font-semibold text-slate-900">Create account</h2>
            <p className="text-violet-600 text-sm mt-1">Invitation required to join</p>
          </div>

          {/* Invite note */}
          <div className="flex items-start gap-2.5 rounded-xl bg-violet-50 border border-violet-200 px-3.5 py-3 mb-5">
            <KeyRound className="w-4 h-4 text-violet-600 shrink-0 mt-0.5" />
            <p className="text-slate-600 text-xs leading-relaxed">
              You need an invitation code to join PostAI. Please contact support if you don&apos;t have one.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-sm text-slate-700 font-medium">Full Name</Label>
              <Input
                id="name"
                type="text"
                placeholder="Enter your full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
                className="bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus-visible:ring-violet-500/20 focus-visible:border-violet-500 h-10 rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm text-slate-700 font-medium">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus-visible:ring-violet-500/20 focus-visible:border-violet-500 h-10 rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm text-slate-700 font-medium">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Create a password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
                className="bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus-visible:ring-violet-500/20 focus-visible:border-violet-500 h-10 rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="inviteCode" className="text-sm text-slate-700 font-medium">Invitation Code</Label>
              <Input
                id="inviteCode"
                type="text"
                placeholder="INV-XXXX-XXXX"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                required
                className="bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400 focus-visible:ring-violet-500/20 focus-visible:border-violet-500 h-10 rounded-xl font-mono tracking-widest"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-10 bg-violet-600 hover:bg-violet-700 text-white font-semibold rounded-xl transition-all duration-150 gap-2 mt-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                "Create account"
              )}
            </Button>
          </form>
        </div>

        <p className="text-center text-slate-500 text-sm mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-violet-600 hover:text-violet-700 font-medium transition-colors">
            Sign In
          </Link>
        </p>
      </div>

      {/* Footer */}
      <div className="absolute bottom-6 flex items-center gap-6 text-xs text-slate-400">
        <span className="hover:text-slate-600 cursor-pointer">Privacy Policy</span>
        <span className="hover:text-slate-600 cursor-pointer">Terms of Service</span>
        <span className="hover:text-slate-600 cursor-pointer">Help Center</span>
      </div>
    </div>
  );
}
