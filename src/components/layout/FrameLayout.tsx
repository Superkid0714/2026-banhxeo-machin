import { useLayoutEffect, useState, type PropsWithChildren } from 'react'
export function FrameLayout({ frame, children }: PropsWithChildren<{ frame: string }>) {
  const [viewport, setViewport] = useState({ width: innerWidth, height: innerHeight })
  useLayoutEffect(() => {
    const resize = () => setViewport({ width: innerWidth, height: innerHeight })
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])
  const scale = Math.min(1, viewport.width / 1280)
  return <div data-figma-frame={frame} className="flex flex-col bg-white font-sans leading-[1.25] text-ink" style={{ zoom: scale, width: viewport.width / scale, minHeight: Math.max(800, viewport.height / scale) }}>{children}</div>
}
