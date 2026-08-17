import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/auth/confirm")({
  head: () => ({
    meta: [{ title: "Potwierdzanie — poŻeramy" }],
  }),
  component: AuthConfirmPage,
});

type VerifyOtpType = "signup" | "invite" | "magiclink" | "recovery" | "email_change" | "email";

function AuthConfirmPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenHash = params.get("token_hash");
    const type = params.get("type") as VerifyOtpType | null;
    const redirectTo = params.get("redirect_to");

    if (!tokenHash || !type) {
      setStatus("error");
      setErrorMessage("Link jest niekompletny lub uszkodzony.");
      return;
    }

    supabase.auth.verifyOtp({ token_hash: tokenHash, type }).then(({ error }) => {
      if (error) {
        setStatus("error");
        setErrorMessage(error.message);
        return;
      }
      setStatus("success");
      const target = redirectTo && redirectTo.startsWith("/") ? redirectTo : "/profile";
      setTimeout(() => navigate({ to: target }), 1200);
    });
  }, [navigate]);

  return (
    <main id="main-content" className="min-h-dvh bg-terrazzo-navy text-cream flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-cream text-navy rounded-3xl p-8 shadow-2xl text-center">
        {status === "verifying" && (
          <>
            <Loader2 className="animate-spin mx-auto mb-4" size={32} aria-hidden />
            <h1 className="font-display text-2xl mb-1">Potwierdzam...</h1>
            <p className="text-sm text-muted-foreground">Chwilę cierpliwości, weryfikujemy link.</p>
          </>
        )}
        {status === "success" && (
          <>
            <CheckCircle2 className="mx-auto mb-4 text-green-600" size={32} aria-hidden />
            <h1 className="font-display text-2xl mb-1">Gotowe!</h1>
            <p className="text-sm text-muted-foreground">Przenosimy Cię dalej...</p>
          </>
        )}
        {status === "error" && (
          <>
            <XCircle className="mx-auto mb-4 text-destructive" size={32} aria-hidden />
            <h1 className="font-display text-2xl mb-1">Link nie zadziałał</h1>
            <p className="text-sm text-muted-foreground mb-6">
              {errorMessage ?? "Link mógł wygasnąć albo już go użyto."}
            </p>
            <Link
              to="/auth"
              className="inline-flex items-center justify-center rounded-full bg-tomato text-cream px-6 py-3 font-semibold hover:bg-tomato/90 transition min-h-11"
            >
              Wróć do logowania
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
