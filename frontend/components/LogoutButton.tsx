"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LogoutButton({ className = "" }: { className?: string }) {
  const router = useRouter();
  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  return (
    <button
      onClick={handleSignOut}
      title="Sign out"
      aria-label="Sign out"
      className={`flex items-center justify-center h-8 w-8 rounded-full border border-border text-muted hover:border-red-300 hover:text-red-600 transition-colors ${className}`}
    >
      <LogOut size={14} />
    </button>
  );
}
