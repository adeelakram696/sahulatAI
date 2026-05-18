import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  async function resetPassword(formData: FormData) {
    'use server'
    const email = formData.get('email') as string
    const supabase = await createClient()
    
    // Requires setting the correct redirect URL in Supabase dashboard
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/reset`
    })

    if (error) {
      console.error(error)
      // return error
    } else {
      redirect('/auth/signin?message=Check your email for the password reset link')
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="w-full max-w-sm space-y-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Forgot Password</h1>
          <p className="text-muted-foreground text-sm">Enter your email to receive a reset link</p>
        </div>
        
        <form action={resetPassword} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">Email</label>
            <input 
              id="email" 
              name="email" 
              type="email" 
              required 
              className="w-full p-2 border rounded-md" 
            />
          </div>
          
          <button type="submit" className="w-full p-2 text-white bg-blue-600 rounded-md hover:bg-blue-700">
            Send Reset Link
          </button>
        </form>

        <div className="text-center text-sm">
          Remembered your password?{' '}
          <Link href="/auth/signin" className="text-blue-600 hover:underline">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  )
}
