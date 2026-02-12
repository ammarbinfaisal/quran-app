import { NavBar } from "@/components/NavBar";
import { SettingsClient } from "./SettingsClient";

export default function SettingsPage() {
  return (
    <div className="flex flex-col min-h-dvh bg-background">
      <NavBar title="Settings" backHref="/" />
      <SettingsClient />
    </div>
  );
}
