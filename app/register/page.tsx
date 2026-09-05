import { RegisterForm } from "@/components/auth/register-form";
import { AuthCard } from "@/modules/shell/components/auth-card";
import { FullScreenShell } from "@/modules/shell/components/full-screen-shell";

export default function RegisterPage() {
  return (
    <FullScreenShell
      center={
        <AuthCard>
          <RegisterForm />
        </AuthCard>
      }
    />
  );
}
