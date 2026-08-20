// Guard for `refetchQueries: ["SomeQuery"]`.
//
// Refetching by name hits EVERY active query with that name, including ones
// that are mounted but parked without usable variables. Two shapes of that
// show up in this app:
//
//   - DataTable always mounts its `rowView` with `_id: null` until a row is
//     clicked, so any page with a row-view drawer has a parked `Sale` query.
//     Refetching it sends `_id: null` →
//     `Variable "$_id" of non-null type "ID!" must not be null`.
//   - A query skipped because its id prop is undefined has no variables at
//     all, since Apollo drops undefined ones. Refetching it sends nothing →
//     `Variable "$customer" of required type "ID!" was not provided`.
//
// Both surface as a red toast on an operation that otherwise succeeded. Pass
// this as `onQueryUpdated` alongside `refetchQueries` to refetch the queries
// that are genuinely in use and skip the parked ones.
export const refetchOnlyReadyQueries = (observableQuery: any) => {
  const variables = observableQuery?.variables ?? {}

  const isMissing = (value: unknown) =>
    value === null || value === undefined || value === ""

  // Every required (non-null) variable the operation declares has to have a
  // real value, which also catches the case where the variables object is
  // empty because Apollo dropped the undefined ones.
  const declared = (observableQuery?.query?.definitions ?? []).flatMap(
    (definition: any) => definition.variableDefinitions ?? []
  )
  for (const definition of declared) {
    const name = definition?.variable?.name?.value
    const isRequired = definition?.type?.kind === "NonNullType"
    if (isRequired && isMissing(variables[name])) return false
  }

  // A nullable variable explicitly set to null is still a parked query in
  // practice - nothing useful comes back for it.
  if (Object.values(variables).some(isMissing)) return false

  return observableQuery.refetch()
}
