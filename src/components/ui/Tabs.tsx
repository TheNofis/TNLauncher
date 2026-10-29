import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { cx } from "@/lib/cx";
import { Icon } from "./Icon";
import s from "./Tabs.module.css";

/** Underlined tab strip; the panel is the caller's `role="tabpanel"`. */
export function Tabs({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  const list = useRef<HTMLDivElement>(null);
  const line = useRef<HTMLSpanElement>(null);
  const shown = useRef<HTMLElement | null>(null);
  // One underline that slides to the selected tab. Measured after every render (tabs change label/count),
  // written straight to the DOM; the first placement skips the transition so it doesn't fly in from the left.
  useLayoutEffect(() => {
    const tab = list.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    const el = line.current;
    if (!el) return;
    if (list.current) markEdges(list.current); // tabs come and go (plugins), the strip's width doesn't
    el.hidden = !tab;
    if (!tab) return;
    el.style.width = `${tab.offsetWidth - 16}px`;
    el.style.left = `${tab.offsetLeft + 8}px`;
    if (!el.dataset.ready) requestAnimationFrame(() => (el.dataset.ready = "1"));
    // Newly selected tab scrolls into the strip's view; scrollTo, not scrollIntoView, so the page never moves.
    const l = list.current!;
    if (tab === shown.current) return;
    const behavior = shown.current ? "smooth" : "instant";
    shown.current = tab;
    const pad = 32; // clears the edge fade
    if (tab.offsetLeft - pad < l.scrollLeft) l.scrollTo({ left: tab.offsetLeft - pad, behavior });
    else if (tab.offsetLeft + tab.offsetWidth + pad > l.scrollLeft + l.clientWidth)
      l.scrollTo({ left: tab.offsetLeft + tab.offsetWidth + pad - l.clientWidth, behavior });
  });
  // Vertical wheel scrolls the strip sideways; edge fades show which side has hidden tabs.
  useEffect(() => {
    const l = list.current;
    if (!l) return;
    const edges = () => markEdges(l);
    const wheel = (e: WheelEvent) => {
      if (l.scrollWidth <= l.clientWidth || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      e.preventDefault();
      l.scrollBy({ left: e.deltaY, behavior: e.deltaMode === 0 && Math.abs(e.deltaY) < 50 ? "instant" : "smooth" });
    };
    const ro = new ResizeObserver(edges);
    ro.observe(l);
    edges();
    l.addEventListener("scroll", edges, { passive: true });
    l.addEventListener("wheel", wheel, { passive: false });
    return () => {
      ro.disconnect();
      l.removeEventListener("scroll", edges);
      l.removeEventListener("wheel", wheel);
    };
  }, []);
  return (
    <div role="tablist" aria-label={label} ref={list} className={cx(s.tabs, className)}>
      {children}
      <span ref={line} className={s.line} aria-hidden="true" />
    </div>
  );
}

function markEdges(l: HTMLElement) {
  l.toggleAttribute("data-start", l.scrollLeft > 1);
  l.toggleAttribute("data-end", l.scrollLeft + l.clientWidth < l.scrollWidth - 1);
}

interface TabProps {
  selected: boolean;
  onSelect(): void;
  icon?: string;
  count?: ReactNode;
  children: ReactNode;
}

export function Tab({ selected, onSelect, icon, count, children }: TabProps) {
  return (
    <button type="button" role="tab" className={s.tab} aria-selected={selected} onClick={onSelect}>
      {icon && <Icon name={icon} />}
      {children}
      {count != null && <span className={cx("mono", s.count)}>{count}</span>}
    </button>
  );
}
