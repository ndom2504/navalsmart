import { LoginScreen } from "@/components/auth/login-screen";

export const metadata = { title: "Connexion" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;

  return (
    <LoginScreen
      email={process.env.DEMO_USER_EMAIL || "morel@navalsmart.local"}
      demoPassword={process.env.DEMO_USER_PASSWORD || "Formation2026!"}
      error={params.error === "1"}
    />
  );
}
