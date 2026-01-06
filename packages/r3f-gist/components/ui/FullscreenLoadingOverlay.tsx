import { type CSSProperties, type ReactNode, useEffect, useRef } from 'react';

interface FullscreenLoadingOverlayProps {
  isLoaded: boolean;
  progress?: number;
  label?: string;
  background?: string;
  fontSize?: number | string;
  fadeDurationMs?: number;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

export default function FullscreenLoadingOverlay({
  isLoaded,
  progress,
  label = 'Loading…',
  background = '#171717',
  fontSize = 20,
  fadeDurationMs = 800,
  className,
  style,
  children
}: FullscreenLoadingOverlayProps) {
  const hasCompletedRef = useRef(false);

  useEffect(() => {
    if (isLoaded) {
      hasCompletedRef.current = true;
    }
  }, [isLoaded]);

  const resolvedOpacity = hasCompletedRef.current ? 0 : 1;
  const resolvedPointerEvents = hasCompletedRef.current ? 'none' : 'auto';

  const overlayStyle: CSSProperties = {
    position: 'fixed',
    inset: 0,
    display: 'grid',
    placeItems: 'center',
    background,
    fontSize,
    opacity: resolvedOpacity,
    transition: `opacity ${fadeDurationMs}ms ease`,
    pointerEvents: resolvedPointerEvents,
    ...style
  };

  const defaultContent =
    typeof progress === 'number'
      ? `${label} ${Math.round(progress)}%`
      : label;

  return (
    <div className={className} style={overlayStyle}>
      {children ?? defaultContent}
    </div>
  );
}


