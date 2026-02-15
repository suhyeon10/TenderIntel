interface WorkExperience {
  start_date: string
  end_date?: string
}

export const calculateTotalExperience = (experiences: WorkExperience[]) => {
  const today = new Date()

  const totalMonths = experiences.reduce((acc, exp) => {
    const startDate = new Date(exp.start_date)
    const endDate = exp.end_date ? new Date(exp.end_date) : today

    const months =
      (endDate.getFullYear() - startDate.getFullYear()) * 12 +
      (endDate.getMonth() - startDate.getMonth())

    return acc + months
  }, 0)

  const years = Math.floor(totalMonths / 12)
  const months = totalMonths % 12

  return { years, months }
}
