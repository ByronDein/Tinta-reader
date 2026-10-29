"use client";
import { useEffect } from "react";
import { useSettingsStore } from "@/store/settings";
import { requestPersist } from "@/lib/db";
import { applyTheme } from "@/lib/themes";

/** Carga ajustes, sigue prefers-color-scheme, registra el service worker y pide almacenamiento persistente. */
export function Boot() {
  useEffect(() => {
    void useSettingsStore.getState().load();
    void requestPersist();
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const s = useSettingsStore.getState();
      applyTheme({ ...s.global, ...(s.book ?? {}) });
    };
    mq.addEventListener("change", onChange);
    // todo botón con aria-label y sin title muestra ese texto al pasar el ratón
    const tip = (el: Element) => {
      if (!(el instanceof HTMLButtonElement || el instanceof HTMLAnchorElement)) return;
      const label = el.getAttribute("aria-label");
      if (!label || el.classList.contains("inset-0")) return;
      if (el.title && !el.hasAttribute("data-auto-title")) return;
      el.title = label;
      el.setAttribute("data-auto-title", "");
    };
    const scan = (root: ParentNode) => root.querySelectorAll("button[aria-label],a[aria-label]").forEach(tip);
    scan(document);
    const obs = new MutationObserver((list) => {
      for (const m of list) {
        if (m.type === "attributes") tip(m.target as Element);
        else
          m.addedNodes.forEach((n) => {
            if (n instanceof Element) {
              tip(n);
              scan(n);
            }
          });
      }
    });
    obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-label"] });
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    return () => {
      mq.removeEventListener("change", onChange);
      obs.disconnect();
    };
  }, []);
  return null;
}
