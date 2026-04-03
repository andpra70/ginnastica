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
  return `${base}${normalizedPath}`
}
