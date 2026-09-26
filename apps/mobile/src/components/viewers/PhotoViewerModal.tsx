import { Lock, Trash2, X } from 'lucide-react-native';
import React from 'react';
import { Modal, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ReactionBar } from '@/components/memories/ReactionBar';
import { PressableScale } from '@/components/ui/PressableScale';
import { palette } from '@/theme/palette';
import type { CrewMember, PhotoMemory, ReactionKey } from '@/types';

import { ZoomableImage } from './ZoomableImage';

interface Props {
  memory: PhotoMemory | null;
  author?: CrewMember;
  dayLabel?: string;
  /** Solo chi ha caricato il ricordo può eliminarlo. */
  canDelete?: boolean;
  onToggleReaction: (reaction: ReactionKey) => void;
  onDelete?: () => void;
  onClose: () => void;
}

/**
 * Visore a tutto schermo di un ricordo.
 *
 * Sopra e sotto la foto restano solo le informazioni che servono lì — chi l'ha
 * scattata, quando, le reazioni. Tutto il resto è nero: la foto è il contenuto,
 * non un elemento dentro una schermata.
 */
export function PhotoViewerModal({
  memory,
  author,
  dayLabel,
  canDelete = false,
  onToggleReaction,
  onDelete,
  onClose,
}: Props) {
  return (
    <Modal visible={!!memory} animationType="fade" transparent statusBarTranslucent onRequestClose={onClose}>
      <View className="flex-1 bg-black">
        <SafeAreaView className="flex-1" edges={['top', 'bottom']}>
          {memory ? (
            <>
              <View className="z-10 flex-row items-center gap-3 px-[18px] pb-3 pt-2">
                <PressableScale
                  onPress={onClose}
                  scaleTo={0.9}
                  accessibilityLabel="Chiudi foto"
                  className="h-[42px] w-[42px] items-center justify-center rounded-[14px] border border-white/15 bg-white/10"
                >
                  <X size={18} color="#FFFFFF" strokeWidth={2.2} />
                </PressableScale>

                <View className="flex-1 gap-0.5">
                  <Text numberOfLines={1} className="text-[15px] font-extrabold tracking-tight text-white">
                    {author?.name ?? 'Crew'}
                  </Text>
                  <Text numberOfLines={1} className="text-[11.5px] font-semibold text-white/55">
                    {[dayLabel, memory.time].filter(Boolean).join(' • ')}
                  </Text>
                </View>

                {memory.visibility === 'private' ? (
                  <View className="flex-row items-center gap-1.5 rounded-chip border border-white/15 bg-white/10 px-3 py-1.5">
                    <Lock size={12} color="#FFFFFF" strokeWidth={2.2} />
                    <Text className="text-[11px] font-extrabold text-white">Privata</Text>
                  </View>
                ) : null}
              </View>

              {/* `key` sull'id: aprire un'altra foto riparte da zoom 1. */}
              <ZoomableImage
                key={memory.id}
                uri={memory.uri}
                blurhash={memory.blurhash}
                onSingleTap={onClose}
              />

              <View className="gap-3 px-[18px] pb-2 pt-3">
                {memory.caption ? (
                  <Text className="text-[14.5px] font-semibold leading-[21px] text-white/85">
                    {memory.caption}
                  </Text>
                ) : null}

                <View className="flex-row items-center justify-between gap-3">
                  <ReactionBar memory={memory} onToggle={onToggleReaction} />
                  {canDelete && onDelete ? (
                    <PressableScale
                      haptic="warn"
                      scaleTo={0.9}
                      accessibilityLabel="Elimina ricordo"
                      onPress={onDelete}
                      className="h-10 w-10 items-center justify-center rounded-[13px] border border-danger/30 bg-danger/15"
                    >
                      <Trash2 size={16} color={palette.danger} strokeWidth={2} />
                    </PressableScale>
                  ) : null}
                </View>
              </View>
            </>
          ) : null}
        </SafeAreaView>
      </View>
    </Modal>
  );
}
