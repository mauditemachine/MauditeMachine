import React, { useEffect, useRef, useState } from 'react'

type DraggableWindowProps = {
  children: React.ReactNode
  className?: string
  initialX?: number
  initialY?: number
}

export default function DraggableWindow({ children, className = '', initialX, initialY }: DraggableWindowProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const handleRef = useRef<HTMLDivElement | null>(null)
  const bleedHandleRef = useRef<HTMLDivElement | null>(null)
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: initialX ?? 24, y: initialY ?? 200 })
  const [dragging, setDragging] = useState(false)
  const dragInfo = useRef<{ startX: number; startY: number; origX: number; origY: number; width: number; height: number } | null>(null)
  const [isDesktop, setIsDesktop] = useState<boolean>(() => (typeof window !== 'undefined' ? window.innerWidth >= 901 : true))
  const PADDING = 24

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 901px)')
    function onChange(e: MediaQueryListEvent) { setIsDesktop(e.matches) }
    setIsDesktop(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  // After mount, if no initial provided, place near bottom-left without overflowing
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    if (initialX == null || initialY == null) {
      const vw = window.innerWidth
      const vh = window.innerHeight
      const x = PADDING // bottom-left, avec marge
      const y = Math.max(PADDING, vh - rect.height - PADDING)
      setPosition({ x, y })
    } else {
      const vw = window.innerWidth
      const vh = window.innerHeight
      const x = Math.min(Math.max(PADDING, initialX), vw - rect.width - PADDING)
      const y = Math.min(Math.max(PADDING, initialY), vh - rect.height - PADDING)
      setPosition({ x, y })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep inside bounds on resize
  useEffect(() => {
    function onResize() {
      const el = containerRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const vw = window.innerWidth
      const vh = window.innerHeight
      setPosition(pos => ({
        x: Math.min(Math.max(PADDING, pos.x), Math.max(PADDING, vw - rect.width - PADDING)),
        y: Math.min(Math.max(PADDING, pos.y), Math.max(PADDING, vh - rect.height - PADDING))
      }))
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Recalage quand la taille de la fenêtre change (ex: player charge, liste grandit)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect()
      const vw = window.innerWidth
      const vh = window.innerHeight
      setPosition(pos => ({
        x: Math.min(Math.max(PADDING, pos.x), Math.max(PADDING, vw - rect.width - PADDING)),
        y: Math.min(Math.max(PADDING, pos.y), Math.max(PADDING, vh - rect.height - PADDING))
      }))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const el = containerRef.current
    const handle = handleRef.current
    const bleed = bleedHandleRef.current
    if (!el || !handle) return
    const pad = 8

    function clamp(nx: number, ny: number, w: number, h: number) {
      const vw = window.innerWidth
      const vh = window.innerHeight
      const minX = pad
      const minY = pad
      const maxX = Math.max(pad, vw - w - pad)
      const maxY = Math.max(pad, vh - h - pad)
      return { x: Math.min(Math.max(nx, minX), maxX), y: Math.min(Math.max(ny, minY), maxY) }
    }

    function onPointerDown(e: PointerEvent) {
      // drag uniquement depuis le handle
      const rect = el.getBoundingClientRect()
      dragInfo.current = {
        startX: e.clientX,
        startY: e.clientY,
        origX: position.x,
        origY: position.y,
        width: rect.width,
        height: rect.height
      }
      handle.setPointerCapture(e.pointerId)
      e.preventDefault()
    }

    function onPointerMove(e: PointerEvent) {
      if (!dragInfo.current) return
      const info = dragInfo.current
      const dx = e.clientX - info.startX
      const dy = e.clientY - info.startY
      const movedEnough = Math.abs(dx) + Math.abs(dy) > 2
      if (movedEnough) setDragging(true)
      if (!dragging && !movedEnough) return
      const next = clamp(info.origX + dx, info.origY + dy, info.width, info.height)
      setPosition(next)
    }

    function onPointerUp(e: PointerEvent) {
      if (handle.hasPointerCapture(e.pointerId)) handle.releasePointerCapture(e.pointerId)
      dragInfo.current = null
      setTimeout(() => setDragging(false), 0)
    }

    handle.addEventListener('pointerdown', onPointerDown)
    if (bleed) bleed.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    return () => {
      handle.removeEventListener('pointerdown', onPointerDown)
      if (bleed) bleed.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
  }, [position.x, position.y, dragging])

  if (!isDesktop) {
    // Mobile/tablette: contenu normal, pas de fenêtre flottante
    return <>{children as React.ReactNode}</>
  }

  return (
    <div
      ref={containerRef}
      className={`draggable-window ${className}`}
      style={{ position: 'fixed', left: 0, top: 0, transform: `translate3d(${position.x}px, ${position.y}px, 0)` }}
    >
      <div ref={handleRef} className="drag-handle" style={{ touchAction: 'none', cursor: dragging ? 'grabbing' : 'grab' }}>
        <span className="drag-hint">Drag Me !</span>
      </div>
      <div className="drag-content">
        <div ref={bleedHandleRef} className="drag-handle-bleed" aria-hidden="true" />
        {children}
      </div>
    </div>
  )
}


