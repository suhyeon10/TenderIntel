export const formatDate = (dateString: string) => {
  if (!dateString) return null
  const date = new Date(dateString)
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}`
}
