import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321'
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseServiceRoleKey) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const adminAuthClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function seed() {
  console.log('Seeding demo accounts...')

  // Demo Customer: Ayesha
  await adminAuthClient.auth.admin.createUser({
    email: 'ayesha@example.com',
    password: 'Demo!1234',
    email_confirm: true,
    user_metadata: { display_name: 'Ayesha Customer' }
  })

  // Demo Provider: Ali AC
  await adminAuthClient.auth.admin.createUser({
    email: 'ali@example.com',
    password: 'Demo!1234',
    email_confirm: true,
    user_metadata: { display_name: 'Ali AC Services' }
  })

  // Demo Provider: Bright Tutors
  await adminAuthClient.auth.admin.createUser({
    email: 'tutor@example.com',
    password: 'Demo!1234',
    email_confirm: true,
    user_metadata: { display_name: 'Bright Tutors' }
  })

  console.log('Done seeding demo accounts.')
}

seed().catch(console.error)
