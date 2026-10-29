import { useQuery } from "@tanstack/react-query";
import { openUrl } from "@tauri-apps/plugin-opener";
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { launcher } from "@/api/launcher";
import { Button, EmptyState, Icon, IconButton, Input, Pill, PillGroup } from "@/components/ui";
import { cx } from "@/lib/cx";
import { compact, errorMessage } from "@/lib/format";
import { gameLogs, useGameLog } from "@/store/gameLogs";
import { useLauncher } from "@/store/LauncherContext";
import s from "./logs.module.css";

type Kind = "log" | "crash";
type Level = "info" | "warn" | "error";
type Filter = "all" | Exclude<Level, "info">;
interface Row { n: number; text: string; level: Level }
interface Shared { instance: string; kind: Kind; url: string; at: number }

const SOURCES: Record<Kind, { label: string; icon: string }> = {
  log: { label: "Game log", icon: "description" },
  crash: { label: "Crash report", icon: "heart_broken" },
};
/** Lines drawn at once; the upload holds the whole log. */
const SHOWN = 4000;
const HISTORY = "shared-logs";

const ERROR = /[[/](ERROR|FATAL|SEVERE)\]|^(\S+\.)?\S*(Exception|Error)(:|$)/;
const WARN = /[[/]WARN(ING)?\]/;
/** Stack frames and `Caused by` lines belong to the line they follow. */
const CONTINUES = /^\s+at |^\s*\.\.\. \d+ more|^Caused by: |^\s+Suppressed: /;

/** Crash reports aren't log4j: each line's level, a stack trace taking the level of the line that threw it. */
export function classify(text: string): Row[] {
  let last: Level = "info";
  return text.replace(/\n$/, "").split("\n").map((line, i) => {
    last = CONTINUES.test(line) ? last : ERROR.test(line) ? "error" : WARN.test(line) ? "warn" : "info";
    return { n: i + 1, text: line, level: last };
  });
}

function readHistory(): Shared[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY) ?? "[]");
  } catch {
    return [];
  }
}

const when = (at: number) => new Date(at).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

/** The game log and crash report of one instance: a preview, and a mclo.gs link to paste where you ask for help. */
export function Logs({ instanceId }: { instanceId: string }) {
  const log = useGameLog(instanceId);
  const running = useLauncher((st) => st.snapshot?.running.includes(instanceId) ?? false);
  // A finished session may leave a new crash report.
  const crash = useQuery({ queryKey: ["crash-report", instanceId, running], queryFn: () => launcher.readCrashReport(instanceId) });
  const [loadError, setLoadError] = useState("");
  const [picked, setPicked] = useState<Kind | null>(null);
  const [history, setHistory] = useState(readHistory);

  useEffect(() => {
    gameLogs.load(instanceId).catch((e) => setLoadError(errorMessage(e)));
  }, [instanceId]);

  const rev = log?.rev ?? 0;
  const rows = useMemo<Record<Kind, Row[]>>(
    () => ({
      log: (log?.lines ?? []).map((l) => ({ n: l.n, text: l.raw, level: l.level === "debug" ? "info" : l.level })),
      crash: crash.data?.trim() ? classify(crash.data) : [],
    }),
    // `log.lines` mutates in place; `rev` is what changes.
    [log, rev, crash.data]
  );
  // A crash is what support asks about first.
  const selected: Kind = picked === "log" || !rows.crash.length ? "log" : "crash";
  const texts: Record<Kind, () => string> = {
    log: () => rows.log.map((r) => r.text).join("\n"),
    crash: () => crash.data ?? "",
  };

  const remember = (kind: Kind, url: string) => {
    const next = [{ instance: instanceId, kind, url, at: Date.now() }, ...history].slice(0, 50);
    setHistory(next);
    try {
      localStorage.setItem(HISTORY, JSON.stringify(next));
    } catch {
      // Unsaved history only costs the list below.
    }
  };
  const mine = history.filter((r) => r.instance === instanceId).slice(0, 12);

  return (
    <div className={s.layout}>
      <section className={s.pane} aria-labelledby="logs-title">
        <div className={s.head}>
          <h3 id="logs-title">Share log</h3>
          <p>Upload what the game printed and paste the link where you ask for help.</p>
        </div>
        <ul className={s.sources}>
          {(["log", "crash"] as const).map((kind) =>
            kind === "crash" && !rows.crash.length ? null : (
              <Source key={kind} kind={kind} lines={rows[kind].length} selected={selected === kind} onSelect={() => setPicked(kind)}
                read={texts[kind]} onShared={(url) => remember(kind, url)} />
            )
          )}
        </ul>
        <div className={cx(s.section, s.rule, s.grow)}>
          <h4>Shared before</h4>
          {mine.length ? (
            <ul className={s.history}>
              {mine.map((r) => (
                <li key={r.at} className={s[r.kind]}>
                  <Icon name={SOURCES[r.kind]?.icon ?? "description"} />
                  <a title={`${SOURCES[r.kind]?.label ?? "Log"} · ${r.url}`} onClick={() => openUrl(r.url)}>{r.url.replace(/^https:\/\//, "")}</a>
                  <time dateTime={new Date(r.at).toISOString()}>{when(r.at)}</time>
                  <CopyButton url={r.url} className={s.sm} />
                </li>
              ))}
            </ul>
          ) : (
            <p className={s.emptyNote}>Links you upload are kept here.</p>
          )}
        </div>
        <p className={s.note}>
          <Icon name="shield" />
          <span>Uploads go to mclo.gs, which hides IP addresses and access tokens. Anyone with the link can read the log.</span>
        </p>
      </section>
      <Preview key={selected} title={SOURCES[selected].label} rows={rows[selected]} rev={rev} error={selected === "log" ? loadError : ""} />
    </div>
  );
}

interface SourceProps { kind: Kind; lines: number; selected: boolean; onSelect(): void; read(): string; onShared(url: string): void }

function Source({ kind, lines, selected, onSelect, read, onShared }: SourceProps) {
  const { label, icon } = SOURCES[kind];
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ url: string } | { error: string } | null>(null);
  const field = useRef<HTMLInputElement>(null);
  const meta = kind === "log" ? (lines ? `Last session · ${lines.toLocaleString()} lines` : "Nothing yet: launch the game first") : `From the last crash · ${lines.toLocaleString()} lines`;

  useEffect(() => field.current?.select(), [result]);

  const upload = () => {
    setBusy(true);
    launcher
      .shareLog(read())
      .then((url) => (setResult({ url }), onShared(url)), (e) => setResult({ error: errorMessage(e) }))
      .finally(() => setBusy(false));
  };

  return (
    <li className={cx(s.source, s[kind])} tabIndex={0} aria-current={selected} title={`Preview the ${label.toLowerCase()}`}
      onClick={(e) => !(e.target as Element).closest("input, button") && onSelect()}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && e.target === e.currentTarget && (e.preventDefault(), onSelect())}>
      <span className={s.mark} aria-hidden="true"><Icon name={icon} /></span>
      <div className={s.text}>
        <b>{label}</b>
        <span>{meta}</span>
      </div>
      <Button size="sm" icon="cloud_upload" loading={busy} disabled={!lines} onClick={upload}>
        {busy ? "Uploading" : result ? ("error" in result ? "Try again" : "Upload again") : "Upload"}
      </Button>
      {result && "url" in result && (
        <div className={s.extra}>
          <Input ref={field} mono readOnly className={cx(s.link, "selectable")} aria-label={`${label} link`} value={result.url} />
          <CopyButton url={result.url} />
          <IconButton icon="open_in_new" label="Open in browser" onClick={() => openUrl(result.url)} />
        </div>
      )}
      {result && "error" in result && (
        <div className={cx(s.extra, s.error)} role="alert">
          <Icon name="error" />
          <span>{result.error}</span>
        </div>
      )}
    </li>
  );
}

function CopyButton({ url, className }: { url: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);
  // On failure the link field stays selected for Ctrl+C.
  const copy = () => navigator.clipboard.writeText(url).then(() => setCopied(true), () => {});
  return <IconButton icon={copied ? "check" : "content_copy"} label="Copy link" className={cx(className, copied && s.copied)} onClick={copy} />;
}

function Preview({ title, rows, rev, error }: { title: string; rows: Row[]; rev: number; error: string }) {
  const [filter, setFilter] = useState<Filter>("all");
  const scroller = useRef<HTMLDivElement>(null);
  const counts = useMemo(() => ({ all: rows.length, warn: rows.filter((r) => r.level === "warn").length, error: rows.filter((r) => r.level === "error").length }), [rows]);
  const active = filter !== "all" && !counts[filter] ? "all" : filter;
  const matching = active === "all" ? rows : rows.filter((r) => r.level === active);
  const shown = matching.slice(-SHOWN);

  // The end of a log is where it broke.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [rev, active, rows]);

  return (
    <section className={cx(s.pane, s.viewer)} aria-label={title}>
      <header className={s.viewerHead}>
        <h3>{title}</h3>
        <PillGroup label="Show">
          {([["all", "All"], ["warn", "Warnings"], ["error", "Errors"]] as const).map(([f, label]) => (
            <Pill key={f} tone={f === "all" ? undefined : f} pressed={active === f} disabled={f !== "all" && !counts[f]} onClick={() => setFilter(f)} count={compact(counts[f])}>
              {label}
            </Pill>
          ))}
        </PillGroup>
      </header>
      {error && <p className={s.loadError}>Could not read the last log: {error}</p>}
      {rows.length ? (
        <div className={cx(s.lines, "selectable")} ref={scroller} role="log" tabIndex={0}>
          {shown.length < matching.length && (
            <p className={s.logNote}>Showing the last {shown.length.toLocaleString()} of {matching.length.toLocaleString()} lines. The upload has all of them.</p>
          )}
          {shown.map((r) => <Line key={r.n} {...r} />)}
        </div>
      ) : (
        <EmptyState icon="article">Nothing to show yet. Launch the game and its log appears here.</EmptyState>
      )}
    </section>
  );
}

// Memoized: a log line never changes, so live output renders only the new lines.
const Line = memo(function Line({ n, text, level }: Row) {
  return (
    <div className={cx(s.ln, s[level])}>
      <span>{n}</span>
      <span>{text || " "}</span>
    </div>
  );
});
