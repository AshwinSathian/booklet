// All features are free for signed-in users — this gate is a no-op pass-through.
// Kept to avoid breaking any remaining import sites while they are cleaned up.
import type { ReactNode } from "react";

type UpgradeGateProps = {
  feature?: string;
  children: ReactNode;
};

export function UpgradeGate({ children }: UpgradeGateProps) {
  return <>{children}</>;
}
