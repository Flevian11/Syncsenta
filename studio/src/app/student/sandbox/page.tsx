'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Compatibility entrypoint. The interactive canvas studio now lives at
 * /student/learn_by_making; preserve existing bookmarks and deployed links.
 */
export default function SandboxCompatibilityPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace(`/student/learn_by_making${window.location.search}`)
  }, [router])

  return <div className="min-h-screen bg-teal-400" aria-label="Opening Learn by Making" />
}
