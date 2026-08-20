// Guard for `refetchQueries: ["SomeQuery"]`.
//
// Refetching by name hits EVERY active query with that name, including ones
// that are mounted but parked on empty variables. DataTable always mounts its
// `rowView` with `_id: null` until a row is actually clicked, so a page with a
// row-view drawer always has a parked `Sale` query sitting there. Refetching
// that one sends `_id: null` and the server rejects it with
// `Variable "$_id" of non-null type "ID!" must not be null` - which surfaces
// as a red toast on an operation that otherwise succeeded.
//
// Pass this as `onQueryUpdated` alongside `refetchQueries` to refetch the
// queries that are genuinely in use and skip the parked ones.
export const refetchOnlyReadyQueries = (observableQuery: any) => {
  const variables = observableQuery?.variables ?? {}
  const isParked = Object.values(variables).some(
    (value) => value === null || value === undefined || value === ""
  )
  return isParked ? false : observableQuery.refetch()
}
