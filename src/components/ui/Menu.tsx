import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { cx } from "@/lib/cx";
import { Icon } from "./Icon";
import { IconButton } from "./IconButton";
import s from "./Select.module.css";

export interface MenuItem {
  icon: string;
  label: string;
  onSelect(): void;
  danger?: boolean;
  disabled?: boolean;
  /** Draws a divider above this item. */
  divide?: boolean;
}

/** Overflow action menu behind an icon button; reuses the Select list look. Focus stays on the trigger. */
export function Menu({ label, items, icon = "more_horiz" }: { label: string; items: MenuItem[]; icon?: string }) {
  const id = useId();
  const btn = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [place, setPlace] = useState<{ style: CSSProperties; up: boolean }>();
  const enabled = items.flatMap((it, i) => (it.disabled ? [] : [i]));

  function show(first: number) {
    const r = btn.current!.getBoundingClientRect();
    const below = innerHeight - r.bottom - 12;
    const up = below < 280 && r.top - 12 > below;
    setPlace({
      up,
      style: { right: innerWidth - r.right, minWidth: 200, ...(up ? { bottom: innerHeight - r.top + 6 } : { top: r.bottom + 6 }) },
    });
    setActive(first);
    setOpen(true);
  }

  function pick(i: number) {
    setOpen(false);
    if (!items[i].disabled) items[i].onSelect();
  }

  useEffect(() => {
    if (!open) return;
    const outside = (e: Event) => {
      const t = e.target as Node;
      if (!list.current?.contains(t) && !btn.current?.contains(t)) setOpen(false);
    };
    const close = () => setOpen(false);
    addEventListener("pointerdown", outside, true);
    addEventListener("scroll", close, true);
    addEventListener("resize", close);
    addEventListener("blur", close);
    return () => {
      removeEventListener("pointerdown", outside, true);
      removeEventListener("scroll", close, true);
      removeEventListener("resize", close);
      removeEventListener("blur", close);
    };
  }, [open]);

  function onKeyDown(e: KeyboardEvent) {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) { e.preventDefault(); show(e.key === "ArrowUp" ? enabled.at(-1)! : enabled[0]); }
      return;
    }
    const step = (d: number) => {
      e.preventDefault();
      const at = enabled.indexOf(active);
      setActive(enabled[(at + d + enabled.length) % enabled.length]);
    };
    switch (e.key) {
      case "ArrowDown": return step(1);
      case "ArrowUp": return step(-1);
      case "Home": e.preventDefault(); return setActive(enabled[0]);
      case "End": e.preventDefault(); return setActive(enabled.at(-1)!);
      case "Enter": case " ": e.preventDefault(); return active >= 0 && pick(active);
      case "Escape": e.preventDefault(); e.stopPropagation(); return setOpen(false);
      case "Tab": return setOpen(false);
    }
  }

  return (
    <>
      <IconButton
        ref={btn}
        icon={icon}
        label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-activedescendant={open && active >= 0 ? `${id}-${active}` : undefined}
        onClick={() => (open ? setOpen(false) : show(-1))}
        onKeyDown={onKeyDown}
      />
      {open && place && createPortal(
        <ul
          ref={list}
          id={id}
          role="menu"
          aria-label={label}
          className={cx(s.list, s.menu, place.up && s.up)}
          style={place.style}
          onPointerDown={(e) => e.preventDefault()}
        >
          {items.map((it, i) => (
            <li
              key={it.label}
              id={`${id}-${i}`}
              role="menuitem"
              aria-disabled={it.disabled || undefined}
              data-active={i === active || undefined}
              data-danger={it.danger || undefined}
              data-divide={it.divide || undefined}
              onPointerMove={() => !it.disabled && i !== active && setActive(i)}
              onPointerLeave={() => setActive(-1)}
              onClick={() => pick(i)}
            >
              <Icon name={it.icon} />
              <span>{it.label}</span>
            </li>
          ))}
        </ul>,
        document.body,
      )}
    </>
  );
}
