import { useRef, useCallback } from "react";

export function useKeystroke() {
  const eventsRef = useRef([]);
  const startRef = useRef(null);
  const keyCountRef = useRef(0);
  const epochOffsetRef = useRef(Date.now() - performance.now());

  const onKeyDown = useCallback((e) => {
    if (["Shift", "Control", "Alt", "Meta", "CapsLock"].includes(e.key)) return;

    const now = performance.now() + epochOffsetRef.current;

    if (!startRef.current) startRef.current = now;

    eventsRef.current.push({
      key: e.key === " " ? "Space" : e.key,
      direction: "D",
      timestamp_ms: now,
    });
    keyCountRef.current++;
  }, []);

  const onKeyUp = useCallback((e) => {
    if (["Shift", "Control", "Alt", "Meta", "CapsLock"].includes(e.key)) return;

    eventsRef.current.push({
      key: e.key === " " ? "Space" : e.key,
      direction: "U",
      timestamp_ms: performance.now() + epochOffsetRef.current,
    });
  }, []);

  const getEvents = useCallback(() => [...eventsRef.current], []);
  const getKeyCount = useCallback(() => keyCountRef.current, []);

  const reset = useCallback(() => {
    eventsRef.current = [];
    startRef.current = null;
    keyCountRef.current = 0;
    epochOffsetRef.current = Date.now() - performance.now();
  }, []);

  return { onKeyDown, onKeyUp, getEvents, getKeyCount, reset };
}