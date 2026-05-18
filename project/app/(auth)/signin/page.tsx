import { login } from '@/app/actions/auth'
import Link from 'next/link'

export default function SignInPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="w-full max-w-sm space-y-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Sign In to SahuliatAI</h1>
          <p className="text-muted-foreground text-sm">Welcome back</p>
        </div>
        
        <form action={login} className="space-y-4">
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
          
          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium">Password</label>
            <input 
              id="password" 
              name="password" 
              type="password" 
              required 
              className="w-full p-2 border rounded-md" 
            />
          </div>

          <div className="flex items-center justify-between">
            <Link href="/auth/forgot" className="text-sm text-blue-600 hover:underline">
              Forgot password?
            </Link>
          </div>
          
          <button type="submit" className="w-full p-2 text-white bg-blue-600 rounded-md hover:bg-blue-700">
            Sign In
          </button>
        </form>

        <div className="text-center text-sm">
          Don't have an account?{' '}
          <Link href="/auth/signup" className="text-blue-600 hover:underline">
            Sign up
          </Link>
        </div>
      </div>
    </div>
  )
}
