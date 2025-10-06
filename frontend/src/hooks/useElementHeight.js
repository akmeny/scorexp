import { useEffect, useState } from "react";

export default function useElementHeight(selector) {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const el = document.querySelector(selector);
    if (!el) return;

    const measure = () => setHeight(el.getBoundingClientRect().height || 0);
    measure();

    const ro = new ResizeObserver(measure);
    ro.observe(el);

    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [selector]);

  return height;
}