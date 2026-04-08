export const flatten = (
  obj: Record<string, any>,
  prefix = "",
  res: Record<string, any> = {},
) => {
  Object.entries(obj).forEach(([key, val]) => {
    if (val === undefined) return

    const path = prefix ? `${prefix}.${key}` : key

    // flatten only plain objects
    if (val && typeof val === "object" && !Array.isArray(val)) {
      flatten(val, path, res)
    } else {
      // primitives + arrays go directly
      res[path] = val
    }
  })

  return res
}
