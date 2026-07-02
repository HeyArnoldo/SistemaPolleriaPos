import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Navigate, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Lock, LogIn, Loader2, WifiOff, ShieldCheck } from 'lucide-react';
import { loginSchema, type LoginInput } from '@app/contracts';
import { useLogin, useLogin2fa, useMe } from '@/hooks/use-auth';
import { useConnectivity } from '@/hooks/use-connectivity';
import { useOfflineAuth } from '@/contexts/offline-auth-context';
import { hasOfflinePin, getStoredOfflineSession } from '@/lib/offline-pin';
import type { StoredOfflineSession } from '@/lib/offline-pin';
import { OfflinePinScreen } from '@/components/auth/offline-pin-screen';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { AxiosError } from 'axios';

type TotpStep = {
  type: 'totp';
  challengeToken: string;
};

type LoginStep = { type: 'credentials' } | TotpStep;

export default function LoginPage() {
  const { data: me } = useMe();
  const login = useLogin();
  const login2fa = useLogin2fa();
  const navigate = useNavigate();
  const { isOnline, hasCheckedHealth } = useConnectivity();
  const { enterOfflineMode } = useOfflineAuth();

  const [step, setStep] = useState<LoginStep>({ type: 'credentials' });
  const [totpCode, setTotpCode] = useState('');

  const [pinConfigured, setPinConfigured] = useState(false);
  const [offlineSession, setOfflineSession] = useState<StoredOfflineSession | undefined>(undefined);
  const [showPin, setShowPin] = useState(false);

  useEffect(() => {
    void hasOfflinePin().then(setPinConfigured);
    void getStoredOfflineSession().then(setOfflineSession);
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: '', password: '' },
  });

  if (me) return <Navigate to="/" replace />;

  // ─── Step 1: credentials ────────────────────────────────────────────────────

  const onSubmitCredentials = (input: LoginInput) => {
    login.mutate(input, {
      onSuccess: (data) => {
        if ('twoFactorRequired' in data) {
          setStep({ type: 'totp', challengeToken: data.challengeToken });
          setTotpCode('');
        } else {
          navigate('/');
        }
      },
      onError: () => toast.error('Credenciales inválidas'),
    });
  };

  // ─── Step 2: TOTP code ──────────────────────────────────────────────────────

  const onSubmitTotp = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (step.type !== 'totp') return;

    login2fa.mutate(
      { challengeToken: step.challengeToken, code: totpCode },
      {
        onSuccess: () => navigate('/'),
        onError: (err) => {
          const axiosErr = err as AxiosError<{ message?: string }>;
          const status = axiosErr.response?.status;
          const message = axiosErr.response?.data?.message ?? '';

          if (status === 429) {
            toast.error('Demasiados intentos, intenta más tarde');
          } else if (status === 401) {
            const isExpiredToken =
              typeof message === 'string' && message.toLowerCase().includes('challenge token');
            if (isExpiredToken) {
              setStep({ type: 'credentials' });
              setTotpCode('');
              toast.error('El código de acceso expiró. Ingresa tus credenciales nuevamente.');
            } else {
              toast.error('Código inválido');
            }
          } else {
            toast.error('Error al verificar el código');
          }
        },
      },
    );
  };

  const canShowOfflineEntry = hasCheckedHealth && !isOnline && pinConfigured && offlineSession;

  function handleOfflineSuccess(session: StoredOfflineSession) {
    enterOfflineMode(session);
    navigate('/ventas');
  }

  if (showPin && offlineSession) {
    return <OfflinePinScreen session={offlineSession} onSuccess={handleOfflineSuccess} />;
  }

  return (
    <section className="flex min-h-screen items-center justify-center bg-[#111827] p-4">
      <Card className="w-full max-w-[420px] overflow-hidden rounded-xl border-0 p-0 shadow-2xl">
        {/* Brand header */}
        <div className="flex flex-col items-center justify-center bg-[#0f172a] p-8 pb-10 text-center">
          <div className="mb-4 inline-flex items-center justify-center rounded-lg bg-[#334155]/50 p-3">
            <img src="/logo.svg" alt="Pollería Carbón" className="h-12 w-12" />
          </div>
          <h1 className="mb-2 text-2xl font-bold tracking-wide text-white">Pollería Carbón</h1>
          <p className="text-sm font-light text-slate-400">Sistema POS — Iniciar sesión</p>
        </div>

        <CardContent className="bg-white p-6">
          {step.type === 'credentials' ? (
            /* ── Paso 1: usuario + contraseña ── */
            <form className="space-y-6" onSubmit={handleSubmit(onSubmitCredentials)}>
              <div className="space-y-2">
                <Label htmlFor="username" className="text-sm font-semibold text-gray-700">
                  Usuario
                </Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="Ingrese usuario"
                  className="h-11 w-full border-gray-300 bg-white focus-visible:ring-blue-900"
                  autoComplete="username"
                  {...register('username')}
                />
                {errors.username && (
                  <p className="text-sm text-red-600">{errors.username.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-semibold text-gray-700">
                  Contraseña
                </Label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Ingrese contraseña"
                    className="h-11 border-gray-300 bg-white pl-10 focus-visible:ring-blue-900"
                    autoComplete="current-password"
                    {...register('password')}
                  />
                </div>
                {errors.password && (
                  <p className="text-sm text-red-600">{errors.password.message}</p>
                )}
              </div>

              <Button
                type="submit"
                disabled={login.isPending}
                className="h-11 w-full bg-[#0f172a] text-base font-medium transition-all hover:bg-[#1e293b]"
              >
                {login.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Cargando...
                  </>
                ) : (
                  <>
                    <LogIn className="mr-2 h-5 w-5" /> Ingresar
                  </>
                )}
              </Button>
            </form>
          ) : (
            /* ── Paso 2: código TOTP ── */
            <form className="space-y-6" onSubmit={onSubmitTotp}>
              <div className="flex flex-col items-center gap-2 pb-2 text-center">
                <ShieldCheck className="h-8 w-8 text-slate-600" />
                <p className="text-sm font-semibold text-gray-800">Autenticación en dos pasos</p>
                <p className="text-xs text-gray-500">
                  Ingresa el código de 6 dígitos de tu aplicación de autenticación.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="totp-code" className="text-sm font-semibold text-gray-700">
                  Código de verificación
                </Label>
                <Input
                  id="totp-code"
                  type="text"
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  placeholder="000000"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="h-11 w-full border-gray-300 bg-white text-center text-lg tracking-[0.4em] focus-visible:ring-blue-900"
                  autoComplete="one-time-code"
                  autoFocus
                />
              </div>

              <Button
                type="submit"
                disabled={login2fa.isPending || totpCode.length !== 6}
                className="h-11 w-full bg-[#0f172a] text-base font-medium transition-all hover:bg-[#1e293b]"
              >
                {login2fa.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Verificando...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="mr-2 h-5 w-5" /> Verificar código
                  </>
                )}
              </Button>

              <button
                type="button"
                onClick={() => {
                  setStep({ type: 'credentials' });
                  setTotpCode('');
                }}
                className="w-full text-center text-xs text-gray-400 underline-offset-2 hover:text-gray-600 hover:underline"
              >
                Volver al inicio de sesión
              </button>
            </form>
          )}

          {step.type === 'credentials' && canShowOfflineEntry && (
            <>
              <div className="my-4 flex items-center gap-2">
                <div className="h-px flex-1 bg-gray-200" />
                <span className="text-xs text-gray-400">sin conexión</span>
                <div className="h-px flex-1 bg-gray-200" />
              </div>
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full border-amber-300 text-amber-700 hover:bg-amber-50 hover:text-amber-800"
                onClick={() => setShowPin(true)}
              >
                <WifiOff className="mr-2 h-5 w-5" />
                Ingresar sin conexión
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
