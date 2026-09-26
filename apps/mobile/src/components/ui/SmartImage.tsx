import { Image, type ImageProps } from 'expo-image';
import React from 'react';

import { blurhash as blurhashes, type BlurhashKey } from '@/theme/palette';
import { IMAGE_TRANSITION_MS } from '@/theme/motion';

export interface SmartImageProps extends Omit<ImageProps, 'placeholder' | 'source'> {
  /** URI remoto o locale. `undefined` lascia a vista il solo blurhash. */
  uri?: string;
  /** Source statico (es. `require(...)`) quando l'immagine è locale al bundle. */
  source?: ImageProps['source'];
  /** Blurhash specifico della foto (arriva dal dato). */
  blurhash?: string;
  /** Tinta di ripiego quando la foto non porta con sé un blurhash. */
  tone?: BlurhashKey;
}

/**
 * Unico modo di mostrare un'immagine in tutta l'app: il tag `<Image>` di React
 * Native non si usa mai.
 *
 * - cache su disco + memoria: la seconda apertura è istantanea e offline;
 * - blurhash come placeholder: lo spazio è già colorato, niente lampo bianco;
 * - crossfade breve al posto del "pop";
 * - `recyclingKey` per far scartare a FlashList il pixel buffer della cella
 *   riciclata invece di mostrare per un frame la foto precedente.
 *
 * Le dimensioni arrivano sempre da fuori (className/style): l'immagine non
 * decide mai quanto spazio occupare, così non c'è layout shift.
 */
export function SmartImage({
  uri,
  source,
  blurhash,
  tone = 'ink',
  contentFit = 'cover',
  transition = IMAGE_TRANSITION_MS,
  ...rest
}: SmartImageProps) {
  return (
    <Image
      source={source ?? (uri ? { uri } : undefined)}
      placeholder={{ blurhash: blurhash ?? blurhashes[tone] }}
      placeholderContentFit="cover"
      cachePolicy="memory-disk"
      recyclingKey={uri}
      contentFit={contentFit}
      transition={transition}
      {...rest}
    />
  );
}
