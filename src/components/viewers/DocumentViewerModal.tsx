import { Download, FileText, Share2, X } from 'lucide-react-native';
import React from 'react';
import { Modal, ScrollView, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GhostButton } from '@/components/ui/Buttons';
import { PressableScale } from '@/components/ui/PressableScale';
import { SmartImage } from '@/components/ui/SmartImage';
import { useToast } from '@/components/ui/Toast';
import { palette } from '@/theme/palette';
import type { DocumentRef } from '@/types';

import { QrCanvas } from './QrCanvas';

interface Props {
  doc: DocumentRef | null;
  onClose: () => void;
}

/**
 * Viewer a schermo intero dei documenti.
 *
 * È l'unico posto dove un QR o una prenotazione diventano visibili: nelle liste
 * si vede solo il tasto. Regola applicata ovunque, dal voucher dell'alloggio al
 * modulo doganale — niente codici aperti a display mentre si scorre in
 * aeroporto.
 */
export function DocumentViewerModal({ doc, onClose }: Props) {
  const toast = useToast();

  return (
    <Modal visible={!!doc} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <SafeAreaView className="flex-1 bg-ink-950" edges={['top', 'bottom']}>
        {doc ? (
          <>
            <View className="flex-row items-center gap-3 px-[18px] pb-4 pt-2">
              <PressableScale
                onPress={onClose}
                scaleTo={0.9}
                accessibilityLabel="Chiudi documento"
                className="h-[42px] w-[42px] items-center justify-center rounded-[14px] border border-ink-700 bg-ink-900"
              >
                <X size={18} color={palette.text} strokeWidth={2.2} />
              </PressableScale>
              <View className="flex-1 gap-0.5">
                <Text numberOfLines={1} className="text-[17px] font-extrabold tracking-tight text-bone">
                  {doc.title}
                </Text>
                <Text numberOfLines={1} className="text-[11.5px] font-semibold text-mist">
                  {doc.subtitle}
                </Text>
              </View>
            </View>

            <ScrollView
              contentContainerClassName="flex-grow items-center justify-center gap-5 px-[18px] pb-6"
              showsVerticalScrollIndicator={false}
              maximumZoomScale={doc.kind === 'image' ? 4 : 1}
              minimumZoomScale={1}
            >
              <Animated.View entering={FadeIn.duration(220)} className="w-full items-center gap-5">
                {doc.kind === 'qr' ? <QrSheet doc={doc} /> : null}
                {doc.kind === 'pdf' ? <PdfSheet doc={doc} /> : null}
                {doc.kind === 'image' ? (
                  <SmartImage
                    uri={doc.uri}
                    contentFit="contain"
                    className="w-full rounded-card"
                    style={{ aspectRatio: 3 / 4 }}
                  />
                ) : null}

                <View className="w-full items-center gap-1 rounded-card border border-ink-700 bg-ink-900 px-4 py-3.5">
                  <Text className="text-[10.5px] font-bold uppercase tracking-[1px] text-bone/45">
                    Codice pratica
                  </Text>
                  <Text className="text-[18px] font-extrabold tracking-tight text-bone">{doc.code}</Text>
                </View>
              </Animated.View>
            </ScrollView>

            <View className="flex-row gap-2.5 border-t border-ink-700 px-[18px] pb-2 pt-3.5">
              <GhostButton
                label="Salva offline"
                className="flex-1"
                icon={<Download size={15} color={palette.text} strokeWidth={2} />}
                onPress={() => toast.show('Documento disponibile offline')}
              />
              <GhostButton
                label="Condividi"
                className="flex-1"
                icon={<Share2 size={15} color={palette.text} strokeWidth={2} />}
                onPress={() => toast.show('Link del documento copiato')}
              />
            </View>
          </>
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}

/** Il QR sta su carta avorio: massimo contrasto per il lettore ottico. */
function QrSheet({ doc }: { doc: DocumentRef }) {
  return (
    <View className="w-full items-center gap-4 rounded-hero border border-cream-line bg-cream p-6">
      <Text className="text-center text-[12px] font-extrabold uppercase tracking-[1.2px] text-cream-ink/55">
        {doc.subtitle}
      </Text>
      <QrCanvas value={doc.code} />
      <Text className="text-center text-[13px] font-bold text-cream-ink/70">
        Mostra questo codice al controllo
      </Text>
    </View>
  );
}

/**
 * Anteprima del PDF.
 *
 * Nel prototipo è una mock del foglio: la struttura del viewer (header, area
 * documento, azioni) è quella definitiva, quindi sostituire questo blocco con
 * un renderer PDF non tocca nient'altro.
 */
function PdfSheet({ doc }: { doc: DocumentRef }) {
  return (
    <View
      className="w-full gap-4 rounded-hero border border-cream-line bg-cream p-6"
      style={{ aspectRatio: 3 / 4 }}
    >
      <View className="flex-row items-center gap-2.5">
        <FileText size={18} color={palette.creamInk} strokeWidth={2} />
        <Text numberOfLines={2} className="flex-1 text-[15px] font-extrabold tracking-tight text-cream-ink">
          {doc.title}
        </Text>
      </View>
      <View className="h-px bg-cream-ink/15" />
      <View className="gap-2.5">
        {[1, 0.92, 0.78, 0.96, 0.64, 0.88, 0.5].map((width, index) => (
          <View
            key={index}
            style={{ width: `${width * 100}%` }}
            className="bg-cream-ink/12 h-2.5 rounded-full"
          />
        ))}
      </View>
      <View className="mt-auto gap-1">
        <Text className="text-[10.5px] font-bold uppercase tracking-[1px] text-cream-ink/45">
          Riferimento
        </Text>
        <Text className="text-[15px] font-extrabold tracking-tight text-cream-ink">{doc.code}</Text>
      </View>
    </View>
  );
}
