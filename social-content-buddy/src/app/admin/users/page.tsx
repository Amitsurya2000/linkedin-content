"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Users,
  Loader2,
  Shield,
  ShieldOff,
} from "lucide-react";

interface AdminUser {
  id: string;
  name: string | null;
  email: string | null;
  isAdmin: boolean;
  createdAt: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  async function fetchUsers() {
    try {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error("Failed to fetch users");
      const data = await res.json();
      setUsers(data);
    } catch {
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchUsers();
  }, []);

  async function toggleAdmin(user: AdminUser) {
    setTogglingId(user.id);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, isAdmin: !user.isAdmin }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(
        user.isAdmin
          ? `Admin removed from ${user.name || user.email}`
          : `${user.name || user.email} is now admin`
      );
      await fetchUsers();
    } catch {
      toast.error("Failed to update admin status");
    } finally {
      setTogglingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-violet-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">User Management</h1>
        <p className="text-slate-500 mt-1">
          Manage user access and permissions across the platform.
        </p>
      </div>

      <Card className="bg-white border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-slate-900 text-base font-semibold flex items-center gap-2">
            <Users className="w-4 h-4 text-violet-600" />
            All Users ({users.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Table header */}
          <div className="hidden lg:grid grid-cols-[2fr_1fr_1fr_auto] gap-4 px-4 py-2 text-xs text-slate-500 font-medium uppercase tracking-wider border-b border-slate-100 mb-1">
            <span>User</span>
            <span>Admin</span>
            <span>Joined</span>
            <span>Actions</span>
          </div>

          <div className="divide-y divide-slate-100">
            {users.length === 0 && (
              <p className="text-slate-400 text-sm text-center py-10">
                No users found
              </p>
            )}
            {users.map((user) => {
              const initials = (user.name || user.email || "U")
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2);
              const isToggling = togglingId === user.id;

              return (
                <div
                  key={user.id}
                  className="grid grid-cols-1 lg:grid-cols-[2fr_1fr_1fr_auto] gap-4 items-center px-4 py-4 hover:bg-slate-50 transition-colors rounded-lg"
                >
                  {/* User */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-violet-600 flex items-center justify-center shrink-0 text-white text-xs font-bold">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <p className="text-slate-900 text-sm font-medium truncate">
                        {user.name || "—"}
                      </p>
                      <p className="text-slate-400 text-xs truncate">
                        {user.email}
                      </p>
                    </div>
                  </div>

                  {/* Admin status */}
                  <div>
                    {user.isAdmin ? (
                      <Badge className="bg-violet-50 text-violet-700 border-violet-200 text-xs">
                        <Shield className="w-3 h-3 mr-1" />
                        Admin
                      </Badge>
                    ) : (
                      <span className="text-slate-400 text-xs">User</span>
                    )}
                  </div>

                  {/* Joined */}
                  <div className="text-slate-500 text-sm">
                    {new Date(user.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "2-digit",
                    })}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={isToggling}
                      onClick={() => toggleAdmin(user)}
                      className="h-8 px-2.5 text-xs text-slate-500 hover:text-violet-700 hover:bg-violet-50 gap-1.5"
                      title={user.isAdmin ? "Remove admin" : "Make admin"}
                    >
                      {isToggling ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : user.isAdmin ? (
                        <ShieldOff className="w-3.5 h-3.5" />
                      ) : (
                        <Shield className="w-3.5 h-3.5" />
                      )}
                      {user.isAdmin ? "Revoke" : "Admin"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
