import { useEffect, useRef, useState } from "react";
import { usePlugins } from "@/hooks/useSource";
import { attachFrame, pluginBase, usePluginRevision } from "./bridge";

/** Hidden frames running each enabled plugin's `main`. */
export function PluginHost() {
  const plugins = usePlugins().data ?? [];
  return (
    <>
      {plugins
        .filter((p) => p.enabled && !p.error)
        .map((p) => (
          <PluginFrame key={p.id} plugin={p.id} instances={p.permissions.instances} background src={`${pluginBase}${p.id}/__tn/background.html`} title={`${p.name} plugin`} hidden />
        ))}
    </>
  );
}

/** Longest a frame stays hidden waiting for `load`, which also waits on the page's remote images. */
const SHOW_AFTER_MS = 600;

/** A sandboxed plugin frame: scripts only, opaque origin, so no access to this window or Tauri. */
export function PluginFrame(p: { plugin: string; instances: boolean; background?: boolean; src: string; title: string; hidden?: boolean; className?: string }) {
  const rev = usePluginRevision();
  const ref = useRef<HTMLIFrameElement>(null);
  const { plugin, instances, background = false } = p;
  // The revision whose page has drawn: until then the frame is invisible, so it fades in once
  // instead of showing its half-styled first paints.
  const [shown, setShown] = useState(-1);
  useEffect(() => {
    const win = ref.current?.contentWindow;
    return win ? attachFrame(win, plugin, background, instances) : undefined;
  }, [plugin, background, instances, rev]);
  useEffect(() => {
    const t = setTimeout(() => setShown(rev), SHOW_AFTER_MS);
    return () => clearTimeout(t);
  }, [rev]);
  return (
    <iframe
      key={rev}
      ref={ref}
      src={p.src}
      title={p.title}
      sandbox="allow-scripts"
      hidden={p.hidden}
      className={p.className}
      onLoad={() => setShown(rev)}
      style={{ opacity: shown === rev ? 1 : 0, transition: "opacity var(--quick) var(--butter)" }}
    />
  );
}
