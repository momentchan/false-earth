import { useEffect } from 'react'

interface DebugModeToggleProps {
  onToggle: () => void
}

/**
 * Simple component to toggle debug mode with keyboard
 * Press 'D' key to toggle culling debug mode
 */
export function DebugModeToggle({ onToggle }: DebugModeToggleProps) {
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === 'd' || event.key === 'D') {
        onToggle()
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => {
      window.removeEventListener('keydown', handleKeyPress)
    }
  }, [onToggle])

  return null
}
