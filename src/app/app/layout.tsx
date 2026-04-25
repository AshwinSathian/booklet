import PrimeStyles from "@/components/ui/PrimeStyles";
import type { ReactNode } from "react";
import "./primereact.css";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PrimeStyles />
      {children}
    </>
  );
}
