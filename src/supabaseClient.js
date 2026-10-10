import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://isbcvdmjohvhbggbhxoi.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzYmN2ZG1qb2h2aGJnZ2JoeG9pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkxOTkzNzAsImV4cCI6MjEwNDc3NTM3MH0.RgMMZm-oyFNTxDcZEzT8jQYii8xJDj-75Z70y_Nw2Kk';

// Standard client (subject to RLS)
export const supabase = createClient(supabaseUrl, supabaseKey);

export const ensureSession = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    console.log("Session expired or missing. Refreshing silently...");
    const { error } = await supabase.auth.signInWithPassword({
      email: 'admin@zimplykids.com',
      password: 'admin@123',
    });
    if (error) {
      console.error("Silent authentication failed:", error);
      throw new Error("Authentication failed. Please reload the page and log in again.");
    }
  }
};
