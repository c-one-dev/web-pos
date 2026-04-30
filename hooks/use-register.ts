import { create } from "zustand"
import { persist } from "zustand/middleware"

type Store = {
  register: string
  setRegister: (id: string) => void
}

export const useRegisterStore = create<Store>()(
  persist(
    (set) => ({
      register: "",
      setRegister: (id: string) => set({ register: id }),
    }),
    { name: "register-store" }
  )
)
