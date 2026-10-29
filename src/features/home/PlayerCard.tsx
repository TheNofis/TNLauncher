import { lazy, Suspense } from "react";
import { Button } from "@/components/ui";
import { useSkin } from "@/features/profiles/Skin";
import { useLauncher } from "@/store/LauncherContext";
import { useUi } from "@/store/UiContext";
import s from "./home.module.css";

// The turntable is Profiles code; Home stays in the main chunk without it.
const SkinModel = lazy(() => import("@/features/profiles/SkinModel").then((m) => ({ default: m.SkinModel })));

/** Who is about to play: the active account on its skin turntable. */
export function PlayerCard() {
  const account = useLauncher((st) => st.snapshot?.account);
  const loaded = useLauncher((st) => st.snapshot !== null);
  const navigate = useUi((st) => st.navigate);
  const skin = useSkin(account);

  return (
    <div className={`${s.cell} ${s.player}`}>
      <div className={s.playerModel}>
        <Suspense fallback={null}>
          <SkinModel skin={skin} px={6} label={account ? `${account.name}'s skin` : "Default skin"} />
        </Suspense>
      </div>
      {account ? (
        <button type="button" className={s.playerName} onClick={() => navigate("profiles")} title="Manage accounts">
          <strong>{account.name}</strong>
          <span>{account.providerName}</span>
        </button>
      ) : (
        loaded && (
          <div className={s.playerName}>
            <strong>Not signed in</strong>
            <Button size="sm" variant="primary" icon="login" onClick={() => navigate("profiles")}>Sign in</Button>
          </div>
        )
      )}
    </div>
  );
}
