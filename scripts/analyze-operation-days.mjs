import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const minute = 60000
const isoTime = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value))
const round = value => value === null ? null : Math.round(value * 10000) / 10000
const dayOf = at => new Date(Date.parse(at) + 9 * 60 * minute).toISOString().slice(0, 10)
const allowed = ['createdAt', 'completedAt', 'quantity', 'total', 'resendRequests']

function statistics(values) {
  const sorted = [...values].sort((a, b) => a - b)
  const percentile = fraction => sorted.length ? sorted[Math.ceil(sorted.length * fraction) - 1] : null
  return {
    count: sorted.length,
    meanMinutes: sorted.length ? sorted.reduce((sum, value) => sum + value, 0) / sorted.length : null,
    medianMinutes: percentile(.5),
    p90Minutes: percentile(.9),
    over15Minutes: sorted.filter(value => value > 15).length,
    over15Percent: sorted.length ? sorted.filter(value => value > 15).length / sorted.length * 100 : null,
    over30Minutes: sorted.filter(value => value > 30).length,
    over30Percent: sorted.length ? sorted.filter(value => value > 30).length / sorted.length * 100 : null,
  }
}

// Input deliberately excludes order IDs, phones, history actors and credentials.
export function analyzeOperationDays(input, firstDay, secondDay) {
  if (input?.schemaVersion !== 1 || !Array.isArray(input.records)) throw new Error('Expected schemaVersion 1 and records array')
  if (![firstDay, secondDay].every(day => typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day) && isoTime(`${day}T00:00:00Z`) && new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) === day) || firstDay >= secondDay) throw new Error('Provide two valid dates in ascending order')
  for (const record of input.records) {
    if (!record || typeof record !== 'object' || Array.isArray(record) || Object.keys(record).some(key => !allowed.includes(key))) throw new Error('Record contains unsupported fields; export only the documented minimal schema')
    if (!isoTime(record.createdAt) || !(record.completedAt === null || isoTime(record.completedAt)) || !Number.isSafeInteger(record.quantity) || record.quantity < 1 || !Number.isSafeInteger(record.total) || record.total < 0 || !Number.isSafeInteger(record.resendRequests) || record.resendRequests < 0) throw new Error('Invalid record in minimal input')
  }
  const rawDaily = [firstDay, secondDay].map(day => {
    const records = input.records.filter(record => dayOf(record.createdAt) === day)
    const times = records.filter(record => record.completedAt !== null).map(record => (Date.parse(record.completedAt) - Date.parse(record.createdAt)) / minute)
    const nonnegative = times.filter(value => value >= 0)
    const modelWindow = nonnegative.filter(value => value >= .25 && value <= 120)
    const singleItemTimes = records.filter(record => record.quantity === 1 && record.completedAt !== null).map(record => (Date.parse(record.completedAt) - Date.parse(record.createdAt)) / minute).filter(value => value >= 0)
    return {
      day, orders: records.length,
      units: records.reduce((sum, record) => sum + record.quantity, 0),
      amount: records.reduce((sum, record) => sum + record.total, 0),
      resendRequests: records.reduce((sum, record) => sum + record.resendRequests, 0),
      missingCompletion: records.length - times.length,
      negativeDurations: times.length - nonnegative.length,
      allRecordedCompletions: statistics(nonnegative),
      modelWindow15SecondsTo120Minutes: statistics(modelWindow),
      singleItemRecordedCompletions: statistics(singleItemTimes),
    }
  })
  const reduction = (before, after) => before === null || after === null || before <= 0 ? null : (before - after) / before * 100
  const before = rawDaily[0], after = rawDaily[1]
  const difference = (first, second) => first === null || second === null ? null : first - second
  const comparison = {
    meanDecreaseMinutes: difference(before.allRecordedCompletions.meanMinutes, after.allRecordedCompletions.meanMinutes),
    meanReductionPercent: reduction(before.allRecordedCompletions.meanMinutes, after.allRecordedCompletions.meanMinutes),
    medianReductionPercent: reduction(before.allRecordedCompletions.medianMinutes, after.allRecordedCompletions.medianMinutes),
    p90ReductionPercent: reduction(before.allRecordedCompletions.p90Minutes, after.allRecordedCompletions.p90Minutes),
    modelWindowMeanReductionPercent: reduction(before.modelWindow15SecondsTo120Minutes.meanMinutes, after.modelWindow15SecondsTo120Minutes.meanMinutes),
    orderReductionPercent: reduction(before.orders, after.orders),
    unitReductionPercent: reduction(before.units, after.units),
    over15RateDecreasePercentagePoints: difference(before.allRecordedCompletions.over15Percent, after.allRecordedCompletions.over15Percent),
    over30RateDecreasePercentagePoints: difference(before.allRecordedCompletions.over30Percent, after.allRecordedCompletions.over30Percent),
    singleItemMeanReductionPercent: reduction(before.singleItemRecordedCompletions.meanMinutes, after.singleItemRecordedCompletions.meanMinutes),
  }
  // Round only at output so percentages use unrounded means.
  return JSON.parse(JSON.stringify({ timeZone: 'Asia/Seoul', percentileMethod: 'nearest-rank', inputRecords: input.records.length, outsideComparedDates: input.records.length - before.orders - after.orders, daily: rawDaily, comparison }, (_key, value) => typeof value === 'number' ? round(value) : value))
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [file, firstDay, secondDay] = process.argv.slice(2)
    if (!file) throw new Error('Usage: node scripts/analyze-operation-days.mjs <minimal-input.json> <first-day> <second-day>')
    console.log(JSON.stringify(analyzeOperationDays(JSON.parse(readFileSync(file, 'utf8')), firstDay, secondDay), null, 2))
  } catch (error) {
    // Do not echo input records, paths or malformed data in public logs.
    console.error(error instanceof SyntaxError ? 'Invalid JSON input' : error.code ? 'Unable to read input file' : error.message)
    process.exitCode = 1
  }
}
