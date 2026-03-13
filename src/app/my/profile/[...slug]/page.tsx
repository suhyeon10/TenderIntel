import { redirect } from 'next/navigation'

export default function MyProfileFallbackPage() {
  redirect('/my/profile')
}
