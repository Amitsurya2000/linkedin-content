"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Linkedin, User, Mail, Lock } from "lucide-react";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
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
    <div className="min-h-screen bg-[#FCEBEC] flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Top-left branding */}
      <div className="absolute top-6 left-6 flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-[#ED383B] flex items-center justify-center">
          <Linkedin className="w-3.5 h-3.5 text-[#1A1A1A]" />
        </div>
        <span className="text-base font-bold text-[#1A1A1A] tracking-tight">LI Post Gen</span>
      </div>

      {/* Background glow */}
      <div className="absolute -top-48 -right-48 w-96 h-96 bg-[#ED383B]/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-72 h-72 bg-[#ED383B]/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-[420px] relative">
        {/* Logo */}
        <div className="flex flex-col items-center gap-2 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-[#ED383B]/10 border border-[#ED383B]/20 flex items-center justify-center">
            <Linkedin className="w-6 h-6 text-[#ED383B]" />
          </div>
        </div>

        {/* Card */}
        <div className="bg-[#FFFFFF] border border-[#F5C5C7] rounded-2xl p-8 shadow-xl">
          <div className="mb-6 text-center">
            <h2 className="text-xl font-semibold text-[#1A1A1A]">Create account</h2>
            <p className="text-[#94a3b8] text-sm mt-1">Start generating viral LinkedIn posts</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-sm text-[#94a3b8] font-medium">Full Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748b]" />
                <Input
                  id="name"
                  type="text"
                  placeholder="Enter your full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoComplete="name"
                  className="bg-[#FCEBEC] border-[#F5C5C7] text-[#1A1A1A] placeholder:text-[#64748b] focus-visible:ring-[#ED383B]/30 focus-visible:border-[#ED383B] h-10 rounded-xl pl-10"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm text-[#94a3b8] font-medium">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748b]" />
                <Input
                  id="email"
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="bg-[#FCEBEC] border-[#F5C5C7] text-[#1A1A1A] placeholder:text-[#64748b] focus-visible:ring-[#ED383B]/30 focus-visible:border-[#ED383B] h-10 rounded-xl pl-10"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm text-[#94a3b8] font-medium">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748b]" />
                <Input
                  id="password"
                  type="password"
                  placeholder="Min 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  className="bg-[#FCEBEC] border-[#F5C5C7] text-[#1A1A1A] placeholder:text-[#64748b] focus-visible:ring-[#ED383B]/30 focus-visible:border-[#ED383B] h-10 rounded-xl pl-10"
                />
              </div>
              <p className="text-xs text-[#64748b]">Must be at least 6 characters</p>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-10 bg-[#ED383B] hover:bg-[#ED383B]/90 text-white font-semibold rounded-xl transition-all duration-150 gap-2 mt-2 cursor-pointer"
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

        <p className="text-center text-[#94a3b8] text-sm mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-[#ED383B] hover:text-[#DB272A] font-medium transition-colors">
            Sign in
          </Link>
        </p>
      </div>

      {/* Footer */}
      <div className="absolute bottom-6 flex items-center gap-6 text-xs text-[#64748b]">
        <span className="hover:text-[#1A1A1A]/60 cursor-pointer">Privacy Policy</span>
        <span className="hover:text-[#1A1A1A]/60 cursor-pointer">Terms of Service</span>
      </div>
    </div>
  );
}
