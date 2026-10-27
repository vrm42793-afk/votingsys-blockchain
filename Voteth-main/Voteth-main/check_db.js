import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://nxrtcnowotkhluzqtgnz.supabase.co'
const supabaseKey = 'sb_publishable_qV4EyDRyf45SljnDVRLAww_V2ZlKA8x'
const supabase = createClient(supabaseUrl, supabaseKey)

async function checkUser() {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('email, platform_role')

  if (error) {
    console.error('Error fetching users:', error)
  } else {
    console.log('All Users:', data)
  }
}

checkUser()
