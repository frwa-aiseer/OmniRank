import { ErrorBoundary } from "./components/ErrorBoundary.tsx";
import { AppProvider } from "./context/AppContext.tsx";
import { Shell } from "./components/layout/Shell.tsx";

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <Shell />
      </AppProvider>
    </ErrorBoundary>
  );
}
