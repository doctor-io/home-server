import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { FullScreenShell } from "@/modules/shell/components/full-screen-shell";

export default function LoginPage() {
  const isDemoMode = process.env.DEMO_MODE === "true";

  return (
    <FullScreenShell
      center={
        <div className="w-full max-w-md">
          <Suspense fallback={null}>
            <LoginForm isDemoMode={isDemoMode} />
          </Suspense>
        </div>
      }
    />
  );
}
