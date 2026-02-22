"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { X, Minus, Maximize2, Minimize2 } from "lucide-react"

type WindowProps = {
  title: string
  icon?: React.ReactNode
  children: React.ReactNode
  onClose: () => void
  defaultWidth?: number
  defaultHeight?: number
  zIndex?: number
  onFocus?: () => void
}

export function Window({
  title,
  icon,
  children,
  onClose,
  defaultWidth = 900,
  defaultHeight = 580,
  zIndex = 100,
  onFocus,
}: WindowProps) {
  const [isMaximized, setIsMaximized] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [position, setPosition] = useState({ x: -1, y: -1 })
  const [size, setSize] = useState({ w: defaultWidth, h: defaultHeight })
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const dragOffset = useRef({ x: 0, y: 0 })
  const windowRef = useRef<HTMLDivElement>(null)
  const preMaxState = useRef({ x: 0, y: 0, w: 0, h: 0 })

  // Center on mount
  useEffect(() => {
    if (position.x === -1) {
      setPosition({
        x: Math.max(40, (window.innerWidth - size.w) / 2),
        y: Math.max(50, (window.innerHeight - size.h) / 2 - 20),
      })
    }
  }, [position.x, size.w, size.h])

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (isMaximized) return
      onFocus?.()
      setIsDragging(true)
      dragOffset.current = {
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      }
    },
    [isMaximized, position, onFocus]
  )

  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (isMaximized) return
      e.stopPropagation()
      onFocus?.()
      setIsResizing(true)
      dragOffset.current = {
        x: e.clientX,
        y: e.clientY,
      }
    },
    [isMaximized, onFocus]
  )

  useEffect(() => {
    if (!isDragging && !isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPosition({
          x: e.clientX - dragOffset.current.x,
          y: Math.max(0, e.clientY - dragOffset.current.y),
        })
      }
      if (isResizing) {
        const dx = e.clientX - dragOffset.current.x
        const dy = e.clientY - dragOffset.current.y
        setSize((prev) => ({
          w: Math.max(500, prev.w + dx),
          h: Math.max(350, prev.h + dy),
        }))
        dragOffset.current = { x: e.clientX, y: e.clientY }
      }
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      setIsResizing(false)
    }

    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mouseup", handleMouseUp)
    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
    }
  }, [isDragging, isResizing])

  function toggleMaximize() {
    if (isMaximized) {
      setPosition({ x: preMaxState.current.x, y: preMaxState.current.y })
      setSize({ w: preMaxState.current.w, h: preMaxState.current.h })
      setIsMaximized(false)
    } else {
      preMaxState.current = { x: position.x, y: position.y, w: size.w, h: size.h }
      setIsMaximized(true)
    }
  }

  if (isMinimized) return null

  return (
    <div
      ref={windowRef}
      className="absolute flex flex-col rounded-2xl overflow-hidden shadow-2xl shadow-black/50 border border-glass-border"
      style={
        isMaximized
          ? { inset: "44px 0 72px 0", zIndex, width: "auto", height: "auto" }
          : {
              left: position.x,
              top: position.y,
              width: size.w,
              height: size.h,
              zIndex,
            }
      }
      onMouseDown={() => onFocus?.()}
    >
      {/* Title bar */}
      <div
        className="flex items-center justify-between h-11 px-4 bg-[oklch(0.14_0.015_250/0.85)] backdrop-blur-2xl border-b border-glass-border select-none shrink-0"
        onMouseDown={handleMouseDown}
        style={{ cursor: isDragging ? "grabbing" : isMaximized ? "default" : "grab" }}
      >
        <div className="flex items-center gap-2.5">
          {/* Traffic lights */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={onClose}
              className="group size-3 rounded-full bg-[#ff5f57] hover:brightness-110 transition-all flex items-center justify-center cursor-pointer"
              aria-label="Close window"
            >
              <X className="size-2 text-[#4a0002] opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
            <button
              onClick={() => setIsMinimized(true)}
              className="group size-3 rounded-full bg-[#febc2e] hover:brightness-110 transition-all flex items-center justify-center cursor-pointer"
              aria-label="Minimize window"
            >
              <Minus className="size-2 text-[#5f4a00] opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
            <button
              onClick={toggleMaximize}
              className="group size-3 rounded-full bg-[#28c840] hover:brightness-110 transition-all flex items-center justify-center cursor-pointer"
              aria-label={isMaximized ? "Restore window" : "Maximize window"}
            >
              {isMaximized ? (
                <Minimize2 className="size-2 text-[#004a00] opacity-0 group-hover:opacity-100 transition-opacity" />
              ) : (
                <Maximize2 className="size-2 text-[#004a00] opacity-0 group-hover:opacity-100 transition-opacity" />
              )}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 absolute left-1/2 -translate-x-1/2">
          {icon}
          <span className="text-xs font-medium text-foreground">{title}</span>
        </div>

        <div className="w-16" />
      </div>

      {/* Window content */}
      <div className="flex-1 bg-[oklch(0.12_0.012_250/0.92)] backdrop-blur-2xl overflow-hidden">
        {children}
      </div>

      {/* Resize handle */}
      {!isMaximized && (
        <div
          className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize"
          onMouseDown={handleResizeMouseDown}
        />
      )}
    </div>
  )
}
