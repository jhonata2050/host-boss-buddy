import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

async function checkDuplicates() {
  console.log("Checking for profile duplicates...");
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, created_at")
    .order("email");

  if (error) {
    console.error("Error fetching profiles:", error);
    return;
  }

  const byEmail: Record<string, any[]> = {};
  data.forEach(p => {
    if (!p.email) return;
    if (!byEmail[p.email]) byEmail[p.email] = [];
    byEmail[p.email].push(p);
  });

  const duplicates = Object.entries(byEmail).filter(([_, list]) => list.length > 1);
  
  if (duplicates.length === 0) {
    console.log("No duplicate emails found in profiles table.");
  } else {
    console.warn("Found duplicate emails in profiles table:");
    duplicates.forEach(([email, list]) => {
      console.log(`- ${email}: ${list.map(p => p.id).join(', ')}`);
    });
  }
}

// This is a diagnostic script to be run in the browser console or via exec if possible.
// Since we can't easily run TS scripts that depend on supabase client via shell, 
// I'll rely on the line_replace logs if the user reproduces it.
