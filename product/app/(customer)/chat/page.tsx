import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ChatSurface from '@/components/chat/chat-surface';
import AppHeader from '@/components/layout/app-header';

export default async function ChatPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/signin');

  const { data: locations } = await supabase
    .from('user_locations')
    .select('id, label, address_text, city, town_or_area')
    .eq('user_id', user.id)
    .order('last_used_at', { ascending: false, nullsFirst: false });

  if (!locations || locations.length === 0) redirect('/onboarding/location');

  return (
    <>
      <AppHeader active="chat" />
      <ChatSurface userId={user.id} locations={locations} />
    </>
  );
}
