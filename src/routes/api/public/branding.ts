import { createFileRoute } from '@tanstack/react-router';
import { getBrandingImplementation } from '@/lib/admin.server';

export const Route = createFileRoute('/api/public/branding')({
  server: {
    handlers: {
      GET: async () => {
        try {
          const branding = await getBrandingImplementation();
          return new Response(JSON.stringify(branding), {
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'public, max-age=300',
            },
          });
        } catch (error) {
          console.error('[API Branding] Error:', error);
          return new Response(JSON.stringify({ error: 'Failed to fetch branding' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      },
    },
  },
});
