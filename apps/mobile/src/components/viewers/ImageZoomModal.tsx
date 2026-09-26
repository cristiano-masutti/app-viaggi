import { X } from 'lucide-react-native';
import React from 'react';
import { Modal, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/PressableScale';

import { ZoomableImage } from './ZoomableImage';

interface Props {
  uri: string | null;
  title: string;
  subtitle?: string;
  onClose: () => void;
}

/**
 * Visore a tutto schermo per una singola immagine (scansione del passaporto).
 *
 * Stessa regola dei documenti: la foto del documento non sta mai aperta dentro
 * una card: si vede qui, a pieno schermo e ingrandibile, solo quando serve
 * davvero — al banco del check-in.
 */
export function ImageZoomModal({ uri, title, subtitle, onClose }: Props) {
  return (
    <Modal visible={!!uri} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View className="flex-1 bg-black">
        <SafeAreaView className="flex-1" edges={['top', 'bottom']}>
          <View className="flex-row items-center gap-3 px-[18px] pb-3 pt-2">
            <PressableScale
              onPress={onClose}
              scaleTo={0.9}
              accessibilityLabel="Chiudi"
              className="h-[42px] w-[42px] items-center justify-center rounded-[14px] border border-white/15 bg-white/10"
            >
              <X size={18} color="#FFFFFF" strokeWidth={2.2} />
            </PressableScale>
            <View className="flex-1 gap-0.5">
              <Text numberOfLines={1} className="text-[16px] font-extrabold tracking-tight text-white">
                {title}
              </Text>
              {subtitle ? (
                <Text numberOfLines={1} className="text-[11.5px] font-semibold text-white/55">
                  {subtitle}
                </Text>
              ) : null}
            </View>
          </View>

          <ZoomableImage uri={uri ?? undefined} onSingleTap={onClose} />

          <Text className="px-[18px] pb-3 pt-2 text-center text-[12px] font-semibold text-white/40">
            Pizzica o tocca due volte per ingrandire
          </Text>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
