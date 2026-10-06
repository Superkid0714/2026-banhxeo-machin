import type { AdminOrder, WaitPrediction, WaitTimeSnapshot } from '../src/domain.ts'

type TimingOrder = Pick<AdminOrder, 'id' | 'number' | 'quantity' | 'status' | 'createdAt' | 'pickupReady' | 'history'> & { waitQuote?: { minutes: number; at: string } }
type RecordTiming = { order: TimingOrder; start: number; end: number | null }
type Sample = { x: number[]; minutes: number; start: number; end: number }
type Model = { samples: Sample[]; coefficients: number[] | null; error: number; validationCount: number; mae: number | null; halfLife: number; baselineMae: number | null }
const minute = 60000
const dot = (a: number[], b: number[]) => a.reduce((sum, value, i) => sum + value * b[i], 0)
const median = (values: number[]) => { const sorted = [...values].sort((a,b) => a-b); return sorted[Math.floor(sorted.length / 2)] ?? 0 }

function timings(orders: TimingOrder[]): RecordTiming[] {
  return orders.filter(order => !['cancelled','expired'].includes(order.status)).map(order => {
    // Prefer preparation; legacy completion is a fallback. Ignore retries and archiving.
    const finished = order.history.find(event => event.label.startsWith('조리 완료') || event.label === '수령 완료')
    const end = finished ? Date.parse(finished.at) : null
    return { order, start: Date.parse(order.createdAt), end: end !== null && Number.isFinite(end) ? end : null }
  }).filter(record => Number.isFinite(record.start) && Number.isSafeInteger(record.order.quantity) && record.order.quantity > 0)
}

function samplesFrom(records: RecordTiming[]): Sample[] {
  return records.filter(record => record.end !== null && (record.end - record.start) / minute >= .25 && (record.end - record.start) / minute <= 120).sort((a,b) => a.end! - b.end! || a.order.number - b.order.number).slice(-80).flatMap(record => {
    const minutes = (record.end! - record.start) / minute
    // Immediate test clicks and abandoned orders do not represent kitchen processing.
    if (minutes < .25 || minutes > 120) return []
    const ahead = records.filter(other => other.order.id !== record.order.id && (other.start < record.start || (other.start === record.start && other.order.number < record.order.number)) && (other.end === null || other.end > record.start)).reduce((sum, other) => sum + other.order.quantity, 0)
    return [{ x: [1, ahead / 10, record.order.quantity], minutes, start: record.start, end: record.end! }]
  }).slice(-80)
}

function fit(samples: Sample[], halfLife = 120): number[] {
  const latest = samples.at(-1)!.end
  const weights = samples.map(sample => Math.max(.01, 2 ** (-(latest - sample.end) / (halfLife * minute))))
  const coefficients = [median(samples.map(sample => sample.minutes)), 0, 0]
  // Nonnegative, exponentially weighted ridge regression. More queued food cannot reduce the estimate.
  for (let iteration = 0; iteration < 100; iteration++) {
    for (let feature = 0; feature < 3; feature++) {
      let numerator = 0, denominator = feature === 0 ? .01 : .25
      samples.forEach((sample,i) => {
        const residual = sample.minutes - dot(coefficients,sample.x) + coefficients[feature] * sample.x[feature]
        numerator += weights[i] * sample.x[feature] * residual
        denominator += weights[i] * sample.x[feature] ** 2
      })
      coefficients[feature] = Math.max(0, numerator / denominator)
    }
  }
  return coefficients
}

function train(samples: Sample[]): Model {
  if (samples.length < 3) return { samples, coefficients: null, error: 0, validationCount: 0, mae: null, halfLife:120, baselineMae:null }
  const halfLife = 120
  const coefficients = fit(samples,halfLife), errors: number[] = [], baselineErrors:number[]=[]
  // Walk-forward evaluation: every prediction is fitted only on earlier completed orders.
  for (let i = Math.max(8, samples.length - 20); i < samples.length; i++) {
    const past = samples.slice(0,i).filter(sample => sample.end <= samples[i].start)
    if (past.length >= 8) {
      errors.push(Math.abs(dot(fit(past,halfLife),samples[i].x) - samples[i].minutes))
      const recent=past.slice(-10)
      baselineErrors.push(Math.abs(recent.reduce((sum,sample)=>sum+sample.minutes,0)/recent.length-samples[i].minutes))
    }
  }
  const trainingErrors = samples.map(sample => Math.abs(dot(coefficients,sample.x) - sample.minutes))
  const uncertainty = errors.length ? errors : trainingErrors
  const mae = errors.length ? errors.reduce((sum,value) => sum+value,0)/errors.length : null
  return { samples, coefficients, error: Math.max(2, median(uncertainty) * 1.5, (mae ?? 0)), validationCount: errors.length, mae, halfLife, baselineMae:baselineErrors.length?baselineErrors.reduce((sum,value)=>sum+value,0)/baselineErrors.length:null }
}

export class WaitTimeEstimator {
  private signature = ''
  private model: Model = train([])
  snapshot(history: TimingOrder[], active: TimingOrder[], now: number, nextQuantity = 1): WaitTimeSnapshot {
    const records = timings(history).filter(record => record.start <= now)
    const samples = samplesFrom(records).filter(sample => sample.end <= now)
    const signature = JSON.stringify(samples)
    if (signature !== this.signature) { this.model = train(samples); this.signature = signature }
    const model = this.model
    const queue = active.filter(order => ['paymentPending','accepted','cooking'].includes(order.status) && !order.pickupReady)
    const queueUnits = queue.reduce((sum,order) => sum+order.quantity,0)
    const last = samples.at(-1)?.end ?? null
    const stale = last === null || now - last > 120 * minute
    const prediction = (x: number[], start: number): WaitPrediction | null => {
      if (!model.coefficients) return null
      const duration = Math.max(1, dot(model.coefficients,x))
      const margin = Math.max(model.error, duration * (samples.length < 8 || stale ? .5 : .2))
      const elapsed = Math.max(0,(now-start)/minute)
      return { estimatedMinutes: Math.max(1,Math.ceil(duration-elapsed)), lowerMinutes: Math.max(0, Math.floor(duration-margin-elapsed)), upperMinutes: Math.max(1, Math.ceil(duration+margin-elapsed)), estimatedReadyAt: new Date(start+duration*minute).toISOString(), overdue: elapsed >= duration }
    }
    const orders: Record<string, WaitPrediction> = {}
    for (const order of queue) {
      const record = records.find(record => record.order.id === order.id)
      if (!record) continue
      const ahead = records.filter(other => other.order.id !== order.id && (other.start < record.start || (other.start === record.start && other.order.number < order.number)) && (other.end === null || other.end > record.start)).reduce((sum,other) => sum+other.order.quantity,0)
      const estimate = prediction([1,ahead/10,order.quantity],record.start)
      if (estimate) orders[order.id] = estimate
    }
    const liveErrors=records.filter(record=>record.end!==null&&record.end<=now&&record.order.waitQuote&&record.end-record.start>=.25*minute&&record.end-record.start<=120*minute).sort((a,b)=>a.end!-b.end!).slice(-20).map(record=>Math.abs((record.end!-record.start)/minute-record.order.waitQuote!.minutes))
    return { basis: 'orderCreated', status: samples.length < 3 ? 'insufficient' : samples.length < 8 || stale ? 'learning' : 'trained', sampleCount: samples.length, validationCount: model.validationCount, validationMaeMinutes: model.mae === null ? null : Math.round(model.mae*10)/10, baselineMaeMinutes:model.baselineMae===null?null:Math.round(model.baselineMae*10)/10, recencyHalfLifeMinutes:model.halfLife, liveValidationCount:liveErrors.length, liveMaeMinutes:liveErrors.length?Math.round(liveErrors.reduce((sum,error)=>sum+error,0)/liveErrors.length*10)/10:null, lastCompletedAt: last === null ? null : new Date(last).toISOString(), queueOrders: queue.length, queueUnits, newOrder: prediction([1,queueUnits/10,nextQuantity],now), orders }
  }
}
