"use client"
import { useCallback, useMemo, useState } from "react"
import { useQuery } from "@apollo/client/react"
import type { DocumentNode } from "graphql"

type TrailState = {
  // Serialized query variables (minus `after`). When these change - new search,
  // filter, sort or page size - every cursor already collected points into a
  // differently ordered list, so the trail is thrown away.
  key: string
  // cursors[i] is the `after` cursor that starts page i + 1. Page 1 always
  // starts at null.
  cursors: (string | null)[]
  current: number
}

const freshTrail = (key: string): TrailState => ({
  key,
  cursors: [null],
  current: 1,
})

/**
 * Prev/Next pagination over a cursor connection where each page is its own
 * request.
 *
 * Unlike `useCursorPage`, nothing is accumulated in the Apollo cache: the query
 * runs with the `after` cursor for the page being viewed and renders exactly
 * what comes back. That keeps `total` / `pages` in step with the server on
 * every page change, so a row created (or deleted) elsewhere is reflected in
 * the page count without a browser refresh, and stepping back and forth can
 * never render a stale or duplicated slice.
 *
 * `field` is the connection's field name on the query result, e.g.
 * "productTypeTable".
 */
export function useTablePage<TNode = unknown>(
  query: DocumentNode,
  field: string,
  vars: Record<string, unknown> & { first: number }
) {
  const key = JSON.stringify(vars)
  const [trail, setTrail] = useState<TrailState>(() => freshTrail(key))

  // Derived rather than reset in an effect: a stale `current` must never reach
  // the query, or changing the search would fire one request for the old
  // page's cursor before snapping back to page 1.
  const state = useMemo(
    () => (trail.key === key ? trail : freshTrail(key)),
    [trail, key]
  )

  const after = state.cursors[state.current - 1] ?? null

  const { data, previousData, loading, refetch } = useQuery(query, {
    variables: { ...vars, after },
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  })

  const { total, max, nodes, endCursor } = useMemo(() => {
    // Hold the previous page's rows while the next one is in flight instead of
    // flashing an empty table.
    const result = (data ?? previousData) as Record<string, any> | undefined
    const connection = result?.[field]
    return {
      total: (connection?.total as number) || 0,
      max: Math.max((connection?.pages as number) || 1, 1),
      nodes: (connection?.edges?.map((edge: any) => edge.node) ||
        []) as TNode[],
      endCursor: (connection?.pageInfo?.endCursor as string | null) || null,
    }
  }, [data, previousData, field])

  // Rows removed elsewhere can leave the viewer past the last page. Clamping
  // here (instead of writing state back) makes the next render request page 1
  // on its own, so the table is never stuck blank with Next disabled.
  const current = Math.min(state.current, max)

  const reset = useCallback(
    () => setTrail((prev) => freshTrail(prev.key)),
    []
  )

  const onNext = useCallback(() => {
    if (current >= max || !endCursor) return
    setTrail((prev) => {
      const base = prev.key === key ? prev : freshTrail(key)
      const cursors = [...base.cursors]
      // The cursor that starts the page being moved to.
      cursors[current] = endCursor
      return { key, cursors, current: current + 1 }
    })
  }, [current, max, endCursor, key])

  const onPrev = useCallback(() => {
    if (current === 1) return
    setTrail((prev) => {
      const base = prev.key === key ? prev : freshTrail(key)
      return { ...base, key, current: current - 1 }
    })
  }, [current, key])

  // `from`/`to` describe the rows actually on screen, so a short last page
  // reads correctly and an empty result reads "0-0".
  const from = nodes.length ? (current - 1) * vars.first + 1 : 0
  const to = nodes.length ? from + nodes.length - 1 : 0

  return {
    page: { current, max },
    total,
    from,
    to,
    nodes,
    loading,
    refetch,
    reset,
    onNext,
    onPrev,
  }
}
