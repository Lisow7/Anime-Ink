const BASE_URL = 'https://api.jikan.moe/v4'

export async function searchAnime(query) {
  const res = await fetch(`${BASE_URL}/anime?q=${encodeURIComponent(query)}&limit=20`)
  const data = await res.json()
  const q = query.toLowerCase()
  return data.data
    .filter((anime) =>
      anime.title?.toLowerCase().includes(q) ||
      anime.title_english?.toLowerCase().includes(q)
    )
    .sort((a, b) => {
      const dateA = a.aired?.from ? new Date(a.aired.from) : new Date(0)
      const dateB = b.aired?.from ? new Date(b.aired.from) : new Date(0)
      return dateA - dateB
    })

}

export async function getAnimeById(id) {
  const res = await fetch(`${BASE_URL}/anime/${id}/full`)
  const data = await res.json()
  return data.data
}

export async function getTopAnime(page = 1) {
  const res = await fetch(`${BASE_URL}/top/anime?page=${page}&limit=24`)
  const data = await res.json()
  return data
}

export async function getAnimeByFilter({ genre, status, type, orderBy, letter, page = 1 } = {}) {
  const params = new URLSearchParams({ limit: 24, page })
  if (genre) params.set('genres', genre)
  if (status) params.set('status', status)
  if (type) params.set('type', type)
  if (orderBy) params.set('order_by', orderBy)
  if (letter) params.set('letter', letter)
  params.set('sort', orderBy === 'title' ? 'asc' : 'desc')

  const res = await fetch(`${BASE_URL}/anime?${params}`)
  const data = await res.json()
  return data
}

export async function getGenres() {
  const res = await fetch(`${BASE_URL}/genres/anime`)
  const data = await res.json()
  return data.data
}
