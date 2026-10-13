import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

// Supabase project credentials
export const SUPABASE_URL = "https://haiolainieyptbqcynwp.supabase.co";

// Replace with your project's anon/public key from:
// Supabase Dashboard -> Project Settings -> API -> Project API keys (anon public)
export const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export default supabase;
