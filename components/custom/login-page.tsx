"use client"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { signIn } from "next-auth/react"
import { useForm } from "@tanstack/react-form"
import { z } from "zod"
import { Field, FieldError, FieldGroup, FieldLabel } from "../ui/field"
import { InputGroup, InputGroupInput } from "../ui/input-group"
import { PasswordInput } from "../ui/password-input"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useId } from "react"

const signInSchema = z.object({
  username: z.string().nonempty("Email must not be empty."),
  password: z.string().nonempty("Password must not be empty."),
})

function COneLogo() {
  return (
    <div className="flex items-center gap-1.5">
      <svg
        viewBox="0 0 32 24"
        className="h-5 w-7"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M0 24 8 8l4 8 4-8 4 8 4-8 8 16z" fill="var(--primary)" />
      </svg>
      <span className="font-heading text-xl font-bold tracking-tight">
        C-ONE
      </span>
    </div>
  )
}

function LoginIllustration() {
  return (
    <div className="relative hidden h-full flex-1 overflow-hidden bg-[#6EE7C5] lg:block">
      <div
        className="absolute inset-x-0 bottom-0 h-2/3 bg-[#5AD9B4]"
        style={{ borderRadius: "50% 50% 0 0 / 100% 100% 0 0" }}
      />
      <div
        className="absolute -bottom-10 left-0 h-3/5 w-3/5 bg-[#4CCBA6]"
        style={{ borderRadius: "60% 40% 70% 30% / 50% 60% 40% 50%" }}
      />

      <Image
        src="/POS/cart.png"
        alt=""
        width={220}
        height={220}
        className="absolute top-[14%] left-[8%] w-[22%] max-w-40"
      />

      <Image
        src="/POS/Your paragraph text.png"
        alt=""
        width={280}
        height={260}
        className="absolute top-[16%] right-[6%] w-[30%] max-w-72"
      />

      <div
        className="absolute top-[28%] left-1/2 aspect-square w-[54%] max-w-[26rem] -translate-x-1/2 rounded-full bg-gray-500/20"
      />

      <Image
        src="/POS/pc1.png"
        alt=""
        width={320}
        height={300}
        className="absolute top-[30%] left-1/2 w-[46%] max-w-[26rem] -translate-x-1/2"
      />

      <div className="absolute top-[74%] left-1/2 mt-4 -translate-x-1/2 text-center">
        <span className="font-heading text-4xl font-extrabold tracking-tight text-foreground">
          POS
        </span>
        <p className="text-sm text-foreground/70">Point Of Sales</p>
      </div>

      <Image
        src="/POS/receipt.png"
        alt=""
        width={220}
        height={220}
        className="absolute bottom-[6%] left-[6%] w-[22%] max-w-40"
      />

      <Image
        src="/POS/PC.png"
        alt=""
        width={240}
        height={220}
        className="absolute right-[10%] bottom-[8%] w-[26%] max-w-52"
      />

      <span className="absolute top-[8%] left-[45%] size-2 rounded-full bg-white/70" />
      <span className="absolute top-[45%] left-[24%] size-1.5 rounded-full bg-white/70" />
      <span className="absolute right-[30%] bottom-[28%] size-2 rounded-full bg-white/60" />
    </div>
  )
}

function LoginForm() {
  const router = useRouter()
  const rememberId = useId()

  const form = useForm({
    defaultValues: {
      username: "",
      password: "",
    },
    validators: {
      onSubmit: signInSchema,
    },
    onSubmit: async ({ value: payload }) => {
      try {
        const response = await signIn("credentials", {
          username: payload.username,
          password: payload.password,
          redirect: false,
        })
        if (response?.error) throw new Error(response.error)
        if (response?.ok) router.push("/dashboard")
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Sign in failed.")
      }
    },
  })

  return (
    <div className="w-full max-w-sm space-y-6">
      <COneLogo />

      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-bold">Welcome Back</h1>
        <p className="text-sm text-muted-foreground">
          Enter Your POS Email Account and Password to access your account.
        </p>
      </div>

      <form
        id="sign-in-form"
        onSubmit={(e) => {
          e.preventDefault()
          form.handleSubmit()
        }}
      >
        <FieldGroup>
          <form.Field name="username">
            {(field) => {
              const isInvalid =
                field.state.meta.isTouched && !field.state.meta.isValid
              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor={field.name}>Email</FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) =>
                        field.handleChange(e.target.value.toLocaleLowerCase())
                      }
                      aria-invalid={isInvalid}
                    />
                  </InputGroup>
                  {isInvalid && <FieldError errors={field.state.meta.errors} />}
                </Field>
              )
            }}
          </form.Field>
          <form.Field name="password">
            {(field) => {
              const isInvalid =
                field.state.meta.isTouched && !field.state.meta.isValid
              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor={field.name}>Password</FieldLabel>
                  <PasswordInput
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    aria-invalid={isInvalid}
                  />
                  {isInvalid && <FieldError errors={field.state.meta.errors} />}
                </Field>
              )
            }}
          </form.Field>
        </FieldGroup>
      </form>

      <div className="flex items-center gap-2">
        <Checkbox id={rememberId} />
        <label
          htmlFor={rememberId}
          className="text-sm text-muted-foreground select-none"
        >
          Remember Me
        </label>
      </div>

      <Button
        form="sign-in-form"
        type="submit"
        className="w-full bg-[#22C55E] hover:bg-[#1EAF52]"
      >
        Login
      </Button>
    </div>
  )
}

export default function LoginPage() {
  return (
    <div className="relative flex h-screen w-full">
      <LoginIllustration />
      <Image
        src="/POS/bg.png"
        alt=""
        width={260}
        height={220}
        className="absolute -top-16 right-[300px] z-10 hidden w-[440px] max-w-none lg:block"
      />
      <div className="relative z-20 flex w-full flex-col items-center justify-center bg-background px-8 lg:w-[520px]">
        <LoginForm />
        <div className="absolute bottom-4">
          <span className="text-xs text-muted-foreground">
            © 2026 C-ONE. All Rights Reserved.
          </span>
        </div>
      </div>
    </div>
  )
}
