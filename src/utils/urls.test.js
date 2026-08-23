import { describe, expect, it } from 'vitest'
import { safeYoutubeEmbed } from './urls'

describe('safeYoutubeEmbed', () => {
  it('accepte uniquement un embed YouTube HTTPS et active le domaine sans cookies', () => {
    expect(safeYoutubeEmbed('https://www.youtube.com/embed/abc123?autoplay=1'))
      .toBe('https://www.youtube-nocookie.com/embed/abc123?autoplay=0')
  })

  it.each([
    'http://www.youtube.com/embed/abc123',
    'https://evil.example/embed/abc123',
    'https://www.youtube.com/watch?v=abc123',
    'not-a-url',
    '',
  ])('rejette une URL non autorisée : %s', (value) => {
    expect(safeYoutubeEmbed(value)).toBeNull()
  })
})
