import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default function ResetPasswordPage() {
  async function updatePassword(formData: FormData) {
    'use server'
    const password = formData.get('password') as string
    const supabase = await createClient()
    
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      console.error(error)
      // return error
    } else {
      redirect('/auth/signin?message=Password updated successfully')
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="w-full max-w-sm space-y-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Reset Password</h1>
          <p className="text-muted-foreground text-sm">Enter your new password below</p>
        </div>
        
        <form action={updatePassword} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium">New Password</label>
            <input 
              id="password" 
              name="password" 
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
  )
}
