import type { AdminSnapshot } from '../../domain'
export class AdminError extends Error { constructor(public status: number, public code: string) { super(code) } }
async function request<T>(path: string, body?: object): Promise<T> {
  const response = await fetch(`/api/admin/${path}`, { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(15000), ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) })
  const data = await response.json()
  if (!response.ok) throw new AdminError(response.status,data.error)
  return data
}
export const adminService = {
  session: () => request<{username:string}>('session'),
  login: (username:string,password:string) => request('login',{username,password}),
  logout: () => request('logout',{}),
  snapshot: () => request<AdminSnapshot>('orders'),
  action: (id:string,action:string,version:number) => request(`orders/${id}/actions`,{action,version}),
  deleteHistory: (id:string,version:number,confirmationNumber:number) => request(`orders/${id}/delete-history`,{version,confirmationNumber}),
  settings: (input:object) => request('settings',input),
}
