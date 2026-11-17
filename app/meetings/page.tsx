import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDb } from '@/lib/db';
import { findSession, SESSION_COOKIE } from '@/lib/security';
import MeetingUpload from '@/components/meeting-upload';
export const dynamic = 'force-dynamic';
export default async function MeetingsPage() {
  const session = await findSession(await getDb(), (await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) redirect('/');
  return <MeetingUpload />;
}
