import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

/**
 * "Visivamente a posto", in regole che non dipendono dagli occhi né dal
 * computer: niente scroll orizzontale, niente testo tagliato senza puntini,
 * niente che esca dallo schermo, niente immagini rotte, nessun bersaglio
 * sovrapposto a un altro, bersagli abbastanza grandi per un dito, contrasto e
 * struttura secondo WCAG 2.2 AA (axe). Ogni problema dice quale elemento è.
 */

export interface LayoutOptions {
  /** Su telefono si controllano anche le dimensioni dei bersagli (24px, WCAG 2.5.8). */
  touch?: boolean;
  /** Regole axe da non applicare, con il motivo nel chiamante. */
  skipRules?: string[];
}

export async function layoutProblems(page: Page, { touch = false }: LayoutOptions = {}): Promise<string[]> {
  return page.evaluate(
    ({ touch }) => {
      const problems: string[] = [];
      const describe = (element: Element) => {
        const tag = element.tagName.toLowerCase();
        const text = (element.getAttribute('aria-label') ?? (element as HTMLElement).innerText ?? '')
          .trim()
          .replace(/\s+/g, ' ')
          .slice(0, 48);
        return `<${tag}> «${text}»`;
      };
      const isVisible = (element: Element) => {
        // Anche gli antenati contano: un tab inattivo resta montato, ma trasparente o nascosto.
        if (!element.checkVisibility({ opacityProperty: true, visibilityProperty: true })) return false;
        if (element.closest('[aria-hidden="true"]')) return false;
        const style = getComputedStyle(element);
        if (style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) === 0)
          return false;
        // Il testo solo per gli screen reader (sr-only) è "tagliato" apposta.
        if (style.clipPath === 'inset(50%)' || style.clip === 'rect(0px, 0px, 0px, 0px)') return false;
        const rect = element.getBoundingClientRect();
        return rect.width > 1 && rect.height > 1;
      };
      /** Il primo antenato che taglia o fa scorrere in orizzontale: lì un elemento più largo è voluto. */
      const clippingAncestor = (element: Element) => {
        for (
          let parent = element.parentElement;
          parent && parent !== document.body;
          parent = parent.parentElement
        )
          if (getComputedStyle(parent).overflowX !== 'visible') return parent;
        return null;
      };
      const isPinned = (element: Element) => {
        for (let node: Element | null = element; node; node = node.parentElement) {
          const position = getComputedStyle(node).position;
          if (position === 'fixed' || position === 'sticky') return true;
        }
        return false;
      };
      const hasOwnText = (element: Element) =>
        [...element.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim());
      const ellipsis = (element: Element) => {
        const style = getComputedStyle(element);
        return style.textOverflow === 'ellipsis' || style.webkitLineClamp !== 'none';
      };

      const page = document.scrollingElement ?? document.documentElement;
      if (page.scrollWidth > window.innerWidth + 1)
        problems.push(
          `La pagina scorre in orizzontale: larga ${page.scrollWidth}px su ${window.innerWidth}px`,
        );

      const elements = [...document.body.querySelectorAll('*')].filter(
        (element) => !(element instanceof SVGElement) && isVisible(element),
      );

      for (const element of elements) {
        const rect = element.getBoundingClientRect();
        const clip = clippingAncestor(element);

        if (!clip && !isPinned(element) && (rect.right > window.innerWidth + 1 || rect.left < -1))
          problems.push(
            `Esce dallo schermo: ${describe(element)} (da ${Math.round(rect.left)} a ${Math.round(rect.right)}px su ${window.innerWidth})`,
          );

        if (!hasOwnText(element)) continue;
        // Il testo più largo della sua scatola, che la scatola taglia senza i puntini.
        const style = getComputedStyle(element);
        if (
          style.overflowX !== 'visible' &&
          !ellipsis(element) &&
          element.scrollWidth > element.clientWidth + 1
        )
          problems.push(`Testo tagliato: ${describe(element)}`);
        // Il testo che esce dal contenitore che lo taglia.
        if (
          clip &&
          !ellipsis(element) &&
          getComputedStyle(clip).overflowX !== 'auto' &&
          getComputedStyle(clip).overflowX !== 'scroll'
        ) {
          const box = clip.getBoundingClientRect();
          if (rect.right > box.right + 1 || rect.left < box.left - 1)
            problems.push(`Testo tagliato dal contenitore: ${describe(element)}`);
        }
      }

      for (const image of [...document.images].filter(isVisible))
        // `blurhash:` è il segnaposto interno di expo-image sul web: lo disegna altrove, l'<img> resta vuota.
        if (image.complete && image.naturalWidth === 0 && !image.src.startsWith('blurhash:'))
          problems.push(`Immagine rotta: ${image.currentSrc || image.src}`);

      const targets = [
        ...document.querySelectorAll(
          'a[href], button, input, select, textarea, [role="button"], [role="tab"], [role="link"], [tabindex]:not([tabindex="-1"])',
        ),
      ].filter(
        (element) => isVisible(element) && !isPinned(element) && !(element as HTMLElement).closest('[inert]'),
      );
      const boxes = targets.map((element) => ({ element, rect: element.getBoundingClientRect() }));

      /** Il contenitore che scorre: chi sta in uno diverso è un livello sopra (una barra flottante). */
      const scroller = (element: Element) => {
        for (let parent = element.parentElement; parent; parent = parent.parentElement) {
          const { overflowY } = getComputedStyle(parent);
          if ((overflowY === 'auto' || overflowY === 'scroll') && parent.scrollHeight > parent.clientHeight)
            return parent;
        }
        return null;
      };

      for (let i = 0; i < boxes.length; i += 1) {
        for (let j = i + 1; j < boxes.length; j += 1) {
          const a = boxes[i]!;
          const b = boxes[j]!;
          if (a.element.contains(b.element) || b.element.contains(a.element)) continue;
          // Il contenuto che scorre sotto una barra flottante non è una sovrapposizione: è voluto.
          if (scroller(a.element) !== scroller(b.element)) continue;
          const width = Math.min(a.rect.right, b.rect.right) - Math.max(a.rect.left, b.rect.left);
          const height = Math.min(a.rect.bottom, b.rect.bottom) - Math.max(a.rect.top, b.rect.top);
          if (width > 2 && height > 2)
            problems.push(`Si sovrappongono: ${describe(a.element)} e ${describe(b.element)}`);
        }
      }

      if (touch) {
        // WCAG 2.5.8: sotto i 24px va bene solo se un cerchio di 24px attorno non tocca un altro bersaglio.
        const center = (rect: DOMRect) => ({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
        for (const { element, rect } of boxes) {
          if (rect.width >= 24 && rect.height >= 24) continue;
          if (element.closest('p, li > span') && element.tagName === 'A') continue; // link dentro una frase
          const here = center(rect);
          const crowded = boxes.some(({ element: other, rect: otherRect }) => {
            if (other === element || other.contains(element) || element.contains(other)) return false;
            const there = center(otherRect);
            return Math.hypot(here.x - there.x, here.y - there.y) < 24;
          });
          if (crowded)
            problems.push(
              `Bersaglio troppo piccolo e troppo vicino ad altri: ${describe(element)} (${Math.round(rect.width)}×${Math.round(rect.height)}px)`,
            );
        }
      }

      return [...new Set(problems)];
    },
    { touch },
  );
}

export async function accessibilityProblems(page: Page, skipRules: string[] = []): Promise<string[]> {
  const builder = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']);
  if (skipRules.length) builder.disableRules(skipRules);
  const { violations } = await builder.analyze();
  return violations.flatMap((violation) =>
    violation.nodes
      .slice(0, 5)
      .map(
        (node) =>
          `${violation.id} (${violation.impact}): ${violation.help} → ${node.target.join(' ')}${node.failureSummary ? ` · ${node.failureSummary.split('\n').slice(1).join(' ').trim()}` : ''}`,
      ),
  );
}

/** Le due verifiche insieme: un elenco vuoto vuol dire "visivamente a posto". */
export async function expectVisuallySound(page: Page, options: LayoutOptions = {}) {
  const layout = await layoutProblems(page, options);
  const accessibility = await accessibilityProblems(page, options.skipRules);
  expect.soft(layout, 'problemi di layout').toEqual([]);
  expect.soft(accessibility, 'problemi di accessibilità (WCAG 2.2 AA)').toEqual([]);
}
