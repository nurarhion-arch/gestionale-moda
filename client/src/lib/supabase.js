import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL ?? "https://giwufxumvyvitqmysrup.supabase.co";
const anonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ?? "sb_publishable_mTa0DUTQBaGR2c8ISLuG_A_uzXtNpYo";

export const supabase = createClient(url, anonKey);
