import { useEffect, useRef, useState } from 'react';
import { useProgress } from '@react-three/drei';

/**
 * Track how many unique asset items have been reported as loaded by drei's `useProgress`.
 * Returns the current count together with a boolean indicating if the provided total has been reached.
 */
export function useLoadedFileCount(total: number) {
  const { item } = useProgress();
  const seenItemsRef = useRef<Set<string>>(new Set());
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!item) return;
    if (!seenItemsRef.current.has(item)) {
      seenItemsRef.current.add(item);
      setCount(seenItemsRef.current.size);
    }
  }, [item]);

  return { count, loaded: count === total };
}


