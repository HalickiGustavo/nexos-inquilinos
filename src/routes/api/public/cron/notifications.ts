import { createFileRoute } from '@tanstack/react-router'
import { processNotificationQueue } from '@/lib/notifications-cron.server'

export const Route = createFileRoute('/api/public/cron/notifications')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        // Simple security: check for a secret header or IP if possible
        // In a real scenario, use a secret token
        const authHeader = request.headers.get('Authorization')
        if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
          return new Response('Unauthorized', { status: 401 })
        }

        try {
          await processNotificationQueue()
          return new Response('OK', { status: 200 })
        } catch (error: any) {
          console.error('Cron error:', error)
          return new Response(`Error: ${error.message}`, { status: 500 })
        }
      }
    }
  }
})
