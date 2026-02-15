import { createSupabaseBrowserClient } from '@/supabase/supabase-storage';

export async function uploadFile(formData: FormData) {
  const supabase = await createSupabaseBrowserClient();
  const file = formData.get('file') as File; // 업로드할 파일 가져오기

  console.log("file upload", file);
  if (!file) {
    throw new Error('파일이 선택되지 않았습니다.');
  }

  // 파일 이름 정리
  const sanitizedFileName = file.name
    .replace(/\s+/g, '_') // 공백을 밑줄(_)로 대체
    .replace(/[^\w\.\-]/g, ''); // 알파벳, 숫자, 점(.), 대시(-)를 제외한 모든 문자를 제거

  console.log('Sanitized file name:', sanitizedFileName);

  // 정리된 이름으로 새로운 파일 생성
  const newFile = new File([file], sanitizedFileName, { type: file.type });

  formData.set('file', newFile); // 정리된 파일을 FormData에 다시 설정

  // Supabase 스토리지에 파일 업로드
  const { data, error } = await supabase.storage
    .from(process.env.NEXT_PUBLIC_STORAGE_BUCKET!)
    .upload(sanitizedFileName, newFile, { upsert: true });

  if (error) {
    console.error('파일 업로드 에러:', error);
    throw new Error('파일 업로드 실패');
  }

  const publicURL  = await supabase.storage.from(process.env.NEXT_PUBLIC_STORAGE_BUCKET!).getPublicUrl(sanitizedFileName).data.publicUrl;
  console.log("publicURL:: ", publicURL)
  console.log('파일 업로드 성공:', data);
  return publicURL;
}
