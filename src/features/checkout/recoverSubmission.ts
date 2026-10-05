import type { Order, SubmissionPayload } from '../../domain.ts'
type Service = { findSubmission: (key: string) => Promise<Order | null>; create: (payload: SubmissionPayload) => Promise<Order> }
export async function recoverSubmission(payload: SubmissionPayload, service: Service): Promise<Order> {
  // A failed lookup is not proof that the original order was never created.
  const existing = await service.findSubmission(payload.requestId)
  return existing ?? service.create(payload)
}
