"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Linkedin, Mail, Lock } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await signIn("credentials", { email, password, redirect: false });
      if (result?.error) {
        toast.error("Invalid email or password.");
      } else {
        toast.success("Welcome back!");
        router.push("/dashboard");
        router.refresh();
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-white/[.04] flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Top-left branding */}
      <div className="absolute top-6 left-6 flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-[#ED383B] flex items-center justify-center">
          <Linkedin className="w-3.5 h-3.5 text-white" />
        </div>
        <span className="text-base font-bold text-white tracking-tight">LI Post Gen</span>
      </div>

      {/* Background glow */}
      <div className="absolute -top-48 -right-48 w-96 h-96 bg-[#ED383B]/[.18] rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-72 h-72 bg-[#ED383B]/[.10] rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-[400px] relative">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-[#ED383B]/[.10] border border-[#ED383B]/20 flex items-center justify-center">
            <Linkedin className="w-6 h-6 text-[#ED383B]" />
          </div>
        </div>

        {/* Card */}
        <div className="bg-white/[.045] border border-white/10 rounded-2xl p-8 shadow-xl">
          <div className="mb-6 text-center">
            <h2 className="text-xl font-semibold text-white">Sign in</h2>
            <p className="text-white/62 text-sm mt-1">Enter your credentials to continue</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm text-white/62 font-medium">
                Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/52" />
                <Input
                  id="email"
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="bg-white/[.04] border-white/10 text-white placeholder:text-white/52 focus-visible:ring-[#ED383B]/30 focus-visible:border-[#ED383B] h-10 rounded-xl pl-10"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm text-white/62 font-medium">
                  Password
                </Label>
                <span className="text-xs text-[#ED383B] hover:text-[#FF6A3D] cursor-pointer font-medium">
                  Forgot password?
                </span>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/52" />
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="bg-white/[.04] border-white/10 text-white placeholder:text-white/52 focus-visible:ring-[#ED383B]/30 focus-visible:border-[#ED383B] h-10 rounded-xl pl-10"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-10 bg-[#ED383B] hover:bg-[#ED383B]/90 text-white font-semibold rounded-xl transition-all duration-150 gap-2 mt-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign in"
              )}
            </Button>
          </form>
        </div>

        <p className="text-center text-white/62 text-sm mt-6">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-[#ED383B] hover:text-[#FF6A3D] font-medium transition-colors">
            Sign up
          </Link>
        </p>
      </div>

      {/* Footer */}
      <p className="absolute bottom-6 text-xs text-white/52">
        &copy; {new Date().getFullYear()} LI Post Gen. All rights reserved.
      </p>
    </div>
  );
}
