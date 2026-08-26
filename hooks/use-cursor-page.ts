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
  const [page, setPage] = useState<{
    current: number
    loaded: number
    max: number
  }>({ current: 1, loaded: 1, max: 1 })

  const { total, nodes, endCursor } = useMemo(() => {
    const connection = data?.[field]
    // eslint-disable-next-line react-hooks/set-state-in-render
    setPage((prev) => ({ ...prev, max: connection?.pages || 1 }))
    return {
      total: connection?.total || 0,
      nodes: connection?.edges?.map((edge: any) => edge.node) || [],
      endCursor: connection?.pageInfo?.endCursor || null,
    }
  }, [data, field])

  const reset = useCallback(
    () => setPage({ current: 1, loaded: 1, max: 1 }),
    []
  )

  const onNext = async () => {
    // Only hit the server for a page not yet loaded; anything already in the
    // cache is just a slice offset.
    if (page.current === page.loaded) {
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
    if (page.current === 1) return
    setPage((prev) => ({ ...prev, current: prev.current - 1 }))
  }

  return { page, total, nodes, endCursor, reset, onNext, onPrev }
}
