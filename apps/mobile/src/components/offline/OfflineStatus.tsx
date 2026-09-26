import { CloudOff, HardDriveDownload, RefreshCw, ShieldCheck } from 'lucide-react-native';
import React, { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { PressableScale } from '@/components/ui/PressableScale';
import { formatBytes } from '@/lib/offlineDocuments';
import { useOfflineDocument, useTripOfflineStatus } from '@/store/OfflineLibrary';
import { slideSpring } from '@/theme/motion';
import { palette } from '@/theme/palette';
import type { Trip } from '@/types';

/**
 * Indicatore accanto al singolo documento.
 *
 * Non mostra nulla quando il file è già sul telefono: è la condizione normale, e
 * dodici spunte verdi identiche sarebbero solo rumore. Parla soltanto quando c'è
 * qualcosa da sapere — sta scaricando, o non ce l'ha fatta.
 */
export function OfflineBadge({ docId }: { docId: string }) {
  const entry = useOfflineDocument(docId);

  if (entry.state === 'saved') return null;

  if (entry.state === 'failed') {
    return (
      <View className="flex-row items-center gap-1 rounded-chip border border-danger/30 bg-danger/10 px-2 py-1">
        <CloudOff size={11} color={palette.danger} strokeWidth={2.4} />
        <Text className="text-[10px] font-extrabold text-danger">Non salvato</Text>
      </View>
    );
  }

  return (
    <View className="flex-row items-center gap-1 rounded-chip border border-ink-700 bg-ink-900 px-2 py-1">
      <HardDriveDownload size={11} color={palette.textMuted} strokeWidth={2.2} />
      <Text className="text-[10px] font-extrabold text-mist">
        {entry.state === 'saving' ? 'Salvo…' : 'In coda'}
      </Text>
    </View>
  );
}

/**
 * Riga di stato della biblioteca offline del viaggio.
 *
 * Dice una cosa sola, quella che conta prima di partire: i documenti sono già
 * sul telefono oppure no. Sta in cima alla tab Organizza perché è una proprietà
 * di tutto il blocco documenti, non della singola card.
 */
export function TripOfflineStrip({ trip }: { trip: Trip }) {
  const status = useTripOfflineStatus(trip);
  const progress = useSharedValue(0);

  const ratio = status.total > 0 ? status.saved / status.total : 1;

  useEffect(() => {
    progress.value = withSpring(ratio, slideSpring);
  }, [progress, ratio]);

  const bar = useAnimatedStyle(() => ({ width: `${Math.max(0, Math.min(1, progress.value)) * 100}%` }));

  if (status.total === 0) return null;

  const failed = status.failed > 0;
  const complete = status.complete;

  return (
    <View
      className={`gap-2.5 rounded-card border px-4 py-3 ${
        failed ? 'border-danger/25 bg-danger/[0.07]' : 'border-ink-700 bg-ink-900'
      }`}
    >
      <View className="flex-row items-center gap-2.5">
        {failed ? (
          <CloudOff size={16} color={palette.danger} strokeWidth={2.2} />
        ) : complete ? (
          <ShieldCheck size={16} color={palette.success} strokeWidth={2.2} />
        ) : (
          <HardDriveDownload size={16} color={palette.accentSoft} strokeWidth={2.2} />
        )}

        <View className="flex-1 gap-0.5">
          <Text className="text-[13px] font-extrabold tracking-tight text-bone">
            {failed
              ? `${status.failed} document${status.failed === 1 ? 'o' : 'i'} non salvat${status.failed === 1 ? 'o' : 'i'}`
              : complete
                ? 'Tutti i documenti sono sul telefono'
                : 'Salvataggio dei documenti…'}
          </Text>
          <Text numberOfLines={2} className="text-[11.5px] font-semibold text-mist">
            {status.supported
              ? `${status.saved}/${status.total}${status.bytes > 0 ? ` · ${formatBytes(status.bytes)}` : ''} · leggibili senza rete`
              : `${status.saved}/${status.total} · anteprima web (nessun disco nel browser)`}
          </Text>
        </View>

        {failed ? (
          <PressableScale
            onPress={status.retryFailed}
            scaleTo={0.92}
            accessibilityLabel="Riprova il salvataggio offline"
            className="h-9 flex-row items-center gap-1.5 rounded-xl border border-ink-700 bg-ink-850 px-3"
          >
            <RefreshCw size={13} color={palette.text} strokeWidth={2.2} />
            <Text className="text-[12px] font-extrabold text-bone">Riprova</Text>
          </PressableScale>
        ) : null}
      </View>

      {/* La barra resta finché non sono tutti giù: sparisce quando non serve più. */}
      {!complete && !failed ? (
        <View className="h-1 overflow-hidden rounded-full bg-ink-700">
          <Animated.View className="h-full rounded-full bg-tangerine" style={bar} />
        </View>
      ) : null}
    </View>
  );
}
