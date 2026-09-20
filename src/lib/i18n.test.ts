import { describe, expect, it } from 'vitest'
import { intlLocale, translate } from './i18n'

describe('translate (Epic 38: Localization)', () => {
  it('passes English through unchanged', () => {
    expect(translate('en', 'Today')).toBe('Today')
  })

  it('translates a covered string into Spanish', () => {
    expect(translate('es', 'Today')).toBe('Hoy')
  })

  it('translates a covered string into Hindi', () => {
    expect(translate('hi', 'Today')).toBe('आज')
  })

  it('LC-4: falls back to English for a string with no translation, never blank or a raw key', () => {
    const untranslated = 'Some brand-new string nobody has translated yet'
    expect(translate('es', untranslated)).toBe(untranslated)
    expect(translate('hi', untranslated)).toBe(untranslated)
  })

  it('LC-2: user-generated content is passed through translate() unchanged since it is never a dictionary key', () => {
    const taskTitle = 'Leer 50 páginas de mi libro favorito'
    expect(translate('es', taskTitle)).toBe(taskTitle)
    expect(translate('hi', taskTitle)).toBe(taskTitle)
  })
})

describe('intlLocale (LC-3)', () => {
  it('maps each app locale to an Intl locale tag', () => {
    expect(intlLocale('en')).toBe('en-US')
    expect(intlLocale('es')).toBe('es-ES')
    expect(intlLocale('hi')).toBe('hi-IN')
  })
})
