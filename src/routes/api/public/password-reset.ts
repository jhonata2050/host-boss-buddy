import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { supabaseAdmin } from '@/integrations/supabase/client.server'

export const Route = createFileRoute('/api/public/password-reset')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { email } = await request.json()
          
          if (!email || !z.string().email().safeParse(email).success) {
            return new Response(JSON.stringify({ error: 'E-mail inválido' }), { 
              status: 400,
              headers: { 'Content-Type': 'application/json' }
            })
          }

          // Supabase handle password reset email
          const { error } = await supabaseAdmin.auth.admin.generateLink({
            type: 'recovery',
            email: email,
            options: {
              redirectTo: `${new URL(request.url).origin}/auth/reset-password`
            }
          })

          if (error) {
            console.error('[PasswordReset] Error:', error)
            // We return 200 even on error to avoid email enumeration
          }

          return new Response(JSON.stringify({ success: true }), { 
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })
        } catch (err) {
          return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 })
        }
      }
    }
  }
})
