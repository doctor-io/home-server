import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { FullScreenShell } from "@/modules/shell/components/full-screen-shell";

export default function LoginPage() {
  return (
    <FullScreenShell
      center={
        <div className="w-full max-w-md">
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </div>
      }
    />
  );
}
