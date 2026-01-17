import { useEffect } from 'react'

interface DebugModeToggleProps {
  onToggle: () => void
}

/**
 * Simple component to toggle debug mode with keyboard
 */
export function DebugModeToggle({ onToggle }: DebugModeToggleProps) {
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === 'v' || event.key === 'V') {
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
