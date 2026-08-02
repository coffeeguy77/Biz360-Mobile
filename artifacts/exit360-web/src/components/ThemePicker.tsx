import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Palette, Check, X } from "lucide-react";
import { THEMES, applyTheme, getStoredTheme } from "@/lib/theme";
import { BG_EFFECTS, getStoredEffect, setStoredEffect } from "@/lib/bg";

/**
 * Floating theme / colour picker. Lets any visitor restyle the entire site with
 * one of 8 "wow" palettes (or the default blue). Live, persisted to localStorage.
 */
export function ThemePicker() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string>("default");
  const [effect, setEffect] = useState<string>("mesh-gradient");

  useEffect(() => { setActive(getStoredTheme()); setEffect(getStoredEffect()); }, []);

  function choose(id: string) {
    applyTheme(id);
    setActive(id);
  }

  function chooseEffect(id: string) {
    setStoredEffect(id);
    setEffect(id);
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
              className="fixed z-[71] bottom-20 right-5 w-[320px] max-w-[calc(100vw-2.5rem)] max-h-[calc(100vh-7rem)] overflow-y-auto themed-scroll rounded-2xl border border-border bg-card/95 backdrop-blur-xl p-4 shadow-2xl"
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

              {/* Background effect */}
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-sm font-bold text-foreground">Background effect</p>
                <p className="text-[11px] text-muted-foreground mb-3">Crisp animated backdrop for the whole site</p>
                <div className="grid grid-cols-2 gap-2">
                  {BG_EFFECTS.map((e) => {
                    const on = effect === e.id;
                    return (
                      <button
                        key={e.id}
                        onClick={() => chooseEffect(e.id)}
                        className={`relative text-left rounded-xl p-2.5 border transition-all overflow-hidden ${on ? "border-primary ring-2 ring-primary/40" : "border-border hover:border-primary/50"}`}
                      >
                        <span className={`block h-9 rounded-lg mb-1.5 fx-swatch fx-swatch-${e.id}`} />
                        <span className="block text-[11px] font-semibold text-foreground leading-tight">{e.name}</span>
                        <span className="block text-[9px] text-muted-foreground leading-tight mt-0.5">{e.tagline}</span>
                        {on && (
                          <span className="absolute top-3 right-3 w-4 h-4 rounded-full bg-primary text-primary-foreground grid place-items-center shadow">
                            <Check size={10} />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
