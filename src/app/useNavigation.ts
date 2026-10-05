import { useEffect, useRef, useState, type RefObject } from 'react'
const currentUrl = () => window.location.pathname + window.location.search
export function useNavigation(locked: RefObject<boolean>) {
  const [url, setUrl] = useState(currentUrl)
  const index = useRef<number>(history.state?.orderHistoryIndex ?? 0)
  useEffect(() => {
    history.replaceState({ ...history.state, orderHistoryIndex: index.current }, '', currentUrl())
    const pop = (event: PopStateEvent) => {
      const next = event.state?.orderHistoryIndex ?? 0
      if (locked.current && next !== index.current) { history.go(index.current - next); return }
      index.current = next
      setUrl(currentUrl())
    }
    const unload = (event: BeforeUnloadEvent) => {
      if (locked.current) { event.preventDefault(); event.returnValue = '' }
    }
    window.addEventListener('popstate', pop)
    window.addEventListener('beforeunload', unload)
    return () => { window.removeEventListener('popstate', pop); window.removeEventListener('beforeunload', unload) }
  }, [locked])
  const navigate = (next: string, replace = false) => {
    if (locked.current || next === currentUrl()) return
    if (!replace) index.current += 1
    history[replace ? 'replaceState' : 'pushState']({ orderHistoryIndex: index.current }, '', next)
    setUrl(next)
  }
  const back = (fallback: string) => {
    if (locked.current) return
    if (index.current > 0) history.back()
    else navigate(fallback, true)
  }
  return { url, navigate, back }
}
export type Navigation = ReturnType<typeof useNavigation>
