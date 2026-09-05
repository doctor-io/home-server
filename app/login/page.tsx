import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { AuthCard } from "@/modules/shell/components/auth-card";
import { FullScreenShell } from "@/modules/shell/components/full-screen-shell";

// Read DEMO_MODE at request time, not build time — without this Next.js
// prerenders the page once and the demo banner stays hidden even after the
// operator flips DEMO_MODE=true and restarts the service.
export const dynamic = "force-dynamic";

export default function LoginPage() {
  const isDemoMode = process.env.DEMO_MODE === "true";

  return (
    <FullScreenShell
      center={
        <AuthCard>
          <Suspense fallback={null}>
            <LoginForm isDemoMode={isDemoMode} />
          </Suspense>
        </AuthCard>
      }
    />
  );
}
