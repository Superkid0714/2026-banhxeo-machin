import assert from 'node:assert/strict'
import { test } from 'node:test'
import { analyzeOperationDays } from '../scripts/analyze-operation-days.mjs'

const record = (createdAt, minutes, quantity = 1) => ({ createdAt, completedAt: minutes === null ? null : new Date(Date.parse(createdAt) + minutes * 60000).toISOString(), quantity, total: quantity * 6000, resendRequests: 0 })

test('daily comparison uses Korea receipt date, nearest rank and all short completions', () => {
  const result = analyzeOperationDays({ schemaVersion: 1, records: [
    record('2026-10-06T14:50:00Z', 30, 2), record('2026-10-06T14:55:00Z', 10),
    record('2026-10-06T15:01:00Z', .1), record('2026-10-07T08:00:00Z', 9.9),
  ] }, '2026-10-06', '2026-10-07')
  assert.deepEqual(result.daily.map(day => day.orders), [2, 2])
  assert.equal(result.daily[0].allRecordedCompletions.meanMinutes, 20)
  assert.equal(result.daily[0].allRecordedCompletions.medianMinutes, 10)
  assert.equal(result.daily[0].allRecordedCompletions.p90Minutes, 30)
  assert.equal(result.comparison.meanReductionPercent, 75)
  assert.equal(result.daily[1].modelWindow15SecondsTo120Minutes.count, 1)
  assert.equal(result.comparison.modelWindowMeanReductionPercent, 50.5)
})

test('missing, reversed and out-of-period records are visible without inventing an improvement', () => {
  const result = analyzeOperationDays({ schemaVersion: 1, records: [
    record('2026-10-06T08:00:00Z', null), record('2026-10-06T09:00:00Z', -1),
    record('2026-10-08T08:00:00Z', 20),
  ] }, '2026-10-06', '2026-10-07')
  assert.equal(result.daily[0].missingCompletion, 1)
  assert.equal(result.daily[0].negativeDurations, 1)
  assert.equal(result.outsideComparedDates, 1)
  assert.equal(result.comparison.meanReductionPercent, null)
})

test('minimal schema rejects private extra fields, invalid dates and ambiguous timestamps', () => {
  const run = records => analyzeOperationDays({ schemaVersion: 1, records }, '2026-10-06', '2026-10-07')
  assert.throws(() => run([{ ...record('2026-10-06T08:00:00Z', 20), phone: 'private' }]), /unsupported fields/)
  assert.throws(() => run([{ ...record('2026-10-06T08:00:00Z', 20), createdAt: '2026-10-06T08:00:00' }]), /Invalid record/)
  assert.throws(() => analyzeOperationDays({ schemaVersion: 1, records: [] }, '2026-02-30', '2026-10-07'), /valid dates/)
})
