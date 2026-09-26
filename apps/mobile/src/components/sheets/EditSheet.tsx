import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import * as DocumentPicker from 'expo-document-picker';
import { Check, FileText, Paperclip, Trash2, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';

import { GhostButton, PrimaryButton } from '@/components/ui/Buttons';
import { PressableScale } from '@/components/ui/PressableScale';
import { createId } from '@/lib/id';
import { SHEET_SNAP_POINTS } from '@/theme/motion';
import { palette } from '@/theme/palette';
import type { DocumentRef } from '@/types';

/* ── Descrizione dei campi ───────────────────────────────────────────── */

export interface EditField {
  key: string;
  label: string;
  placeholder: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'phone-pad' | 'number-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  maxLength?: number;
  /** Il salvataggio resta spento finché questo campo è vuoto. */
  required?: boolean;
}

export type EditValues = Record<string, string>;

interface Props {
  visible: boolean;
  title: string;
  subtitle?: string;
  fields: EditField[];
  initialValues: EditValues;
  /** Blocco allegato opzionale: PDF, immagine o QR del fornitore. */
  attachment?: { label: string; doc: DocumentRef | null };
  saveLabel?: string;
  deleteLabel?: string;
  onSave: (values: EditValues, doc: DocumentRef | null) => void;
  onDelete?: () => void;
  onClose: () => void;
}

/**
 * Unica modale di editing rapido dell'app.
 *
 * Alloggio, attività, passaporto, dogana, trasporti, assicurazione e contatti
 * usano tutti questo foglio: cambia solo l'elenco dei campi. Una sola modale
 * significa un solo comportamento da imparare — e nessun doppione da tenere
 * allineato quando il design cambia.
 *
 * È un foglio magnetico nativo (`@gorhom/bottom-sheet`): trascinamento e snap
 * girano su UI thread, la tastiera spinge il contenuto senza saltare.
 */
export function EditSheet({
  visible,
  title,
  subtitle,
  fields,
  initialValues,
  attachment,
  saveLabel = 'Salva Modifiche',
  deleteLabel,
  onSave,
  onDelete,
  onClose,
}: Props) {
  const sheet = useRef<BottomSheetModal>(null);
  const [values, setValues] = useState<EditValues>(initialValues);
  const [doc, setDoc] = useState<DocumentRef | null>(attachment?.doc ?? null);

  const snapPoints = useMemo(() => [...SHEET_SNAP_POINTS], []);

  // Ogni apertura riparte dai valori correnti: il foglio non si ricorda
  // la bozza abbandonata la volta prima.
  useEffect(() => {
    if (visible) {
      setValues(initialValues);
      setDoc(attachment?.doc ?? null);
      sheet.current?.present();
    } else {
      sheet.current?.dismiss();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.72} />
    ),
    [],
  );

  const pickAttachment = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*'],
      copyToCacheDirectory: true,
    });
    const file = result.assets?.[0];
    if (result.canceled || !file) return;

    setDoc({
      id: createId('doc'),
      kind: file.mimeType?.includes('pdf') ? 'pdf' : 'image',
      title: attachment?.label ?? file.name,
      subtitle: file.name,
      code: 'CARICATO DA TE',
      uri: file.uri,
    });
  }, [attachment?.label]);

  const canSave = fields.every((field) => !field.required || (values[field.key] ?? '').trim().length > 0);

  return (
    <BottomSheetModal
      ref={sheet}
      snapPoints={snapPoints}
      index={0}
      enableDynamicSizing={false}
      enablePanDownToClose
      onDismiss={onClose}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: palette.surface }}
      handleIndicatorStyle={{ backgroundColor: 'rgba(244,242,237,0.22)', width: 44 }}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
    >
      <View className="flex-row items-start gap-3 border-b border-ink-700 px-5 pb-4">
        <View className="flex-1 gap-1">
          <Text className="text-[20px] font-extrabold tracking-tight text-white">{title}</Text>
          {subtitle ? <Text className="text-[12.5px] font-semibold text-mist">{subtitle}</Text> : null}
        </View>
        <PressableScale
          onPress={onClose}
          scaleTo={0.9}
          accessibilityLabel="Chiudi"
          className="h-[38px] w-[38px] items-center justify-center rounded-[13px] border border-ink-700 bg-ink-850"
        >
          <X size={17} color={palette.text} strokeWidth={2.1} />
        </PressableScale>
      </View>

      <BottomSheetScrollView
        contentContainerClassName="gap-3.5 px-5 pb-6 pt-4"
        keyboardShouldPersistTaps="handled"
      >
        {fields.map((field) => (
          <View key={field.key} className="gap-1.5 rounded-[16px] border border-ink-700 bg-ink-850 px-4 py-3">
            <Text className="text-[10.5px] font-bold uppercase tracking-[0.8px] text-bone/45">
              {field.label}
            </Text>
            <BottomSheetTextInput
              value={values[field.key] ?? ''}
              onChangeText={(text) => setValues((previous) => ({ ...previous, [field.key]: text }))}
              placeholder={field.placeholder}
              placeholderTextColor={palette.textMuted}
              multiline={field.multiline}
              keyboardType={field.keyboardType}
              autoCapitalize={field.autoCapitalize ?? 'sentences'}
              maxLength={field.maxLength}
              style={{
                padding: 0,
                color: palette.text,
                fontSize: 15,
                fontWeight: '700',
                minHeight: field.multiline ? 84 : undefined,
                textAlignVertical: field.multiline ? 'top' : 'center',
              }}
            />
          </View>
        ))}

        {attachment ? (
          <View className="gap-2 rounded-[16px] border border-ink-700 bg-ink-850 px-4 py-3.5">
            <Text className="text-[10.5px] font-bold uppercase tracking-[0.8px] text-bone/45">
              {attachment.label}
            </Text>
            {doc ? (
              <View className="flex-row items-center gap-2.5">
                <FileText size={16} color={palette.accentSoft} strokeWidth={2} />
                <Text numberOfLines={1} className="flex-1 text-[13.5px] font-bold text-bone">
                  {doc.subtitle}
                </Text>
                <PressableScale
                  haptic="warn"
                  scaleTo={0.9}
                  accessibilityLabel="Rimuovi allegato"
                  onPress={() => setDoc(null)}
                  className="h-9 w-9 items-center justify-center rounded-xl border border-ink-700 bg-ink-900"
                >
                  <Trash2 size={14} color={palette.danger} strokeWidth={2} />
                </PressableScale>
              </View>
            ) : null}
            <GhostButton
              label={doc ? 'Sostituisci file' : 'Allega PDF o immagine'}
              icon={<Paperclip size={15} color={palette.text} strokeWidth={2} />}
              onPress={() => {
                void pickAttachment();
              }}
            />
          </View>
        ) : null}

        <PrimaryButton
          label={saveLabel}
          haptic="confirm"
          disabled={!canSave}
          icon={<Check size={18} color="#FFFFFF" strokeWidth={2.6} />}
          onPress={() => onSave(values, doc)}
          className="mt-1"
        />

        {onDelete && deleteLabel ? (
          <GhostButton
            label={deleteLabel}
            tone="danger"
            icon={<Trash2 size={15} color={palette.danger} strokeWidth={2} />}
            onPress={onDelete}
          />
        ) : null}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}
