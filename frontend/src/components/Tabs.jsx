// frontend/src/components/Tabs.jsx
import React, { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Props:
 * - tabs: string[]                                  -> ["Özet","İstatistik",...]
 * - active: string                                   -> aktif sekme
 * - onChange: (tab: string) => void                  -> tab değiştirme callback
 * - contents?: Record<string, React.ReactNode>       -> { "Özet": <Summary/>, ... } (opsiyonel; bu sayfada kullanılmıyor)
 * - className?: string                               -> dış sarmalayıcıya ek sınıf
 * - sticky?: boolean                                 -> sticky mod (opsiyonel)
 * - stickyTop?: number                               -> sticky top px (default 0)
 */
export default function Tabs({
  tabs = [],
  active,
  onChange,
  contents,
  className = "",
  sticky = false,
  stickyTop = 0,
}) {
  const barRef = useRef(null);

  // Aktif tab görünür olsun diye otomatik kaydır
  useEffect(() => {
    const wrap = barRef.current;
    if (!wrap) return;
    const btn = wrap.querySelector(`[data-tab="${CSS.escape(active || "")}"]`);
    if (!btn) return;
    const { left, right } = btn.getBoundingClientRect();
    const { left: wLeft, right: wRight } = wrap.getBoundingClientRect();
    if (left < wLeft || right > wRight) {
      wrap.scrollTo({ left: btn.offsetLeft - 24, behavior: "smooth" });
    }
  }, [active]);

  return (
    <div
      className={[
        sticky ? "sticky z-20 bg-white/90 dark:bg-gray-900/90 backdrop-blur" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={sticky ? { top: stickyTop } : undefined}
    >
      {/* Tab bar */}
      <div
        ref={barRef}
        className="relative border-b border-gray-200 dark:border-gray-800 overflow-x-auto no-scrollbar"
      >
        <div className="flex items-center gap-2 px-3 py-2 min-w-0 w-full">
          {tabs.map((t) => {
            const isActive = t === active;
            return (
              <button
                key={t}
                data-tab={t}
                onClick={() => onChange && onChange(t)}
                className={[
                  "relative shrink-0 px-3 py-1 rounded-full text-sm transition whitespace-nowrap",
                  isActive
                    ? "text-white bg-blue-600 shadow"
                    : "bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-100",
                ].join(" ")}
              >
                {t}
                <AnimatePresence>
                  {isActive && (
                    <motion.span
                      layoutId="tab-pill-highlight"
                      className="absolute inset-0 rounded-full ring-2 ring-blue-400/20"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ type: "spring", stiffness: 350, damping: 30 }}
                    />
                  )}
                </AnimatePresence>
              </button>
            );
          })}
        </div>

        {/* Alt çizgi animasyonu */}
        <Underline tabs={tabs} active={active} barRef={barRef} />
      </div>

      {/* İçerik göstermek istersen (bu sayfada kullanmıyoruz) */}
      {contents && Object.prototype.hasOwnProperty.call(contents, active) && (
        <div className="p-3 sm:p-4">{contents[active]}</div>
      )}
    </div>
  );
}

function Underline({ tabs, active, barRef }) {
  const rect = (() => {
    const wrap = barRef?.current;
    if (!wrap) return null;
    const btn = wrap.querySelector(`[data-tab="${CSS.escape(active || "")}"]`);
    if (!btn) return null;
    const wRect = wrap.getBoundingClientRect();
    const bRect = btn.getBoundingClientRect();
    return {
      left: bRect.left - wRect.left + wrap.scrollLeft,
      width: bRect.width,
    };
  })();

  return (
    <div className="relative h-[2px]">
      <motion.div
        className="absolute bottom-0 h-[2px] bg-blue-600 rounded"
        initial={false}
        animate={{
          x: rect ? rect.left : 0,
          width: rect ? rect.width : 0,
        }}
        transition={{ type: "spring", stiffness: 350, damping: 30 }}
      />
    </div>
  );
}
