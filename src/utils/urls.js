const YOUTUBE_EMBED_HOSTS = new Set(['www.youtube.com', 'www.youtube-nocookie.com'])

export function safeYoutubeEmbed(value) {
  if (!value) return null
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || !YOUTUBE_EMBED_HOSTS.has(url.hostname)) return null
    if (!url.pathname.startsWith('/embed/')) return null
    url.hostname = 'www.youtube-nocookie.com'
    url.searchParams.set('autoplay', '0')
    return url.toString()
  } catch {
    return null
  }
}
