'use client'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function CampoIndex() {
  const router = useRouter()
  useEffect(() => { router.push('/campo/lancar') }, [])
  return null
}
