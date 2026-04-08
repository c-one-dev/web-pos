type CursorPayload = {
  type: string
  value: any
  id: string
}

// Encode cursor
export const toCursor = (payload: CursorPayload) =>
  Buffer.from(JSON.stringify(payload), "utf8").toString("base64")

// Decode cursor
export const fromCursor = (cursor: string): CursorPayload => {
  try {
    return JSON.parse(Buffer.from(cursor, "base64").toString("utf8"))
  } catch {
    throw new Error("Invalid cursor format")
  }
}
