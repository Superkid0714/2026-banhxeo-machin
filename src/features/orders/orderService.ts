import type { Availability, Order, SubmissionPayload } from '../../domain'
async function read<T>(response: Response): Promise<T> {
  if (!response.ok) throw new OrderApiError(response.status, (await response.json()).error)
  return response.json() as Promise<T>
}
export class OrderApiError extends Error {
  constructor(public status: number, public code: string) { super(code) }
}
const request = (url: string, options?: RequestInit) => fetch(url, { ...options, signal: AbortSignal.timeout(10000) })
export const orderService = {
  availability: () => fetch('/api/availability').then(read<{ availability: Availability }>),
  create: (payload: SubmissionPayload) => request('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then(read<Order>),
  findSubmission: async (key: string): Promise<Order | null> => {
    const response = await request(`/api/submissions/${encodeURIComponent(key)}`)
    if (response.status === 404) return null
    return read<Order>(response)
  },
  get: (id: string) => request(`/api/orders/${encodeURIComponent(id)}`).then(read<Order>),
}
