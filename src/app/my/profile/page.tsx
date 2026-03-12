import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createServerSideClientRSC } from '@/supabase/supabase-server'

export default async function MyProfilePage() {
  const supabase = await createServerSideClientRSC()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <div className="container mx-auto max-w-3xl px-4 py-12">
        <Card className="border-slate-200 shadow-lg">
          <CardHeader>
            <CardTitle>내 프로필</CardTitle>
            <CardDescription>현재 로그인한 계정 정보를 확인할 수 있습니다.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-500">이메일</p>
              <p className="mt-1 text-base font-semibold text-slate-900">{user.email || '이메일 정보 없음'}</p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/legal">법률 홈으로 이동</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/auth">계정 페이지로 이동</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
