import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { type FormEvent, useState } from 'react';

import { SignInError, useAuth } from '@/auth/AuthProvider';
import { BrandMark } from '@/components/layout/BrandMark';
import { cn } from '@/components/ui/cn';
import { Field } from '@/components/ui/Field';

/** Il messaggio per chi prova ad entrare: cosa fare, non cosa è andato storto dentro. */
export function signInMessage(error: unknown): string {
  if (error instanceof SignInError) {
    if (error.reason === 'invalid_credentials') return 'Email o password non corrette.';
    if (error.reason === 'network') return 'Nessuna connessione. Riprova tra poco.';
  }
  return 'Accesso non riuscito. Riprova tra poco.';
}

/**
 * Il login dell'app, in versione desktop: la stessa foto che sfuma nel nero,
 * gli stessi campi, lo stesso bottone rosso che si riempie quando si può entrare.
 */
export function LoginPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canSubmit = email.trim().length > 0 && password.length > 0;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) {
      setError(email.trim() ? 'Manca la password.' : "Manca l'email.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await signIn(email, password);
    } catch (failure) {
      setError(signInMessage(failure));
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-dvh bg-ink-950 lg:grid-cols-[1.1fr_1fr]">
      <div className="relative h-[300px] overflow-hidden lg:h-auto">
        <img
          src="/login-hero.webp"
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-80"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-ink-950/20 to-ink-950 lg:bg-gradient-to-r lg:via-transparent" />
        <div className="absolute inset-0 bg-gradient-to-br from-tangerine/25 via-transparent to-transparent" />
        <div className="absolute bottom-10 left-10 hidden max-w-md lg:block">
          <p className="text-[40px] leading-[44px] font-extrabold tracking-tight text-white">
            Ogni viaggio, sotto controllo.
          </p>
          <p className="mt-3 text-[15px] font-semibold text-bone/70">
            Crew, posti, documenti e partenze di tutta l'organizzazione, in un posto solo.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center px-6 py-10">
        <form onSubmit={submit} className="flex w-full max-w-[400px] animate-rise flex-col gap-4" noValidate>
          <div className="mb-4 flex items-center gap-3">
            <BrandMark size={44} />
            <div className="leading-tight">
              <p className="text-[18px] font-extrabold tracking-tight text-white">Vibemakers</p>
              <p className="text-[13px] font-semibold text-mist">Pannello di controllo · solo staff</p>
            </div>
          </div>

          <Field
            icon={<Mail size={19} strokeWidth={1.9} />}
            type="email"
            autoComplete="email"
            placeholder="Email"
            aria-label="Email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setError(null);
            }}
          />
          <Field
            icon={<Lock size={19} strokeWidth={1.9} />}
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="Password"
            aria-label="Password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setError(null);
            }}
            trailing={
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? 'Nascondi password' : 'Mostra password'}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-bone/60 hover:text-bone"
              >
                {showPassword ? <EyeOff size={19} strokeWidth={1.9} /> : <Eye size={19} strokeWidth={1.9} />}
              </button>
            }
          />

          {error ? (
            <p role="alert" className="px-1 text-[13px] font-bold text-tangerine-soft">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className={cn(
              'mt-4 flex h-[60px] items-center justify-center gap-2 rounded-control border-2 border-tangerine text-[18px] font-extrabold tracking-tight transition-colors',
              canSubmit ? 'bg-tangerine text-bone shadow-glow' : 'bg-transparent text-tangerine',
            )}
          >
            {loading ? (
              <span
                className="h-5 w-5 animate-spin rounded-full border-2 border-current border-r-transparent"
                aria-hidden
              />
            ) : null}
            {loading ? 'Verifica…' : 'Accedi'}
          </button>

          <p className="mt-8 text-center text-[13px] font-semibold text-bone/40">
            Le credenziali sono le stesse dell'app.
          </p>
        </form>
      </div>
    </div>
  );
}
