"use client"
import { useRef, useState } from "react"
import { toast } from "sonner"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"

type Props = {
  value?: string | null
  onChange: (value: string | null) => void
  fallback?: string
  disabled?: boolean
}

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"]
const MAX_SOURCE_BYTES = 10 * 1024 * 1024
const OUTPUT_SIZE = 256

// The picture is stored on the user record itself, and every avatar in the app
// (header, lock screen, switch-user list) loads it - so it is cut down to a
// small square here, before it ever leaves the browser, instead of shipping a
// multi-megabyte phone photo into the database.
function toSquareDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      const side = Math.min(image.naturalWidth, image.naturalHeight)
      const canvas = document.createElement("canvas")
      canvas.width = OUTPUT_SIZE
      canvas.height = OUTPUT_SIZE
      const context = canvas.getContext("2d")
      if (!context) {
        URL.revokeObjectURL(url)
        reject(new Error("Could not process the image."))
        return
      }
      // JPEG has no transparency, so a transparent PNG would otherwise come
      // out with a black background.
      context.fillStyle = "#ffffff"
      context.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE)
      context.drawImage(
        image,
        (image.naturalWidth - side) / 2,
        (image.naturalHeight - side) / 2,
        side,
        side,
        0,
        0,
        OUTPUT_SIZE,
        OUTPUT_SIZE
      )
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL("image/jpeg", 0.85))
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("That file couldn't be read as an image."))
    }
    image.src = url
  })
}

export default function AvatarUpload({
  value,
  onChange,
  fallback,
  disabled,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [processing, setProcessing] = useState(false)

  const handleFile = async (file?: File) => {
    if (!file) return
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error("Choose a PNG, JPEG or WebP image.")
      return
    }
    if (file.size > MAX_SOURCE_BYTES) {
      toast.error("That image is over 10MB. Choose a smaller one.")
      return
    }
    setProcessing(true)
    try {
      onChange(await toSquareDataUrl(file))
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setProcessing(false)
    }
  }

  const busy = disabled || processing

  return (
    <div className="flex items-center gap-3">
      <Avatar className="size-16">
        <AvatarImage src={value || undefined} className="object-cover" />
        <AvatarFallback className="text-lg">{fallback || "?"}</AvatarFallback>
      </Avatar>
      <div className="flex flex-col items-start gap-1">
        <div className="flex gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            loading={processing}
            onClick={() => inputRef.current?.click()}
          >
            {value ? "Change photo" : "Upload photo"}
          </Button>
          {value && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              className="text-destructive"
              onClick={() => onChange(null)}
            >
              Remove
            </Button>
          )}
        </div>
        <span className="text-xs text-muted-foreground">
          PNG, JPEG or WebP. Cropped to a square.
        </span>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        className="hidden"
        onChange={(event) => {
          handleFile(event.target.files?.[0])
          // Cleared so picking the same file again still fires onChange.
          event.target.value = ""
        }}
      />
    </div>
  )
}
