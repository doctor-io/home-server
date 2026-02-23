import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-6">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/images/1.jpg')" }}
      />
      <div className="absolute inset-0 bg-background/70 backdrop-blur-xl" />
      <div className="pointer-events-none absolute inset-x-0 top-16 text-center">
        <p className="text-6xl font-semibold tracking-tight text-foreground/95 font-mono">
          Login
        </p>
      </div>
      <div className="relative z-10 w-full max-w-sm">
        <LoginForm />
      </div>
    </main>
  );
}
