export default function resolveAssetPath(path) {
  if (!path) return path
  if (
    path.startsWith('http://') ||
    path.startsWith('https://') ||
    path.startsWith('//') ||
    path.startsWith('data:') ||
    path.startsWith('blob:')
  ) {
    return path
  }

  const base = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/')
  const normalizedPath = path.replace(/^\/+/, '')
  const origin = typeof window !== 'undefined' ? window.location.origin : ''

  if (!origin) return `${base}${normalizedPath}`

  const baseUrl = new URL(base, origin)
  return new URL(normalizedPath, baseUrl).toString()
}
