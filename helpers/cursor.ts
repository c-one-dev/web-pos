type CursorPayload = {
  type: string
  value: any
  id: string
}

/**
 * Dates travel as a tagged object rather than as plain ISO text.
 *
 * They used to go out as text and be guessed back with Date.parse, which
 * accepts far more than ISO text: "FPR-00006" parses happily as 1 June 2001,
 * and so does "A/M-00001". A receipt number at a page boundary therefore came
 * back as a Date, the keyset clause compared a text column against it, and
 * BSON orders every string below every date - so the page came back empty and
 * paging stopped dead. Which receipt numbers do this is pure chance, which is
 * why it only struck some pages of some tables.
 */
const DATE_TAG = "$date"

// Encode cursor
export const toCursor = (payload: CursorPayload) =>
  Buffer.from(
    JSON.stringify(payload, function (this: any, key: string, value: any) {
      // Read the holder, not `value`: by the time the replacer is called a
      // Date has already been through toJSON and is a string.
      const raw = this[key]
      return raw instanceof Date ? { [DATE_TAG]: raw.toISOString() } : value
    }),
    "utf8"
  ).toString("base64")

// Decode cursor
export const fromCursor = (cursor: string): CursorPayload => {
  try {
    return JSON.parse(
      Buffer.from(cursor, "base64").toString("utf8"),
      (_key: string, value: any) =>
        value &&
        typeof value === "object" &&
        typeof value[DATE_TAG] === "string"
          ? new Date(value[DATE_TAG])
          : value
    )
  } catch {
    throw new Error("Invalid cursor format")
  }
}
