import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Palette, Check, X } from "lucide-react";
import { THEMES, applyTheme, getStoredTheme } from "@/lib/theme";

/**
 * Floating theme / colour picker. Lets any visitor restyle the entire site with
 * one of 8 "wow" palettes (or the default blue). Live, persisted to localStorage.
 */
export function ThemePicker() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string>("default");

  useEffect(() => { setActive(getStoredTheme()); }, []);

  function choose(id: string) {
    applyTheme(id);
    setActive(id);
  }

  return (
    <>
      {/* Trigger */}
      <button
        aria-label="Change colour theme"
        onClick={() => setOpen((o) => !o)}
        className="fixed z-[70] bottom-5 right-5 w-12 h-12 rounded-full grid place-items-center text-primary-foreground shadow-xl theme-btn-gradient theme-glow hover:scale-105 active:scale-95 transition-transform"
      >
        <Palette size={20} />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
            <motion.div
              className="fixed z-[71] bottom-20 right-5 w-[320px] max-w-[calc(100vw-2.5rem)] rounded-2xl border border-border bg-card/95 backdrop-blur-xl p-4 shadow-2xl"
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 320, damping: 26 }}
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-bold text-foreground">Colour theme</p>
                  <p className="text-[11px] text-muted-foreground">Restyle the whole site instantly</p>
                </div>
                <button onClick={() => setOpen(false)} className="w-7 h-7 grid place-items-center rounded-lg bg-muted text-muted-foreground hover:text-foreground">
                  <X size={14} />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {THEMES.map((t) => {
                  const isActive = active === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => choose(t.id)}
                      className={`group relative text-left rounded-xl p-2.5 border transition-all ${isActive ? "border-primary ring-2 ring-primary/40" : "border-border hover:border-primary/50"}`}
                    >
                      <span className="block h-10 rounded-lg mb-2 shadow-inner" style={{ backgroundImage: t.swatch }} />
                      <span className="block text-[12px] font-semibold text-foreground leading-tight">{t.name}</span>
                      <span className="block text-[10px] text-muted-foreground leading-tight mt-0.5">{t.tagline}</span>
                      {isActive && (
                        <span className="absolute top-3.5 right-3.5 w-5 h-5 rounded-full bg-primary text-primary-foreground grid place-items-center shadow">
                          <Check size={12} />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
