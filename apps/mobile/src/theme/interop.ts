import { BlurView } from 'expo-blur';
import { Image as ExpoImage } from 'expo-image';
import { cssInterop } from 'nativewind';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BottomSheetScrollView, BottomSheetView } from '@gorhom/bottom-sheet';

/**
 * Registrazione dei componenti di terze parti presso NativeWind.
 *
 * NativeWind converte `className` in `style` solo per i componenti che conosce:
 * quelli di React Native. Tutto il resto — le viste animate di Reanimated, il
 * blur di Expo, i fogli di gorhom — riceverebbe `className` come prop inerte e
 * si renderizzerebbe **senza stili**, in silenzio.
 *
 * Questo file va importato una volta sola, il più presto possibile (`App.tsx`),
 * prima che qualunque componente monti.
 */

/** Il cuore del design system: ogni elemento premibile è una `Animated.View`. */
cssInterop(Animated.View, { className: 'style' });
cssInterop(Animated.Text, { className: 'style' });
cssInterop(Animated.Image, { className: 'style' });
cssInterop(Animated.ScrollView, {
  className: 'style',
  contentContainerClassName: 'contentContainerStyle',
});

/** Header e tab bar sfocati. */
cssInterop(BlurView, { className: 'style' });

/** Tutte le immagini passano da `expo-image`. */
cssInterop(ExpoImage, { className: 'style' });

/** Guscio delle schermate a schermo intero. */
cssInterop(SafeAreaView, { className: 'style' });

/** Contenuto dei bottom sheet magnetici. */
cssInterop(BottomSheetView, { className: 'style' });
cssInterop(BottomSheetScrollView, {
  className: 'style',
  contentContainerClassName: 'contentContainerStyle',
});
