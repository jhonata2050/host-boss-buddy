
import { supabaseAdmin } from './src/integrations/supabase/client.server.js';

async function checkEmails() {
  const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers();
  if (error) {
    console.error(error);
    return;
  }

  const emailCounts = {};
  users.forEach(user => {
    emailCounts[user.email] = (emailCounts[user.email] || 0) + 1;
  });

  const duplicates = Object.entries(emailCounts).filter(([email, count]) => count > 1);
  console.log('Duplicate emails in auth.users:', duplicates);
  
  if (duplicates.length > 0) {
    duplicates.forEach(([email]) => {
      const usersWithEmail = users.filter(u => u.email === email);
      console.log(`Users with email ${email}:`, usersWithEmail.map(u => ({ id: u.id, role: u.role, created_at: u.created_at })));
    });
  } else {
    console.log('No duplicate emails found in auth.users.');
  }
}

checkEmails();
