import { fetchMyProfile, fetchUserProfile } from '@/apis/profile.service'
import { create } from 'zustand'

const initialProfile = {
  bio: '',
  username: '',
  main_job: [],
  expertise: [],
  account_work_experiences: [],
  account_educations: [],
  account_license: [],
}

export const useProfileStore = create((set) => ({
  profile: initialProfile,
  fetchMyProfileData: async () => {
    try {
      const data = await fetchMyProfile()
      set({ profile: data })
    } catch (err) {
      throw err
    }
  },

  fetchUserProfileData: async (username) => {
    try {
      const data = await fetchUserProfile(username)
      set({ profile: data })
    } catch (err) {
      throw err
    }
  },

  updateBasicProfile: (updates) =>
    set((state) => ({
      profile: { ...state.profile, ...updates },
    })),

  updateWorkExperience: (id, experience) =>
    set((state) => ({
      profile: {
        ...state.profile,
        account_work_experiences: state.profile.account_work_experiences.map(
          (exp) => (exp.id === id ? { ...exp, ...experience } : exp),
        ),
      },
    })),

  addWorkExperience: (experience) =>
    set((state) => ({
      profile: {
        ...state.profile,
        account_work_experiences: [
          ...state.profile.account_work_experiences,
          experience,
        ],
      },
    })),

  deleteWorkExperience: (id) =>
    set((state) => ({
      profile: {
        ...state.profile,
        account_work_experiences: state.profile.account_work_experiences.filter(
          (exp) => exp.id !== id,
        ),
      },
    })),

  updateEducation: (id, education) =>
    set((state) => ({
      profile: {
        ...state.profile,
        account_educations: state.profile.account_educations.map((edu) =>
          edu.id === id ? { ...edu, ...education } : edu,
        ),
      },
    })),

  addEducation: (education) =>
    set((state) => ({
      profile: {
        ...state.profile,
        account_educations: [...state.profile.account_educations, education],
      },
    })),

  deleteEducation: (id) =>
    set((state) => ({
      profile: {
        ...state.profile,
        account_educations: state.profile.account_educations.filter(
          (edu) => edu.id !== id,
        ),
      },
    })),

  updateLicense: (id, license) =>
    set((state) => ({
      profile: {
        ...state.profile,
        account_license: state.profile.account_license.map((lic) =>
          lic.id === id ? { ...lic, ...license } : lic,
        ),
      },
    })),

  addLicense: (license) =>
    set((state) => ({
      profile: {
        ...state.profile,
        account_license: [...state.profile.account_license, license],
      },
    })),

  deleteLicense: (id) =>
    set((state) => ({
      profile: {
        ...state.profile,
        account_license: state.profile.account_license.filter(
          (lic) => lic.id !== id,
        ),
      },
    })),

  resetProfile: () => set({ profile: initialProfile }),
}))

export const selectEducations = (state) => state.profile.account_educations

export const selectWorkExperiences = (state) =>
  state.profile.account_work_experiences

export const selectLicenses = (state) => state.profile.account_license

export const selectBasicProfile = (state) => ({
  bio: state.profile.bio,
  username: state.profile.username,
  main_job: state.profile.main_job,
  expertise: state.profile.expertise,
})
