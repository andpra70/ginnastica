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
  if (typeof window === 'undefined') return `${base}${normalizedPath}`

  const baseUrl = new URL(base, window.location.href)
  return new URL(normalizedPath, baseUrl).toString()
}
