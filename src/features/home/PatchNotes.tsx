import { useEffect, useState } from "react";
import { getPatchNotes, type PatchNote } from "@/api/mojang";
import { SectionHead, Skeleton } from "@/components/ui";
import s from "./home.module.css";

export function PatchNotes() {
  const [notes, setNotes] = useState<PatchNote[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    getPatchNotes(6).then(setNotes, () => setFailed(true));
  }, []);

  return (
    <div className={`${s.cell} ${s.pane} ${s.newsPane}`}>
      <SectionHead title="Patch notes" />
      {failed ? (
        <p className={s.newsEmpty}>Patch notes are unavailable offline.</p>
      ) : !notes ? (
        <div className={s.news}>{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} height={36} />)}</div>
      ) : (
        <ol className={s.news}>
          {notes.map((n) => (
            <li key={n.version}>
              <span>{n.title.replace(/^Minecraft:? Java Edition /i, "")}</span>
              <time className={s.newsDate} dateTime={n.date}>
                {new Date(n.date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
              </time>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
