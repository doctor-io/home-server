"use client";

/**
 * Single shared instance of useStoreActions for the entire desktop shell.
 *
 * Problem solved: AppStore, AppGrid (controller), AppConfiguratorPanel all called
 * useStoreActions() independently, creating 3-4 separate React state instances.
 * This meant:
 *   - Progress banner in the grid never showed for App Store installs/uninstalls
 *   - App didn't appear as "updating" in the grid during App Store operations
 *   - operationsByApp was not shared → no coordination between windows
 *
 * Solution: Wrap the desktop shell content in <StoreActionsProvider> once.
 * All child components call useSharedStoreActions() to get the same instance.
 */

import { createContext, useContext, type ReactNode } from "react";
import { useStoreActions, type StoreActionsHandle } from "./useStoreActions";

const StoreActionsContext = createContext<StoreActionsHandle | null>(null);

export function StoreActionsProvider({ children }: { children: ReactNode }) {
  const actions = useStoreActions();
  return (
    <StoreActionsContext.Provider value={actions}>
      {children}
    </StoreActionsContext.Provider>
  );
}

export function useSharedStoreActions(): StoreActionsHandle {
  const ctx = useContext(StoreActionsContext);
  const fallbackActions = useStoreActions();
  return ctx ?? fallbackActions;
}
