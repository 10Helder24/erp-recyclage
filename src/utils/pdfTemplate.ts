import type { PdfTemplateConfig } from '../lib/api';

export type RgbTuple = [number, number, number];

export const hexToRgb = (hex?: string | null, fallback: RgbTuple = [0, 0, 0]): RgbTuple => {
  if (!hex) {
    return fallback;
  }
  const normalized = hex.trim();
  const shorthand = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  const longhand = normalized.replace(shorthand, (_match, r, g, b) => r + r + g + g + b + b);
  const match = /^#?([a-f\d]{6})$/i.exec(longhand);
  if (!match) {
    return fallback;
  }
  const value = parseInt(match[1], 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
};

export async function loadAssetDataUrl(path: string): Promise<string | null> {
  try {
    const response = await fetch(path, { cache: 'no-cache' });
    if (!response.ok) return null;
    const blob = await response.blob();
    return await blobToDataUrl(blob);
  } catch {
    return null;
  }
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function resolveTemplateImage(source?: string | null, fallbackPath?: string): Promise<string | null> {
  if (source?.startsWith('data:')) {
    return source;
  }
  if (source && /^https?:\/\//i.test(source)) {
    try {
      const response = await fetch(source, { cache: 'no-cache' });
      if (response.ok) {
        const blob = await response.blob();
        return await blobToDataUrl(blob);
      }
    } catch {
      // ignore
    }
  }
  if (source?.startsWith('/')) {
    return loadAssetDataUrl(source);
  }
  if (fallbackPath) {
    return loadAssetDataUrl(fallbackPath);
  }
  return null;
}

export const getTemplateColors = (
  template: PdfTemplateConfig | null | undefined,
  options?: { primary?: RgbTuple; accent?: RgbTuple }
) => ({
  primary: hexToRgb(template?.primaryColor, options?.primary ?? [15, 23, 42]),
  accent: hexToRgb(template?.accentColor, options?.accent ?? [14, 165, 233])
});

export const getFooterLines = (template?: PdfTemplateConfig | null, fallback: string[] = []) =>
  template?.footerText?.split('\n').filter(Boolean) ?? fallback;

export type ZonePaletteOptions = {
  background?: RgbTuple;
  text?: RgbTuple;
  title?: RgbTuple;
  subtitle?: RgbTuple;
  border?: RgbTuple;
};

export type ZonePalette = {
  background: RgbTuple;
  text: RgbTuple;
  title: RgbTuple;
  subtitle: RgbTuple;
  border: RgbTuple;
};

const resolveZoneColor = (
  value?: string | null,
  fallback?: RgbTuple,
  defaultValue: RgbTuple = [15, 23, 42]
) => hexToRgb(value, fallback ?? defaultValue);

export const getZonePalette = (
  template: PdfTemplateConfig | null | undefined,
  zone: 'header' | 'body' | 'highlight',
  defaults?: ZonePaletteOptions
): ZonePalette => {
  const zoneConfig = template?.zones?.[zone];
  const background = resolveZoneColor(zoneConfig?.backgroundColor, defaults?.background);
  const text = resolveZoneColor(zoneConfig?.textColor, defaults?.text, [255, 255, 255]);
  const title = resolveZoneColor(
    zoneConfig?.titleColor,
    defaults?.title,
    zone === 'header' ? text : resolveZoneColor(zoneConfig?.textColor, defaults?.text, [34, 197, 94])
  );
  const subtitle = resolveZoneColor(
    zoneConfig?.subtitleColor,
    defaults?.subtitle,
    zone === 'header' ? text : title
  );
  const border = resolveZoneColor(zoneConfig?.borderColor, defaults?.border, text);
  return {
    background,
    text,
    title,
    subtitle,
    border
  };
};

