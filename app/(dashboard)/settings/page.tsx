"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Save, User, Shield } from "lucide-react";

export default function SettingsPage() {
  const { data: session, update } = useSession();
  const [nameOverride, setNameOverride] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const name = nameOverride ?? session?.user?.name ?? "";

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error("Failed to save");
      await update({ name });
      toast.success("Settings saved");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#0f172a]">Settings</h1>
        <p className="text-[#64748b] text-sm mt-1">Manage your account and preferences</p>
      </div>

      <form onSubmit={save} className="space-y-5">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="w-4 h-4 text-[#4F8EF7]" />
              Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setNameOverride(e.target.value)}
                placeholder="Your name"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input value={session?.user?.email || ""} disabled className="opacity-60" />
              <p className="text-xs text-[#94a3b8]">Email cannot be changed</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#4F8EF7]" />
              Account
            </CardTitle>
            <CardDescription>Your organization role and permissions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Input value={session?.user?.role || "admin"} disabled className="opacity-60 capitalize" />
            </div>
          </CardContent>
        </Card>

        <Button type="submit" disabled={saving}>
          <Save className="w-4 h-4" />
          {saving ? "Saving..." : "Save Settings"}
        </Button>
      </form>
    </div>
  );
}
