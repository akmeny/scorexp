// frontend/src/hooks/useBottomInset.js
import { useEffect, useState } from "react";

/**
 * Mobil alt barda (#mobile-bottom-bar) oluşan gerçek yüksekliği ölçer.
 * ResizeObserver + window resize ile dinamik günceller.
 */
export default function useBottomInset() {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const el = document.getElementById("mobile-bottom-bar");
    if (!el) {
      setInset(0);
      return;
    }

    const update = () => setInset(el.getBoundingClientRect().height || 0);

    update(); // ilk ölçüm

    const ro = new ResizeObserver(update);
    ro.observe(el);

    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  return inset; // px cinsinden
}
