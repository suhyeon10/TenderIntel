'use client'

import { fetchTeamProfileByTeamManager, fetchMyTeams, fetchTeamDetail } from '@/apis/team.service'
import { create } from 'zustand'

interface TeamMember {
  id: number
  maker_id: string | null
  team_id: number | null
  status: string | null
  created_at: string
  updated_at: string | null
  account: {
    profile_id: string
    user_id: string
    username: string
    role: 'MAKER' | 'MANAGER' | 'NONE'
    bio?: string | null
  } | null
}

interface TeamProfile {
  id: number
  name: string
  bio: string | null
  specialty: string[] | null
  sub_specialty: string[] | null
  prefered: string[] | null
  manager_id: string
  manager_profile_id?: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  team_members: TeamMember[] | null
  isManager?: boolean
  manager?: {
    profile_id: string
    user_id: string
    username: string
    role: 'MAKER' | 'MANAGER' | 'NONE'
    bio?: string | null
    profile_image_url?: string | null
  } | null

  teamHistory?: {
    id: string
    version: string
    date: string
    description: string
  }[]
}

interface TeamProfileState {
  teamProfile: TeamProfile | null
  teams: TeamProfile[]
  selectedTeamId: number | null
  fetchTeamProfile: () => Promise<void>
  fetchMyTeams: () => Promise<void>
  selectTeam: (teamId: number) => Promise<void>
  refreshTeam: (teamId: number) => Promise<void>
}

export const useTeamProfileStore = create<TeamProfileState>((set, get) => ({
  teamProfile: null,
  teams: [],
  selectedTeamId: null,
  fetchTeamProfile: async () => {
    try {
      const { data, error } = await fetchTeamProfileByTeamManager()
      if (error) throw error
      set({ teamProfile: data as unknown as TeamProfile })
    } catch (err) {
      throw err
    }
  },
  fetchMyTeams: async () => {
    try {
      const { data, error } = await fetchMyTeams()
      if (error) throw error
      set({ teams: (data || []) as TeamProfile[] })
      // 첫 번째 팀을 자동으로 선택
      if (data && data.length > 0 && !get().selectedTeamId) {
        await get().selectTeam(data[0].id)
      }
    } catch (err) {
      throw err
    }
  },
  selectTeam: async (teamId: number) => {
    try {
      const { data, error } = await fetchTeamDetail(teamId)
      if (error) throw error
      set({ 
        teamProfile: data as unknown as TeamProfile,
        selectedTeamId: teamId
      })
    } catch (err) {
      throw err
    }
  },
  refreshTeam: async (teamId: number) => {
    try {
      const { data, error } = await fetchTeamDetail(teamId)
      if (error) throw error
      set({ teamProfile: data as unknown as TeamProfile })
      // 팀 목록도 새로고침
      const { data: teamsData, error: teamsError } = await fetchMyTeams()
      if (!teamsError && teamsData) {
        set({ teams: (teamsData || []) as TeamProfile[] })
      }
    } catch (err) {
      throw err
    }
  },
}))
