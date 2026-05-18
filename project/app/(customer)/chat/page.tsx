import ChatInterface from '@/components/chat/chat-interface'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function ChatPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/signin')
  }

  // Ideally, middleware or page load checks if user has location.
  // If no location, redirect to /onboarding/location

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">SahuliatAI Assistant</h1>
        <p className="text-muted-foreground">Describe your problem and we'll find the right professionals.</p>
      </div>
      
      <ChatInterface />
    </div>
  )
}
