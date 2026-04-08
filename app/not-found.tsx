"use client"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

export default function NotFound() {
  const router = useRouter()
  const [countdown, setCountdown] = useState<number>(10)

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1)
    }, 1000)

    if (countdown === 0) {
      router.back()
    }
    return () => clearInterval(timer)
  }, [countdown, router])

  return (
    <div className="grid h-screen w-full place-items-center bg-primary/20">
      <div className="w-fit bg-white px-8 py-4">
        <span className="block text-center text-xl font-medium">
          Oops! The page you are looking for does not exist. Please check the
          URL and try again. 🤔
        </span>
        <span className="block text-center">
          Redirecting back in <span>{countdown}</span> seconds or{" "}
          <span
            onClick={() => router.back()}
            className="text-primary underline hover:cursor-pointer hover:text-primary/70"
          >
            click here to go back immediately.
          </span>
        </span>
      </div>
    </div>
  )
}
