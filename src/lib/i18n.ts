import { useSettings } from '../context/SettingsContext'
import type { Locale } from '../db/models'

/**
 * Epic 38: keys are the canonical English string itself, so a missing translation naturally falls
 * back to readable English (LC-4) instead of a blank string or a raw key like "nav.today".
 * Coverage: navigation, Settings' section headings/common actions, and the add-task form — the
 * highest-traffic surfaces. Everything else (task titles, notes — LC-2 — and less-common screens)
 * renders in English regardless of locale, which LC-4's fallback is designed to make unsurprising.
 */
const es: Record<string, string> = {
  Today: 'Hoy',
  Calendar: 'Calendario',
  Stats: 'Estadísticas',
  Insights: 'Estadísticas avanzadas',
  Heatmap: 'Mapa de calor',
  Plan: 'Planificar',
  Review: 'Revisión',
  Goals: 'Objetivos',
  Badges: 'Insignias',
  Settings: 'Configuración',
  'Goals Tracker': 'Seguimiento de Objetivos',
  'Add Task': 'Añadir tarea',
  'Save as Template': 'Guardar como plantilla',
  Templates: 'Plantillas',
  'Task title (e.g. Solve DSA questions)': 'Título de la tarea (ej. Resolver problemas)',
  Priority: 'Prioridad',
  High: 'Alta',
  Medium: 'Media',
  Low: 'Baja',
  Cancel: 'Cancelar',
  Delete: 'Eliminar',
  Save: 'Guardar',
  Close: 'Cerrar',
  Skip: 'Omitir',
  'Default view': 'Vista predeterminada',
  Theme: 'Tema',
  Light: 'Claro',
  Dark: 'Oscuro',
  Language: 'Idioma',
  'Export data': 'Exportar datos',
  'Import data': 'Importar datos',
  'Export All Data': 'Exportar todos los datos',
  'Delete All My Data': 'Eliminar todos mis datos',
  Privacy: 'Privacidad',
  Profiles: 'Perfiles',
  'Custom Fields': 'Campos personalizados',
  Focus: 'Enfoque',
  Integrations: 'Integraciones',
  'Day progress': 'Progreso del día',
}

const hi: Record<string, string> = {
  Today: 'आज',
  Calendar: 'कैलेंडर',
  Stats: 'आंकड़े',
  Insights: 'अंतर्दृष्टि',
  Heatmap: 'हीटमैप',
  Plan: 'योजना',
  Review: 'समीक्षा',
  Goals: 'लक्ष्य',
  Badges: 'बैज',
  Settings: 'सेटिंग्स',
  'Goals Tracker': 'गोल्स ट्रैकर',
  'Add Task': 'कार्य जोड़ें',
  'Save as Template': 'टेम्पलेट के रूप में सहेजें',
  Templates: 'टेम्पलेट्स',
  'Task title (e.g. Solve DSA questions)': 'कार्य शीर्षक (जैसे DSA प्रश्न हल करें)',
  Priority: 'प्राथमिकता',
  High: 'उच्च',
  Medium: 'मध्यम',
  Low: 'निम्न',
  Cancel: 'रद्द करें',
  Delete: 'हटाएं',
  Save: 'सहेजें',
  Close: 'बंद करें',
  Skip: 'छोड़ें',
  'Default view': 'डिफ़ॉल्ट दृश्य',
  Theme: 'थीम',
  Light: 'हल्का',
  Dark: 'गहरा',
  Language: 'भाषा',
  'Export data': 'डेटा निर्यात करें',
  'Import data': 'डेटा आयात करें',
  'Export All Data': 'सभी डेटा निर्यात करें',
  'Delete All My Data': 'मेरा सारा डेटा हटाएं',
  Privacy: 'गोपनीयता',
  Profiles: 'प्रोफाइल',
  'Custom Fields': 'कस्टम फ़ील्ड',
  Focus: 'फोकस',
  Integrations: 'एकीकरण',
  'Day progress': 'दिन की प्रगति',
}

const DICTS: Record<Locale, Record<string, string>> = { en: {}, es, hi }

/** LC-4: any string missing from the target locale's dictionary falls back to English (the key itself). */
export function translate(locale: Locale, text: string): string {
  if (locale === 'en') return text
  return DICTS[locale][text] ?? text
}

const INTL_LOCALES: Record<Locale, string> = { en: 'en-US', es: 'es-ES', hi: 'hi-IN' }

/** LC-3: dates/numbers follow the selected app locale's conventions, not just the browser's. */
export function intlLocale(locale: Locale): string {
  return INTL_LOCALES[locale]
}

/** t() is bound to the current app language (Settings → Language). Never applied to user-entered content (LC-2). */
export function useT(): (text: string) => string {
  const { settings } = useSettings()
  return (text: string) => translate(settings.language, text)
}
