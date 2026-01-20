/**
 * Suppress harmless warnings from three-custom-shader-material (CSM)
 * These warnings occur when CSM handles method name conflicts internally
 * and are informational only - they don't indicate actual problems
 */

// Track if warnings have already been suppressed to avoid multiple overrides
let warningsSuppressed = false

/**
 * Suppress CSM-specific warnings
 * Called when VAT materials module is loaded
 */
export function suppressCSMWarnings() {
  if (warningsSuppressed) return
  warningsSuppressed = true
  
  // Store original console methods
  const originalWarn = console.warn
  const originalError = console.error

  // List of warning messages to suppress
  const suppressedWarnings = [
    'Function copy already exists on CSM',
    'THREE.ImageUtils.getDataURL: Image converted to jpg',
  ]

  // Override console.warn to filter out harmless warnings
  console.warn = function (...args: any[]) {
    // Check all arguments for suppressed warning patterns
    const messageString = args
      .map((arg) => (typeof arg === 'string' ? arg : String(arg)))
      .join(' ')
    
    const shouldSuppress = suppressedWarnings.some((suppressed) =>
      messageString.includes(suppressed)
    )
    
    if (shouldSuppress) {
      return // Suppress this warning
    }
    
    // Otherwise, call the original warn
    originalWarn.apply(console, args)
  }

  // Override console.error for the same warnings (sometimes they appear as errors)
  console.error = function (...args: any[]) {
    // Check all arguments for suppressed warning patterns
    const messageString = args
      .map((arg) => (typeof arg === 'string' ? arg : String(arg)))
      .join(' ')
    
    const shouldSuppress = suppressedWarnings.some((suppressed) =>
      messageString.includes(suppressed)
    )
    
    if (shouldSuppress) {
      return // Suppress this error
    }
    
    // Otherwise, call the original error
    originalError.apply(console, args)
  }
}


