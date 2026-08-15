export function slugify(name: string) {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")

  return `${base || "workspace"}-${crypto.randomUUID().slice(0, 8)}`
}
