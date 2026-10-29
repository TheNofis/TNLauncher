import { View } from "@/components/layout/View";
import { useChanged } from "@/hooks/useChanged";
import { cx } from "@/lib/cx";
import { useSelectedInstance } from "@/store/LauncherContext";
import { Hero } from "./Hero";
import { InstanceSpec } from "./InstanceSpec";
import { InstanceTiles } from "./InstanceTiles";
import { LaunchDock } from "./LaunchDock";
import { PatchNotes } from "./PatchNotes";
import { PlayerCard } from "./PlayerCard";
import { RecentWorlds } from "./RecentWorlds";
import s from "./home.module.css";

export function HomeView() {
  const inst = useSelectedInstance();
  // Only a real switch re-stages, never opening Home.
  const restage = useChanged(inst?.id);

  return (
    <View dock className={s.home}>
      {/* Instance tiles are keyed so a switch re-stages them; the player and patch notes stay put. */}
      <div className={cx(s.bento, restage && s.restage)}>
        <Hero key={inst?.id} />
        <PlayerCard />
        {inst && <RecentWorlds key={`w-${inst.id}`} inst={inst} />}
        {inst && <InstanceSpec key={`d-${inst.id}`} inst={inst} />}
        <PatchNotes />
      </div>
      <InstanceTiles />
      <LaunchDock />
    </View>
  );
}
