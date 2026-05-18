import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function SecurityProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/signin')
  }

  async function updatePassword(formData: FormData) {
    'use server'
    const newPassword = formData.get('newPassword') as string
    const confirmPassword = formData.get('confirmPassword') as string

    if (newPassword !== confirmPassword) {
      // In a real app we'd return form state errors
      console.error('Passwords do not match')
      return
    }

    const supabase = await createClient()
    const { error } = await supabase.auth.updateUser({ password: newPassword })

    if (error) {
      console.error('Error updating password:', error)
    } else {
      // Password updated successfully
    }
  }

  return (
    <div className="flex flex-col items-center p-4 md:p-8">
      <div className="w-full max-w-md space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Security Settings</h1>
          <p className="text-muted-foreground text-sm">Update your password</p>
        </div>

        <div className="p-4 border rounded-lg bg-card">
          <form action={updatePassword} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="newPassword" className="text-sm font-medium">New Password</label>
              <input 
                id="newPassword" 
                name="newPassword" 
                type="password" 
                required 
                className="w-full p-2 border rounded-md" 
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="confirmPassword" className="text-sm font-medium">Confirm New Password</label>
              <input 
                id="confirmPassword" 
                name="confirmPassword" 
                type="password" 
                required 
                className="w-full p-2 border rounded-md" 
              />
            </div>
            
            <button type="submit" className="w-full p-2 text-white bg-blue-600 rounded-md hover:bg-blue-700">
              Update Password
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
