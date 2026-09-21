import { ChevronRight, Phone } from 'lucide-react-native';
import React from 'react';
import { ActivityIndicator, Linking, Text, View } from 'react-native';

import { palette, shadow } from '@/theme/palette';

import { PressableScale } from './PressableScale';

/* ── Azione primaria ─────────────────────────────────────────────────── */

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  icon?: React.ReactNode;
  disabled?: boolean;
  loading?: boolean;
  /** Alone arancione sotto il bottone: si accende solo sull'azione principale della schermata. */
  glow?: boolean;
  haptic?: 'tap' | 'confirm';
  className?: string;
}

/** Un solo bottone arancione per schermata: è l'azione che la schermata esiste per compiere. */
export function PrimaryButton({
  label,
  onPress,
  icon,
  disabled = false,
  loading = false,
  glow = true,
  haptic = 'tap',
  className,
}: PrimaryButtonProps) {
  const inactive = disabled || loading;

  return (
    <PressableScale
      onPress={onPress}
      disabled={inactive}
      haptic={haptic}
      scaleTo={0.975}
      accessibilityLabel={label}
      className={`h-[56px] flex-row items-center justify-center gap-2.5 rounded-control ${
        inactive ? 'bg-ink-700' : 'bg-tangerine'
      } ${className ?? ''}`}
      style={glow && !inactive ? shadow.accentGlow : undefined}
    >
      {loading ? (
        <ActivityIndicator color={palette.text} />
      ) : (
        <>
          {icon}
          <Text
            className={`text-[16px] font-extrabold tracking-tight ${
              inactive ? 'text-bone/45' : 'text-white'
            }`}
          >
            {label}
          </Text>
        </>
      )}
    </PressableScale>
  );
}

/* ── Azione secondaria ───────────────────────────────────────────────── */

interface GhostButtonProps {
  label: string;
  onPress: () => void;
  icon?: React.ReactNode;
  /** `danger` per le azioni distruttive (rosso soft, mai rosso pieno). */
  tone?: 'neutral' | 'danger';
  disabled?: boolean;
  className?: string;
}

export function GhostButton({
  label,
  onPress,
  icon,
  tone = 'neutral',
  disabled = false,
  className,
}: GhostButtonProps) {
  const danger = tone === 'danger';
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      scaleTo={0.97}
      accessibilityLabel={label}
      className={`h-[48px] flex-row items-center justify-center gap-2 rounded-[15px] border ${
        danger ? 'border-danger/25 bg-danger/10' : 'border-ink-700 bg-ink-850'
      } ${className ?? ''}`}
    >
      {icon}
      <Text className={`text-[14px] font-extrabold tracking-tight ${danger ? 'text-danger' : 'text-bone'}`}>
        {label}
      </Text>
    </PressableScale>
  );
}

/* ── Documento ───────────────────────────────────────────────────────── */

interface DocButtonProps {
  label: string;
  /**
   * Icona a sinistra. Si omette quando l'etichetta porta già la sua emoji:
   * un glifo per elemento, mai due che dicono la stessa cosa.
   */
  icon?: React.ReactNode;
  onPress: () => void;
  /** Il documento non è ancora stato caricato: il tasto invita ad allegarlo. */
  empty?: boolean;
}

/**
 * Riga "Tap per Visualizzare".
 *
 * Nessun QR e nessuna anteprima di PDF resta aperta a display: qui c'è solo la
 * promessa del documento, il contenuto compare nel viewer a schermo intero.
 */
export function DocButton({ label, icon, onPress, empty = false }: DocButtonProps) {
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.98}
      accessibilityLabel={label}
      className={`h-[46px] w-full flex-row items-center gap-2.5 rounded-[15px] border px-4 ${
        empty ? 'border-dashed border-ink-700 bg-ink-900' : 'border-ink-700 bg-ink-850'
      }`}
    >
      {icon}
      <Text
        numberOfLines={1}
        className={`flex-1 text-[13.5px] font-extrabold tracking-tight ${
          empty ? 'text-bone/55' : 'text-bone'
        }`}
      >
        {label}
      </Text>
      <ChevronRight size={16} color="rgba(244,242,237,0.35)" strokeWidth={2.2} />
    </PressableScale>
  );
}

/* ── Chiamata diretta ────────────────────────────────────────────────── */

/** In emergenza si tocca una volta sola: apre subito il dialer di sistema. */
export function CallButton({
  label,
  phone,
  className,
}: {
  label: string;
  phone: string;
  className?: string;
}) {
  return (
    <PressableScale
      haptic="confirm"
      scaleTo={0.97}
      accessibilityLabel={`${label}, ${phone}`}
      onPress={() => {
        void Linking.openURL(`tel:${phone}`);
      }}
      className={`h-[50px] flex-row items-center justify-center gap-2 rounded-[15px] bg-tangerine ${
        className ?? ''
      }`}
    >
      <Phone size={16} color="#FFFFFF" strokeWidth={2.3} />
      <Text numberOfLines={1} className="text-[14.5px] font-extrabold tracking-tight text-white">
        {label}
      </Text>
    </PressableScale>
  );
}

/** Variante neutra affiancata a `CallButton` (es. WhatsApp del coordinatore). */
export function SoftActionButton({
  label,
  icon,
  onPress,
  className,
}: {
  label: string;
  icon?: React.ReactNode;
  onPress: () => void;
  className?: string;
}) {
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.97}
      accessibilityLabel={label}
      className={`h-[50px] flex-row items-center justify-center gap-2 rounded-[15px] border border-ink-700 bg-ink-850 ${
        className ?? ''
      }`}
    >
      {icon}
      <Text numberOfLines={1} className="text-[13.5px] font-extrabold tracking-tight text-bone">
        {label}
      </Text>
    </PressableScale>
  );
}

/** Spaziatore verticale con la linea di separazione standard. */
export function Divider({ className }: { className?: string }) {
  return <View className={`h-px bg-ink-700 ${className ?? ''}`} />;
}
