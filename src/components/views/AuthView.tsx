import { useState } from "react";
import { supabase } from "../../lib/supabase/client.ts";
import { clientEnv } from "../../lib/env.ts";
import {
  Lock,
  Mail,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Eye,
  EyeOff,
  HelpCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface AuthViewProps {
  onSuccess?: () => void;
  onExploreDemo?: () => void;
}

export function AuthView({ onSuccess, onExploreDemo }: AuthViewProps) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setErrorDetails(null);
    setShowDetails(false);
    setMessage(null);

    try {
      if (mode === "login") {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) throw signInError;
        if (data.session) {
          if (onSuccess) onSuccess();
        }
      } else {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
            },
          },
        });

        if (signUpError) throw signUpError;
        if (data.session) {
          if (onSuccess) onSuccess();
        } else {
          setMessage(
            "Account registration submitted! If email confirmation is enabled on your Supabase project, please check your inbox to confirm your account."
          );
        }
      }
    } catch (err: any) {
      const rawMsg = err?.message || err?.error_description || String(err || "Authentication failed");
      const isNetworkOrFetchError =
        rawMsg.toLowerCase().includes("failed to fetch") ||
        rawMsg.toLowerCase().includes("network") ||
        rawMsg.toLowerCase().includes("fetch failed") ||
        err?.name === "TypeError";

      if (isNetworkOrFetchError) {
        setError("Connection Failed: Unable to reach the Supabase authentication server.");
        setErrorDetails(
          `Target Service: ${clientEnv.VITE_SUPABASE_URL}\n` +
            `Error Type: ${err?.name || "TypeError"} ("${rawMsg}")\n\n` +
            `Troubleshooting Checklist:\n` +
            `1. Project URL Status: Verify that "${clientEnv.VITE_SUPABASE_URL}" is unpaused and active in your Supabase dashboard.\n` +
            `2. Network / AdBlock: Ensure browser extensions (e.g. Brave Shields, uBlock Origin, or privacy blockers) are not blocking requests to supabase.co.\n` +
            `3. CORS / Auth Settings: Confirm your Supabase Auth Site URL and Redirect URLs permit requests from this domain.\n` +
            `4. Offline / Demo Access: You can continue exploring using the Demo Workspace below without an active database connection.`
        );
      } else {
        setError(rawMsg);
        if (err?.code || err?.status) {
          setErrorDetails(`Status / Code: ${err.status || err.code}\n${rawMsg}`);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 bg-neutral-900 text-neutral-100">
      <div className="w-full max-w-md space-y-6 bg-neutral-800/80 p-8 rounded-2xl border border-neutral-700/80 shadow-2xl backdrop-blur-sm">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 mb-1">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white">OmniRank</h2>
          <p className="text-sm text-neutral-400">
            {mode === "login"
              ? "Sign in to access your Content Growth Operating System"
              : "Create an account to start your Brand Brain"}
          </p>
        </div>

        {error && (
          <div id="auth-error-banner" className="p-3.5 rounded-lg bg-rose-950/60 border border-rose-800/80 text-rose-200 text-sm space-y-2.5">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <div className="flex-1 text-xs sm:text-sm font-medium leading-relaxed">
                {error}
              </div>
            </div>

            {errorDetails && (
              <div className="pt-1 border-t border-rose-900/50">
                <button
                  type="button"
                  id="auth-toggle-details-btn"
                  onClick={() => setShowDetails((prev) => !prev)}
                  className="text-xs font-semibold text-rose-300 hover:text-rose-100 flex items-center gap-1.5 transition-colors"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>{showDetails ? "Hide technical details" : "Show connection details & checklist"}</span>
                  {showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                {showDetails && (
                  <div
                    id="auth-error-technical-details"
                    className="mt-2 p-2.5 rounded bg-black/50 border border-rose-900/60 font-mono text-[11px] text-rose-200/90 whitespace-pre-wrap break-all select-text leading-relaxed"
                  >
                    {errorDetails}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {message && (
          <div id="auth-success-banner" className="p-3.5 rounded-lg bg-emerald-950/50 border border-emerald-800 text-emerald-300 text-sm flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
            <span className="text-xs sm:text-sm leading-relaxed">{message}</span>
          </div>
        )}

        <form className="space-y-4" onSubmit={handleSubmit}>
          {mode === "signup" && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-300 mb-1.5">
                Full Name
              </label>
              <input
                id="auth-full-name"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="M Moneeb Akhtar"
                className="w-full px-3.5 py-2.5 rounded-lg bg-neutral-900 border border-neutral-700 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-sm"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-300 mb-1.5">
              Work Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3" />
              <input
                id="auth-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="strategist@company.com"
                className="w-full pl-10 pr-3.5 py-2.5 rounded-lg bg-neutral-900 border border-neutral-700 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-300 mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3" />
              <input
                id="auth-password"
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-10 pr-11 py-2.5 rounded-lg bg-neutral-900 border border-neutral-700 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-sm"
              />
              <button
                id="auth-toggle-password-visibility-btn"
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                title={showPassword ? "Hide password" : "Show password"}
                className="absolute right-3 top-2.5 p-1 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            id="auth-submit-btn"
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-950 font-semibold text-sm transition-colors flex items-center justify-center gap-2 shadow-lg shadow-amber-500/10 disabled:opacity-50"
          >
            {loading ? "Authenticating..." : mode === "login" ? "Sign In" : "Create Account"}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="pt-2 border-t border-neutral-700/60 flex flex-col items-center gap-2.5">
          <button
            id="auth-toggle-mode-btn"
            type="button"
            onClick={() => {
              setMode(mode === "login" ? "signup" : "login");
              setError(null);
              setErrorDetails(null);
              setShowDetails(false);
              setMessage(null);
            }}
            className="text-xs text-neutral-400 hover:text-white transition-colors"
          >
            {mode === "login"
              ? "Don't have an account? Sign up"
              : "Already have an account? Sign in"}
          </button>

          {onExploreDemo && (
            <button
              id="auth-skip-demo-btn"
              type="button"
              onClick={onExploreDemo}
              className="text-xs text-amber-400/90 hover:text-amber-300 transition-colors underline underline-offset-4"
            >
              Explore Demo Workspace (Offline Preview) →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
