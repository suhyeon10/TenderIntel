import AuthUI from '@/components/AuthUI'

export default function Page({
  searchParams,
}: {
  searchParams: { role: string }
}) {
  const role = searchParams.role
  return <AuthUI role={role} />
}
