import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

// Follows the system "Reduce Motion" setting. Reduced means gentler, not none:
// callers drop movement (translate, scale, stagger) but keep short fades.
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => alive && setReduced(value)).catch(() => {});
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return reduced;
}
