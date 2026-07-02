import { useState } from 'react';
import { ShieldCheck, ShieldOff, Loader2, Copy, CheckCheck } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useEnroll2fa, useConfirmEnroll } from '@/hooks/use-auth';
import type { AuthUser } from '@app/contracts';

interface TotpEnrollmentCardProps {
  user: AuthUser;
}

type CardState =
  | { phase: 'idle' }
  | { phase: 'qr'; otpauthUri: string; secret: string }
  | { phase: 'confirmed' };

export function TotpEnrollmentCard({ user }: TotpEnrollmentCardProps) {
  const [cardState, setCardState] = useState<CardState>({ phase: 'idle' });
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState(false);

  const enroll = useEnroll2fa();
  const confirm = useConfirmEnroll();

  // The "sistema" user cannot enroll (backend also rejects it with 403).
  // Hide the action for that account to avoid confusing UX.
  const isSystemUser = user.username === 'sistema';

  function handleStartEnroll() {
    enroll.mutate(undefined, {
      onSuccess: (data) => {
        setCardState({ phase: 'qr', otpauthUri: data.otpauthUri, secret: data.secret });
        setCode('');
      },
      onError: () => toast.error('No se pudo iniciar el enrolamiento. Intenta nuevamente.'),
    });
  }

  function handleConfirm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (cardState.phase !== 'qr') return;

    confirm.mutate(
      { code },
      {
        onSuccess: () => {
          setCardState({ phase: 'confirmed' });
          setCode('');
          toast.success('Autenticación en dos pasos activada');
        },
        onError: (err) => {
          const status = (err as { response?: { status?: number } }).response?.status;
          if (status === 400) {
            toast.error(
              'Código inválido. Verifica que tu app esté sincronizada y vuelve a intentar.',
            );
          } else {
            toast.error('Error al confirmar. Intenta nuevamente.');
          }
        },
      },
    );
  }

  async function handleCopySecret() {
    if (cardState.phase !== 'qr') return;
    await navigator.clipboard.writeText(cardState.secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const totpEnabled = user.totpEnabled || cardState.phase === 'confirmed';

  return (
    <Card className="border-slate-200/70 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-800">
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
          Autenticación en dos pasos (2FA)
        </CardTitle>
        <p className="text-sm text-slate-500">
          Protege tu cuenta con un código TOTP generado por Google Authenticator, Authy u otra app
          compatible.
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Status badge */}
        <div
          className={`flex items-center gap-2 rounded-md border px-3 py-2 ${
            totpEnabled ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'
          }`}
        >
          {totpEnabled ? (
            <>
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              <span className="text-xs font-medium text-emerald-700">
                Autenticación en dos pasos activa
              </span>
            </>
          ) : (
            <>
              <ShieldOff className="h-4 w-4 text-slate-400" />
              <span className="text-xs font-medium text-slate-600">2FA no configurado</span>
            </>
          )}
        </div>

        {isSystemUser && (
          <p className="text-xs text-amber-600">
            El usuario <strong>sistema</strong> gestiona su 2FA desde las variables de entorno del
            servidor.
          </p>
        )}

        {/* Actions */}
        {!isSystemUser && !totpEnabled && cardState.phase === 'idle' && (
          <Button
            onClick={handleStartEnroll}
            disabled={enroll.isPending}
            className="bg-slate-900 text-white hover:bg-slate-700"
          >
            {enroll.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generando QR...
              </>
            ) : (
              <>
                <ShieldCheck className="mr-2 h-4 w-4" /> Activar 2FA
              </>
            )}
          </Button>
        )}

        {!isSystemUser && cardState.phase === 'qr' && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Escanea este código con tu app de autenticación y luego ingresa el código de 6 dígitos
              para confirmar.
            </p>

            {/* QR code */}
            <div className="flex justify-center">
              <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                <QRCodeSVG value={cardState.otpauthUri} size={200} />
              </div>
            </div>

            {/* Manual secret */}
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-slate-500">
                ¿No puedes escanear? Ingresa este código manualmente:
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded bg-slate-100 px-3 py-1.5 font-mono text-xs tracking-widest text-slate-800 break-all">
                  {cardState.secret}
                </code>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopySecret}
                  className="shrink-0"
                >
                  {copied ? (
                    <CheckCheck className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </div>

            {/* Code confirmation */}
            <form onSubmit={handleConfirm} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="totp-confirm-code" className="text-sm font-medium text-slate-700">
                  Código de verificación
                </Label>
                <Input
                  id="totp-confirm-code"
                  type="text"
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  placeholder="000000"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="border-slate-300 bg-white text-center tracking-[0.4em] focus-visible:ring-slate-400"
                  autoComplete="one-time-code"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  type="submit"
                  disabled={confirm.isPending || code.length !== 6}
                  className="bg-slate-900 text-white hover:bg-slate-700"
                >
                  {confirm.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Confirmando...
                    </>
                  ) : (
                    'Confirmar y activar'
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setCardState({ phase: 'idle' });
                    setCode('');
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </div>
        )}

        {!isSystemUser && cardState.phase === 'confirmed' && (
          <p className="text-sm text-emerald-700">
            Tu cuenta ahora requiere el código de autenticación cada vez que inicies sesión.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
