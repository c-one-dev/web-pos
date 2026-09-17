import {
  addDays,
  isSameDay,
  setHours,
  setMinutes,
  startOfDay,
  subMinutes,
} from "date-fns"

// The shop trades past midnight, so its day doesn't end at 12AM. It ends once
// the 3:00AM minute is over: everything up to 3:00:59AM belongs to the day
// before, and the next business day starts at 3:01AM. A sale at 3:00AM on
// Sep 18 is Sep 17's takings; one at 3:01AM is Sep 18's. Every date filter,
// preset and report bucket goes through these helpers so that all pages agree
// on which day a sale belongs to.
export const BUSINESS_DAY_START_HOUR = 3
export const BUSINESS_DAY_START_MINUTE = 1
export const BUSINESS_DAY_START_MS =
  (BUSINESS_DAY_START_HOUR * 60 + BUSINESS_DAY_START_MINUTE) * 60 * 1000

// The business day a moment belongs to, returned as that day's calendar date.
export const businessDateOf = (date: Date) =>
  startOfDay(
    subMinutes(date, BUSINESS_DAY_START_HOUR * 60 + BUSINESS_DAY_START_MINUTE)
  )

// True for a moment between midnight and 3:00AM - rung up on one calendar day
// but counted toward the business day before it.
export const countsTowardPreviousDay = (date: Date) =>
  !isSameDay(businessDateOf(date), date)

// Use in place of startOfToday(): at 1AM on Sep 17 this is still Sep 16.
export const businessToday = () => businessDateOf(new Date())

// Lower bound of a query range - 3:01AM on the given calendar day.
export const startOfBusinessDay = (day: Date) =>
  setMinutes(
    setHours(startOfDay(day), BUSINESS_DAY_START_HOUR),
    BUSINESS_DAY_START_MINUTE
  )

// Upper bound of a query range - 3:00:59.999AM the following morning.
export const endOfBusinessDay = (day: Date) =>
  new Date(startOfBusinessDay(addDays(startOfDay(day), 1)).getTime() - 1)
