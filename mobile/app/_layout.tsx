import { Tabs } from "expo-router";
import { LastRunProvider } from "../src/store/lastRun";

export default function RootLayout() {
  return (
    <LastRunProvider>
      <Tabs>
        <Tabs.Screen name="index" options={{ title: "Capture" }} />
        <Tabs.Screen name="results" options={{ title: "Results" }} />
        <Tabs.Screen name="closet" options={{ title: "Closet" }} />
      </Tabs>
    </LastRunProvider>
  );
}
