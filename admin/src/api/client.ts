import type { ApiCourt, ApiMatch, GuardarTorneo, Torneo, TorneoCategoria, TorneoGenero } from './types'

/** Error de la API con el código HTTP, para distinguir 401 (sesión) del resto. */
export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    credentials: 'same-origin',
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
    ...init,
  })

  if (!response.ok) {
    let message = response.statusText
    try {
      const text = await response.text()
      if (text) message = text
    } catch {
      // sin cuerpo: nos quedamos con el statusText
    }
    throw new ApiError(response.status, message)
  }

  if (response.status === 204) return undefined as T
  const contentType = response.headers.get('content-type') ?? ''
  return contentType.includes('application/json') ? ((await response.json()) as T) : (undefined as T)
}

export const api = {
  // Lectura pública (el mismo endpoint que consume el front 3D).
  getCourts: () => request<ApiCourt[]>('/courts'),

  // Sesión del administrador.
  me: () => request<{ email: string }>('/auth/me'),
  login: (email: string, password: string) =>
    request<{ email: string }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),

  // Escritura (requiere sesión).
  createCourt: (nombre: string) =>
    request<ApiCourt>('/admin/courts', { method: 'POST', body: JSON.stringify({ nombre }) }),
  renameCourt: (id: number, nombre: string) =>
    request<void>(`/admin/courts/${id}`, { method: 'PUT', body: JSON.stringify({ nombre }) }),
  deleteCourt: (id: number) => request<void>(`/admin/courts/${id}`, { method: 'DELETE' }),
  setMatch: (id: number, match: ApiMatch) =>
    request<void>(`/admin/courts/${id}/match`, { method: 'PUT', body: JSON.stringify(match) }),
  clearMatch: (id: number) => request<void>(`/admin/courts/${id}/match`, { method: 'DELETE' }),
  reorder: (orderedIds: number[]) =>
    request<void>('/admin/courts/reorder', { method: 'POST', body: JSON.stringify({ orderedIds }) }),

  // Torneos y categorías (requieren sesión; la lectura también es privada).
  getTorneos: () => request<Torneo[]>('/admin/tournaments'),
  getTorneo: (id: number) => request<Torneo>(`/admin/tournaments/${id}`),
  crearTorneo: (torneo: GuardarTorneo) =>
    request<Torneo>('/admin/tournaments', { method: 'POST', body: JSON.stringify(torneo) }),
  actualizarTorneo: (id: number, torneo: GuardarTorneo) =>
    request<void>(`/admin/tournaments/${id}`, { method: 'PUT', body: JSON.stringify(torneo) }),
  borrarTorneo: (id: number) => request<void>(`/admin/tournaments/${id}`, { method: 'DELETE' }),
  crearCategoria: (torneoId: number, nivel: number, genero: TorneoGenero) =>
    request<TorneoCategoria>(`/admin/tournaments/${torneoId}/categories`, {
      method: 'POST',
      body: JSON.stringify({ nivel, genero }),
    }),
  actualizarCategoria: (torneoId: number, categoriaId: number, nivel: number, genero: TorneoGenero) =>
    request<void>(`/admin/tournaments/${torneoId}/categories/${categoriaId}`, {
      method: 'PUT',
      body: JSON.stringify({ nivel, genero }),
    }),
  borrarCategoria: (torneoId: number, categoriaId: number) =>
    request<void>(`/admin/tournaments/${torneoId}/categories/${categoriaId}`, { method: 'DELETE' }),
}
