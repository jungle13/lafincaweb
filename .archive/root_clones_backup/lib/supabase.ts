import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://uexqmrspulhauubzrwyn.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_VhddzdHirUzYfgMe7shYDA_-i7T4xnO';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
