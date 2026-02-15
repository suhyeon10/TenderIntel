import { create } from 'zustand'

interface AccountState {
  account: any
  setAccount: (account: any) => void
}

export const useAccountStore = create<AccountState>((set) => ({
  account: null,
  setAccount: (account) => set({ account }),
}))

export const selectAccount = (state: any) => state.account
