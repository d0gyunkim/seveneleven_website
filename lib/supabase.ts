import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://awvjrfokbhvuvllsiimp.supabase.co'
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3dmpyZm9rYmh2dXZsbHNpaW1wIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mjk1ODI2OCwiZXhwIjoyMDc4NTM0MjY4fQ.1eGceZuq9JpWG_oO8CDz4REiX5pRBveBv2ElegIzOx4'

if (!supabaseUrl || !supabaseKey) {
  console.warn('Supabase URL 또는 KEY가 설정되지 않았습니다.')
}

export const supabase = createClient(supabaseUrl, supabaseKey)

