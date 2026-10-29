import { useQuery } from "@tanstack/react-query";
import { launcher } from "@/api/launcher";
import { Button, EmptyState, IconButton, SectionHead, Skeleton } from "@/components/ui";
import { WorldIcon } from "@/features/worlds/Worlds";
import { lastPlayed } from "@/lib/format";
import { useLauncher } from "@/store/LauncherContext";
import { useUi } from "@/store/UiContext";
import type { Instance } from "@/types";
import s from "./home.module.css";

const SHOWN = 6;

/** Where the player left off: the instance's latest worlds, each one click from playing. */
export function RecentWorlds({ inst }: { inst: Instance }) {
  const worlds = useQuery({ queryKey: ["worlds", inst.id], queryFn: () => launcher.listWorlds(inst.id) });
  const launch = useLauncher((st) => st.launch);
  const blocked = useLauncher((st) => st.busyId !== null || (st.snapshot?.running.includes(inst.id) ?? false));
  const navigate = useUi((st) => st.navigate);
  const list = worlds.data ?? [];

  return (
    <div className={`${s.cell} ${s.pane} ${s.worldsPane}`}>
      <SectionHead
        title="Worlds"
        action={list.length > SHOWN && (
          <Button variant="link" onClick={() => navigate("instances", { instance: inst.id })}>All {list.length}</Button>
        )}
      />
      {!worlds.data ? (
        <div className={s.worlds}>{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} height={48} />)}</div>
      ) : !list.length ? (
        <EmptyState icon="public">{worlds.isError ? "Worlds could not be read." : "No worlds yet. Create one in game and it shows up here."}</EmptyState>
      ) : (
        <div className={s.worlds}>
          {list.slice(0, SHOWN).map((w) => (
            <div key={w.folder} className={s.world}>
              <WorldIcon instanceId={inst.id} world={w} />
              <div className={s.worldText}>
                <strong>{w.folder}</strong>
                <span>{lastPlayed(w.played)}</span>
              </div>
              <IconButton icon="play_arrow" label={`Play ${w.folder}`} title="Launch straight into this world (Minecraft 1.20+)"
                disabled={blocked} onClick={() => launch(inst.id, w.folder)} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
