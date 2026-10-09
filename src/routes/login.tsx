import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { LoginPage } from "@/game/AccountScreens";

export const Route = createFileRoute("/login")({ component: LoginRoute });

function LoginRoute() {
  const { user, isPending } = useCurrentUserState();
  if (!isPending && user) return <Navigate to="/" />;
  return <LoginPage />;
}
