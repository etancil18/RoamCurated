import { RRule, Weekday, Frequency, Options as RRuleOptions } from 'rrule'

export type RecurrenceFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'

export interface RecurrenceRuleOptions {
  freq: RecurrenceFrequency
  interval?: number
  byweekday?: Weekday[] | number[]
  bymonthday?: number[]
  dtstart?: Date
  until?: Date
  count?: number
}

/**
 * Converts a RecurrenceRuleOptions object into an RRule string.
 */
export function generateRRule({
  freq,
  interval = 1,
  byweekday,
  bymonthday,
  dtstart,
  until,
  count,
}: RecurrenceRuleOptions): string {
  const options: Partial<RRuleOptions> = {
    freq: RRule[freq as keyof typeof RRule] as Frequency,
    interval,
    dtstart,
    until,
    count,
  }

  // Explicit weekday map (avoids invalid RRule.weekdays usage)
  const weekdays: Weekday[] = [
    RRule.MO,
    RRule.TU,
    RRule.WE,
    RRule.TH,
    RRule.FR,
    RRule.SA,
    RRule.SU,
  ]

  if (byweekday) {
    options.byweekday = byweekday.map((day) =>
      typeof day === 'number' ? weekdays[day] : day
    )
  }

  if (bymonthday) {
    options.bymonthday = bymonthday
  }

  return new RRule(options).toString()
}

/**
 * Parses an RRule string into a human-readable description.
 */
export function describeRRule(ruleString: string): string {
  try {
    return RRule.fromString(ruleString).toText()
  } catch (err) {
    console.error('Invalid RRule string:', ruleString, err)
    return 'Invalid recurrence'
  }
}

/**
 * Expands an RRule string into actual Date occurrences.
 */
export function expandRecurrence(
  ruleString: string,
  rangeStart: Date,
  rangeEnd: Date
): Date[] {
  try {
    return RRule.fromString(ruleString).between(rangeStart, rangeEnd, true)
  } catch (err) {
    console.error('Failed to expand recurrence:', err)
    return []
  }
}
