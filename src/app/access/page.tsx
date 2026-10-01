"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../hooks/useAuth";
import { UsernameSignIn } from "../../components/UsernameSignIn";

// Unlisted page for password accounts created in the Firebase console. Nothing links here.
export default function AccessPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (user) router.replace("/notes");
  }, [user, router]);

  if (loading || user) return null;

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <UsernameSignIn onSignedIn={() => router.replace("/notes")} />
    </div>
  );
}
