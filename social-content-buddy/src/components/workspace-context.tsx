"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";

export interface Workspace {
  id: string;
  name: string;
  businessName: string;
  websiteUrl: string | null;
  targetAudience: string | null;
  tonePrefs: string | null;
  logoUrl: string | null;
  brandColors: string[] | null;
  brandFonts: Record<string, string> | null;
  brandGuidelines: string | null;
  timezone: string | null;
  createdAt: string;
  updatedAt: string;
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
  loading: true,
});

export function useWorkspace() {
  return useContext(WorkspaceContext);
}

const STORAGE_KEY = "postai_active_workspace";

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchWorkspaces = useCallback(async () => {
    try {
      const res = await fetch("/api/workspaces");
      if (res.ok) {
        const data: Workspace[] = await res.json();
        setWorkspaces(data);

        // Restore saved selection or pick first
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved && data.some((w) => w.id === saved)) {
          setActiveId(saved);
        } else if (data.length > 0) {
          setActiveId(data[0].id);
          localStorage.setItem(STORAGE_KEY, data[0].id);
        } else {
          setActiveId(null);
        }
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  function setActiveWorkspaceId(id: string | null) {
    setActiveId(id);
    if (id) localStorage.setItem(STORAGE_KEY, id);
    else localStorage.removeItem(STORAGE_KEY);
  }

  const activeWorkspace = workspaces.find((w) => w.id === activeId) || null;

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        activeWorkspace,
        setActiveWorkspaceId,
        refreshWorkspaces: fetchWorkspaces,
        loading,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}
