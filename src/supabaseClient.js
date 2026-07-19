import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mhbhuevvwkicqudoicuw.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1oYmh1ZXZ2d2tpY3F1ZG9pY3V3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyOTkwMjksImV4cCI6MjA5OTg3NTAyOX0.m0kryiO07ZsB_9FlVAGrWEGH7FRhk_fFrVAynXiD3B8';

// Standard client (subject to RLS)
export const supabase = createClient(supabaseUrl, supabaseKey);
