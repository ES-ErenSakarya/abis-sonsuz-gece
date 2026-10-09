import { create } from "zustand";

type SessionState = {
  activeId: string | null;
  enter: (id: string) => void;
  leave: () => void;
};

export const useSession = create<SessionState>((set) => ({
  activeId: null,
  enter: (id) => set({ activeId: id }),
  leave: () => set({ activeId: null }),
}));
