"use client";

import { createContext, useContext, type ReactNode } from "react";

// This project is a single-user LinkedIn post generator with no multi-workspace
// concept, so the workspace context is a lightweight no-op that keeps the
// consuming pages (history, calendar) working without a workspace filter.
export interface Workspace {
  id: string;
  name: string;
}

interface WorkspaceContextValue {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  setActiveWorkspaceId: (id: string | null) => void;
  refreshWorkspaces: () => Promise<void>;
  loading: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextValue>({
  workspaces: [],
  activeWorkspace: null,
  setActiveWorkspaceId: () => {},
  refreshWorkspaces: async () => {},
  loading: false,
});

export function useWorkspace() {
  return useContext(WorkspaceContext);
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  return (
    <WorkspaceContext.Provider
      value={{
        workspaces: [],
        activeWorkspace: null,
        setActiveWorkspaceId: () => {},
        refreshWorkspaces: async () => {},
        loading: false,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}
