import { DesktopShell } from "@/components/desktop/desktop-shell";
import { RealtimeBootstrap } from "@/components/providers/realtime-bootstrap";

export default function HomePage() {
  return (
    <>
      <RealtimeBootstrap />
      <DesktopShell />
    </>
  );
}
