// lib/guides/guideTheme.ts

import type { CSSProperties } from 'react'

import {
  DEFAULT_GUIDE_BRAND_COLORS,
  type GuideBrandConfig,
  type GuideBrandingMode,
  type GuideBrandRow,
} from './types'

/* ------------------------------------------------ */
/* Types                                            */
/* ------------------------------------------------ */

export type GuideThemeMode = 'light' | 'dark'

export type GuideThemeTokens = {
  primary: string
  secondary: string
  accent: string
  background: string
  surface: string
  surfaceElevated: string
  text: string
  mutedText: string
  buttonText: string
  border: string
  subtleBorder: string
  focusRing: string
  overlay: string
  fontFamily: string
  colorScheme: GuideThemeMode
}

export type GuideThemeCssVariables = CSSProperties & {
  '--guide-primary': string
  '--guide-secondary': string
  '--guide-accent': string
  '--guide-background': string
  '--guide-surface': string
  '--guide-surface-elevated': string
  '--guide-text': string
  '--guide-muted-text': string
  '--guide-button-text': string
  '--guide-border': string
  '--guide-subtle-border': string
  '--guide-focus-ring': string
  '--guide-overlay': string
  '--guide-font-family': string
}

export type GuideThemeClassNames = {
  page: string
  surface: string
  elevatedSurface: string
  border: string
  heading: string
  body: string
  muted: string
  primaryButton: string
  secondaryButton: string
  badge: string
  link: string
  input: string
}

type GuideBrandLike =
  | GuideBrandConfig
  | GuideBrandRow
  | null
  | undefined

type ResolvedBrandValues = {
  id: string
  name: string
  slug: string
  logoUrl: string | null
  faviconUrl: string | null
  primaryColor: string
  secondaryColor: string
  accentColor: string
  backgroundColor: string
  surfaceColor: string
  textColor: string
  mutedTextColor: string
  buttonTextColor: string
  fontFamily: string | null
  brandingMode: GuideBrandingMode
  poweredByRoam: boolean
  customCss: string | null
}

/* ------------------------------------------------ */
/* Defaults                                         */
/* ------------------------------------------------ */

const DEFAULT_FONT_FAMILY =
  'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

const DEFAULT_BRAND_ID = 'roam-default'
const DEFAULT_BRAND_NAME = 'Roam'
const DEFAULT_BRAND_SLUG = 'roam'

export const DEFAULT_GUIDE_BRAND: GuideBrandConfig = {
  id: DEFAULT_BRAND_ID,
  name: DEFAULT_BRAND_NAME,
  slug: DEFAULT_BRAND_SLUG,

  logoUrl: null,
  faviconUrl: null,

  primaryColor: DEFAULT_GUIDE_BRAND_COLORS.primaryColor,
  secondaryColor: DEFAULT_GUIDE_BRAND_COLORS.secondaryColor,
  accentColor: DEFAULT_GUIDE_BRAND_COLORS.accentColor,
  backgroundColor: DEFAULT_GUIDE_BRAND_COLORS.backgroundColor,
  surfaceColor: DEFAULT_GUIDE_BRAND_COLORS.surfaceColor,
  textColor: DEFAULT_GUIDE_BRAND_COLORS.textColor,
  mutedTextColor: DEFAULT_GUIDE_BRAND_COLORS.mutedTextColor,
  buttonTextColor: DEFAULT_GUIDE_BRAND_COLORS.buttonTextColor,

  fontFamily: DEFAULT_FONT_FAMILY,
  brandingMode: 'roam',
  poweredByRoam: true,
  customCss: null,
}

/* ------------------------------------------------ */
/* Public Brand Normalization                       */
/* ------------------------------------------------ */

export function normalizeGuideBrand(
  brand: GuideBrandLike
): GuideBrandConfig {
  const values = resolveBrandValues(brand)

  return {
    id: values.id,
    name: values.name,
    slug: values.slug,

    logoUrl: values.logoUrl,
    faviconUrl: values.faviconUrl,

    primaryColor: normalizeGuideColor(
      values.primaryColor,
      DEFAULT_GUIDE_BRAND_COLORS.primaryColor
    ),
    secondaryColor: normalizeGuideColor(
      values.secondaryColor,
      DEFAULT_GUIDE_BRAND_COLORS.secondaryColor
    ),
    accentColor: normalizeGuideColor(
      values.accentColor,
      DEFAULT_GUIDE_BRAND_COLORS.accentColor
    ),
    backgroundColor: normalizeGuideColor(
      values.backgroundColor,
      DEFAULT_GUIDE_BRAND_COLORS.backgroundColor
    ),
    surfaceColor: normalizeGuideColor(
      values.surfaceColor,
      DEFAULT_GUIDE_BRAND_COLORS.surfaceColor
    ),
    textColor: normalizeGuideColor(
      values.textColor,
      DEFAULT_GUIDE_BRAND_COLORS.textColor
    ),
    mutedTextColor: normalizeGuideColor(
      values.mutedTextColor,
      DEFAULT_GUIDE_BRAND_COLORS.mutedTextColor
    ),
    buttonTextColor: normalizeGuideColor(
      values.buttonTextColor,
      DEFAULT_GUIDE_BRAND_COLORS.buttonTextColor
    ),

    fontFamily: normalizeGuideFontFamily(values.fontFamily),
    brandingMode: normalizeBrandingMode(values.brandingMode),
    poweredByRoam: values.poweredByRoam,
    customCss: normalizeCustomCss(values.customCss),
  }
}

/* ------------------------------------------------ */
/* Theme Construction                               */
/* ------------------------------------------------ */

export function buildGuideThemeTokens(
  brandInput: GuideBrandLike
): GuideThemeTokens {
  const brand = normalizeGuideBrand(brandInput)
  const colorScheme = inferGuideThemeMode(brand.backgroundColor)

  const border =
    colorScheme === 'dark'
      ? mixColors(brand.surfaceColor, brand.textColor, 0.16)
      : mixColors(brand.surfaceColor, brand.textColor, 0.12)

  const subtleBorder =
    colorScheme === 'dark'
      ? mixColors(brand.surfaceColor, brand.textColor, 0.09)
      : mixColors(brand.surfaceColor, brand.textColor, 0.07)

  const surfaceElevated =
    colorScheme === 'dark'
      ? mixColors(brand.surfaceColor, brand.textColor, 0.05)
      : mixColors(brand.surfaceColor, brand.backgroundColor, 0.28)

  const overlay =
    colorScheme === 'dark'
      ? rgbaFromHex('#000000', 0.56)
      : rgbaFromHex('#000000', 0.22)

  return {
    primary: brand.primaryColor,
    secondary: brand.secondaryColor,
    accent: brand.accentColor,
    background: brand.backgroundColor,
    surface: brand.surfaceColor,
    surfaceElevated,
    text: brand.textColor,
    mutedText: brand.mutedTextColor,
    buttonText: brand.buttonTextColor,
    border,
    subtleBorder,
    focusRing: rgbaFromHex(brand.accentColor, 0.42),
    overlay,
    fontFamily: brand.fontFamily ?? DEFAULT_FONT_FAMILY,
    colorScheme,
  }
}

export function buildGuideThemeVariables(
  brandInput: GuideBrandLike
): GuideThemeCssVariables {
  const tokens = buildGuideThemeTokens(brandInput)

  return {
    '--guide-primary': tokens.primary,
    '--guide-secondary': tokens.secondary,
    '--guide-accent': tokens.accent,
    '--guide-background': tokens.background,
    '--guide-surface': tokens.surface,
    '--guide-surface-elevated': tokens.surfaceElevated,
    '--guide-text': tokens.text,
    '--guide-muted-text': tokens.mutedText,
    '--guide-button-text': tokens.buttonText,
    '--guide-border': tokens.border,
    '--guide-subtle-border': tokens.subtleBorder,
    '--guide-focus-ring': tokens.focusRing,
    '--guide-overlay': tokens.overlay,
    '--guide-font-family': tokens.fontFamily,

    backgroundColor: tokens.background,
    color: tokens.text,
    colorScheme: tokens.colorScheme,
    fontFamily: tokens.fontFamily,
  }
}

export function buildGuideThemeStyle(
  brandInput: GuideBrandLike
): GuideThemeCssVariables {
  return buildGuideThemeVariables(brandInput)
}

/* ------------------------------------------------ */
/* Reusable Theme Classes                           */
/* ------------------------------------------------ */

export function getGuideThemeClassNames(): GuideThemeClassNames {
  return {
    page:
      'min-h-screen bg-[var(--guide-background)] text-[var(--guide-text)]',

    surface:
      'border border-[var(--guide-border)] bg-[var(--guide-surface)] text-[var(--guide-text)]',

    elevatedSurface:
      'border border-[var(--guide-border)] bg-[var(--guide-surface-elevated)] text-[var(--guide-text)] shadow-xl',

    border:
      'border-[var(--guide-border)]',

    heading:
      'text-[var(--guide-text)]',

    body:
      'text-[var(--guide-text)]',

    muted:
      'text-[var(--guide-muted-text)]',

    primaryButton:
      'inline-flex items-center justify-center rounded-full border border-transparent bg-[var(--guide-primary)] px-4 py-2 font-semibold text-[var(--guide-button-text)] transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--guide-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--guide-background)] disabled:pointer-events-none disabled:opacity-50',

    secondaryButton:
      'inline-flex items-center justify-center rounded-full border border-[var(--guide-border)] bg-[var(--guide-surface)] px-4 py-2 font-semibold text-[var(--guide-text)] transition hover:bg-[var(--guide-surface-elevated)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--guide-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--guide-background)] disabled:pointer-events-none disabled:opacity-50',

    badge:
      'inline-flex items-center rounded-full border border-[var(--guide-border)] bg-[var(--guide-surface-elevated)] px-2.5 py-1 text-xs font-semibold text-[var(--guide-text)]',

    link:
      'font-medium text-[var(--guide-accent)] underline-offset-4 transition hover:underline hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--guide-focus-ring)]',

    input:
      'w-full rounded-xl border border-[var(--guide-border)] bg-[var(--guide-surface)] px-3 py-2 text-[var(--guide-text)] placeholder:text-[var(--guide-muted-text)] focus:border-[var(--guide-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--guide-focus-ring)]',
  }
}

/* ------------------------------------------------ */
/* Metadata Helpers                                 */
/* ------------------------------------------------ */

export function getGuideThemeColor(
  brandInput: GuideBrandLike
): string {
  return normalizeGuideBrand(brandInput).backgroundColor
}

export function getGuideAccentColor(
  brandInput: GuideBrandLike
): string {
  return normalizeGuideBrand(brandInput).accentColor
}

export function getGuideFaviconUrl(
  brandInput: GuideBrandLike
): string | null {
  return normalizeGuideBrand(brandInput).faviconUrl
}

export function shouldShowPoweredByRoam(
  brandInput: GuideBrandLike,
  guidePoweredByRoam?: boolean | null
): boolean {
  if (typeof guidePoweredByRoam === 'boolean') {
    return guidePoweredByRoam
  }

  return normalizeGuideBrand(brandInput).poweredByRoam
}

/* ------------------------------------------------ */
/* Theme Mode                                       */
/* ------------------------------------------------ */

export function inferGuideThemeMode(
  backgroundColor: string
): GuideThemeMode {
  const rgb = hexToRgb(
    normalizeGuideColor(
      backgroundColor,
      DEFAULT_GUIDE_BRAND_COLORS.backgroundColor
    )
  )

  if (!rgb) return 'dark'

  const luminance = relativeLuminance(rgb.r, rgb.g, rgb.b)

  return luminance > 0.48 ? 'light' : 'dark'
}

export function getReadableTextColor(
  backgroundColor: string,
  lightColor = '#f8fafc',
  darkColor = '#020617'
): string {
  return inferGuideThemeMode(backgroundColor) === 'dark'
    ? normalizeGuideColor(lightColor, '#f8fafc')
    : normalizeGuideColor(darkColor, '#020617')
}

/* ------------------------------------------------ */
/* Color Normalization                              */
/* ------------------------------------------------ */

export function normalizeGuideColor(
  value: string | null | undefined,
  fallback: string
): string {
  const normalizedFallback =
    normalizeHexColor(fallback) ?? DEFAULT_GUIDE_BRAND_COLORS.backgroundColor

  if (!value || typeof value !== 'string') {
    return normalizedFallback
  }

  return normalizeHexColor(value) ?? normalizedFallback
}

export function isValidGuideColor(
  value: string | null | undefined
): value is string {
  if (typeof value !== 'string') return false
  return normalizeHexColor(value) !== null
}

/* ------------------------------------------------ */
/* Font Normalization                               */
/* ------------------------------------------------ */

export function normalizeGuideFontFamily(
  value: string | null | undefined
): string {
  if (!value || typeof value !== 'string') {
    return DEFAULT_FONT_FAMILY
  }

  const trimmed = value.trim()

  if (!trimmed) return DEFAULT_FONT_FAMILY

  const sanitized = trimmed
    .replace(/[{}<>;]/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, 240)
    .trim()

  return sanitized || DEFAULT_FONT_FAMILY
}

/* ------------------------------------------------ */
/* Private Helpers                                  */
/* ------------------------------------------------ */

function resolveBrandValues(
  brand: GuideBrandLike
): ResolvedBrandValues {
  if (!brand) {
    return {
      id: DEFAULT_GUIDE_BRAND.id,
      name: DEFAULT_GUIDE_BRAND.name,
      slug: DEFAULT_GUIDE_BRAND.slug,

      logoUrl: DEFAULT_GUIDE_BRAND.logoUrl,
      faviconUrl: DEFAULT_GUIDE_BRAND.faviconUrl,

      primaryColor: DEFAULT_GUIDE_BRAND.primaryColor,
      secondaryColor: DEFAULT_GUIDE_BRAND.secondaryColor,
      accentColor: DEFAULT_GUIDE_BRAND.accentColor,
      backgroundColor: DEFAULT_GUIDE_BRAND.backgroundColor,
      surfaceColor: DEFAULT_GUIDE_BRAND.surfaceColor,
      textColor: DEFAULT_GUIDE_BRAND.textColor,
      mutedTextColor: DEFAULT_GUIDE_BRAND.mutedTextColor,
      buttonTextColor: DEFAULT_GUIDE_BRAND.buttonTextColor,

      fontFamily: DEFAULT_GUIDE_BRAND.fontFamily,
      brandingMode: DEFAULT_GUIDE_BRAND.brandingMode,
      poweredByRoam: DEFAULT_GUIDE_BRAND.poweredByRoam,
      customCss: DEFAULT_GUIDE_BRAND.customCss,
    }
  }

  if (isNormalizedGuideBrand(brand)) {
    return {
      id: cleanString(brand.id) || DEFAULT_BRAND_ID,
      name: cleanString(brand.name) || DEFAULT_BRAND_NAME,
      slug: cleanString(brand.slug) || DEFAULT_BRAND_SLUG,

      logoUrl: cleanNullableString(brand.logoUrl),
      faviconUrl: cleanNullableString(brand.faviconUrl),

      primaryColor:
        brand.primaryColor || DEFAULT_GUIDE_BRAND_COLORS.primaryColor,
      secondaryColor:
        brand.secondaryColor || DEFAULT_GUIDE_BRAND_COLORS.secondaryColor,
      accentColor:
        brand.accentColor || DEFAULT_GUIDE_BRAND_COLORS.accentColor,
      backgroundColor:
        brand.backgroundColor || DEFAULT_GUIDE_BRAND_COLORS.backgroundColor,
      surfaceColor:
        brand.surfaceColor || DEFAULT_GUIDE_BRAND_COLORS.surfaceColor,
      textColor:
        brand.textColor || DEFAULT_GUIDE_BRAND_COLORS.textColor,
      mutedTextColor:
        brand.mutedTextColor || DEFAULT_GUIDE_BRAND_COLORS.mutedTextColor,
      buttonTextColor:
        brand.buttonTextColor || DEFAULT_GUIDE_BRAND_COLORS.buttonTextColor,

      fontFamily: cleanNullableString(brand.fontFamily),
      brandingMode: brand.brandingMode,
      poweredByRoam: Boolean(brand.poweredByRoam),
      customCss: cleanNullableString(brand.customCss),
    }
  }

  return {
    id: cleanString(brand.id) || DEFAULT_BRAND_ID,
    name: cleanString(brand.name) || DEFAULT_BRAND_NAME,
    slug: cleanString(brand.slug) || DEFAULT_BRAND_SLUG,

    logoUrl: cleanNullableString(brand.logo_url),
    faviconUrl: cleanNullableString(brand.favicon_url),

    primaryColor:
      brand.primary_color ?? DEFAULT_GUIDE_BRAND_COLORS.primaryColor,
    secondaryColor:
      brand.secondary_color ?? DEFAULT_GUIDE_BRAND_COLORS.secondaryColor,
    accentColor:
      brand.accent_color ?? DEFAULT_GUIDE_BRAND_COLORS.accentColor,
    backgroundColor:
      brand.background_color ?? DEFAULT_GUIDE_BRAND_COLORS.backgroundColor,
    surfaceColor:
      brand.surface_color ?? DEFAULT_GUIDE_BRAND_COLORS.surfaceColor,
    textColor:
      brand.text_color ?? DEFAULT_GUIDE_BRAND_COLORS.textColor,
    mutedTextColor:
      brand.muted_text_color ?? DEFAULT_GUIDE_BRAND_COLORS.mutedTextColor,
    buttonTextColor:
      brand.button_text_color ?? DEFAULT_GUIDE_BRAND_COLORS.buttonTextColor,

    fontFamily: cleanNullableString(brand.font_family),
    brandingMode: brand.branding_mode,
    poweredByRoam: Boolean(brand.powered_by_roam),
    customCss: cleanNullableString(brand.custom_css),
  }
}

function isNormalizedGuideBrand(
  brand: GuideBrandConfig | GuideBrandRow
): brand is GuideBrandConfig {
  return 'primaryColor' in brand
}

function normalizeBrandingMode(
  value: GuideBrandingMode | string | null | undefined
): GuideBrandingMode {
  if (value === 'co_branded') return 'co_branded'
  if (value === 'white_label') return 'white_label'
  return 'roam'
}

function normalizeCustomCss(
  value: string | null | undefined
): string | null {
  if (!value || typeof value !== 'string') return null

  const trimmed = value.trim()

  if (!trimmed) return null

  return trimmed.slice(0, 20_000)
}

function normalizeHexColor(value: string): string | null {
  const raw = value.trim().toLowerCase()

  if (/^#[0-9a-f]{3}$/i.test(raw)) {
    return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`
  }

  if (/^#[0-9a-f]{4}$/i.test(raw)) {
    return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}${raw[4]}${raw[4]}`
  }

  if (/^#[0-9a-f]{6}$/i.test(raw)) {
    return raw
  }

  if (/^#[0-9a-f]{8}$/i.test(raw)) {
    return raw
  }

  return null
}

function hexToRgb(
  value: string
): { r: number; g: number; b: number } | null {
  const normalized = normalizeHexColor(value)
  if (!normalized) return null

  const hex = normalized.slice(1, 7)

  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  }
}

function relativeLuminance(
  red: number,
  green: number,
  blue: number
): number {
  const channels = [red, green, blue].map((channel) => {
    const value = channel / 255

    return value <= 0.03928
      ? value / 12.92
      : Math.pow((value + 0.055) / 1.055, 2.4)
  })

  return (
    0.2126 * channels[0] +
    0.7152 * channels[1] +
    0.0722 * channels[2]
  )
}

function rgbaFromHex(
  color: string,
  alpha: number
): string {
  const rgb = hexToRgb(color)

  if (!rgb) {
    return `rgba(0, 0, 0, ${clamp(alpha, 0, 1)})`
  }

  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${clamp(alpha, 0, 1)})`
}

function mixColors(
  baseColor: string,
  overlayColor: string,
  overlayWeight: number
): string {
  const base = hexToRgb(baseColor)
  const overlay = hexToRgb(overlayColor)

  if (!base || !overlay) {
    return normalizeGuideColor(
      baseColor,
      DEFAULT_GUIDE_BRAND_COLORS.surfaceColor
    )
  }

  const weight = clamp(overlayWeight, 0, 1)
  const inverseWeight = 1 - weight

  const red = Math.round(base.r * inverseWeight + overlay.r * weight)
  const green = Math.round(base.g * inverseWeight + overlay.g * weight)
  const blue = Math.round(base.b * inverseWeight + overlay.b * weight)

  return rgbToHex(red, green, blue)
}

function rgbToHex(
  red: number,
  green: number,
  blue: number
): string {
  return `#${toHexChannel(red)}${toHexChannel(green)}${toHexChannel(blue)}`
}

function toHexChannel(value: number): string {
  return clamp(Math.round(value), 0, 255)
    .toString(16)
    .padStart(2, '0')
}

function clamp(
  value: number,
  minimum: number,
  maximum: number
): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function cleanString(
  value: string | null | undefined
): string {
  return typeof value === 'string' ? value.trim() : ''
}

function cleanNullableString(
  value: string | null | undefined
): string | null {
  const cleaned = cleanString(value)
  return cleaned || null
}