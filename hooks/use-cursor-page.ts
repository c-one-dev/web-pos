"use client"
import { useCallback, useMemo, useState } from "react"

/**
 * Prev/Next pagination over a cursor connection, matching what the DB-backed
 * tables (customer, sale-history, product, ...) already do: each page is
 * fetched on demand and appended to the Apollo cache, so stepping back never
 * refetches a page already loaded.
 *
 * `field` is the connection's field name on the query result, e.g.
 * "customerTable" or "closureTransactions".
 *
 * Returns the accumulated `nodes` for every page loaded so far - slice it by
 * `page.current` to render just the current one.
 */
export function useCursorPage(
  field: string,
  data: any,
  fetchMore: any,
  rows: number,
  baseVars: Record<string, any>
) {
  // Only what cannot be derived is stored. `max` used to be state, written
  // from inside the memo below - which meant reset() could clobber it to 1
  // and nothing would put it back: the memo only re-runs when `data` changes,
  // and with cache-and-network the data is often already there on the first
  // render, so the mount effect's reset landed last. The page count then read
  // "1 of 1" over 28 results until something changed the page size.
  const [page, setPage] = useState<{ current: number; loaded: number }>({
    current: 1,
    loaded: 1,
  })

  const { total, nodes, endCursor } = useMemo(() => {
    const connection = data?.[field]
    return {
      total: connection?.total || 0,
      nodes: connection?.edges?.map((edge: any) => edge.node) || [],
      endCursor: connection?.pageInfo?.endCursor || null,
    }
  }, [data, field])

  const max = Math.max(1, Math.ceil(total / rows))
  // A page that no longer exists - the last page after the rows-per-page went
  // up, say - falls back to the last one there is.
  const current = Math.min(page.current, max)

  const reset = useCallback(() => setPage({ current: 1, loaded: 1 }), [])

  const onNext = async () => {
    if (current >= max) return
    // Only hit the server for a page not yet loaded; anything already in the
    // cache is just a slice offset.
    if (current === page.loaded) {
      await fetchMore({
        variables: { ...baseVars, first: rows, after: endCursor },
        updateQuery: (prev: any, { fetchMoreResult: more }: any) => {
          if (!more) return prev
          const seen = new Set<string>()
          const edges = [...prev[field].edges, ...more[field].edges].filter(
            (edge: any) => {
              if (seen.has(edge.cursor)) return false
              seen.add(edge.cursor)
              return true
            }
          )
          return {
            ...prev,
            [field]: { ...more[field], edges, pageInfo: more[field].pageInfo },
          }
        },
      })
      setPage((prev) => ({ ...prev, loaded: prev.loaded + 1 }))
    }
    setPage((prev) => ({ ...prev, current: prev.current + 1 }))
  }

  const onPrev = () => {
    if (current === 1) return
    setPage((prev) => ({ ...prev, current: Math.max(1, prev.current - 1) }))
  }

  return {
    page: { current, max, loaded: page.loaded },
    total,
    nodes,
    endCursor,
    reset,
    onNext,
    onPrev,
  }
}
