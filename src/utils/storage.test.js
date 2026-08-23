import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readStorage, removeStorage, writeStorage } from './storage'

describe('stockage résilient', () => {
  beforeEach(() => {
    const values = new Map()
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(key => values.get(key) ?? null),
      setItem: vi.fn((key, value) => values.set(key, value)),
      removeItem: vi.fn(key => values.delete(key)),
    })
  })

  it('valide les données avant de les utiliser', () => {
    writeStorage('key', { version: 1 })
    expect(readStorage('key', null, value => value.version === 1)).toEqual({ version: 1 })
    expect(readStorage('key', 'fallback', value => value.version === 2)).toBe('fallback')
  })

  it('retourne la valeur de secours si le JSON est corrompu', () => {
    localStorage.getItem.mockReturnValue('{invalid')
    expect(readStorage('key', [])).toEqual([])
  })

  it('signale un refus ou un quota dépassé sans casser l’application', () => {
    localStorage.setItem.mockImplementation(() => { throw new DOMException('Quota', 'QuotaExceededError') })
    expect(writeStorage('key', { large: true })).toBe(false)
  })

  it('supprime une entrée sans propager les erreurs du navigateur', () => {
    expect(removeStorage('key')).toBe(true)
  })
})
