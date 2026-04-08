"use client"
import { Button } from "@/components/ui/button"
import { Separator } from "../ui/separator"
import { signIn, useSession } from "next-auth/react"
import { useForm } from "@tanstack/react-form"
import { z } from "zod"
import { Field, FieldError, FieldGroup, FieldLabel } from "../ui/field"
import { InputGroup, InputGroupInput } from "../ui/input-group"
import { usePathname, useRouter } from "next/navigation"
import { useEffect } from "react"

const signInSchema = z.object({
  username: z.string().nonempty("Employee number must not be empty."),
  password: z.string().nonempty("Password must not be empty."),
})

function LoginForm() {
  const router = useRouter()

  const form = useForm({
    defaultValues: {
      username: "",
      password: "",
    },
    validators: {
      onSubmit: signInSchema,
    },
    onSubmit: async ({ value: payload }: any) => {
      try {
        const response = await signIn("credentials", {
          username: payload.username,
          password: payload.password,
          redirect: false,
        })
        if (response?.ok) router.push("/dashboard")
      } catch (error) {
        console.error(error)
        throw error
      }
    },
  })

  return (
    <div className="space-y-2">
      <div className="flex flex-col">
        <span className="font-heading text-sm font-medium">
          Login to your account
        </span>
        <span className="text-xs/relaxed text-muted-foreground">
          Enter your credentials below to login to your account.
        </span>
      </div>
      <div>
        <form
          id="sign-in-form"
          onSubmit={(e) => {
            e.preventDefault()
            form.handleSubmit()
          }}
        >
          <FieldGroup className="-space-y-2">
            <form.Field name="username">
              {(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>Username</FieldLabel>
                    <InputGroup>
                      <InputGroupInput
                        id={field.name}
                        name={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) =>
                          field.handleChange(e.target.value.toLocaleLowerCase())
                        }
                        placeholder="Enter your username"
                        aria-invalid={isInvalid}
                      />
                    </InputGroup>
                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
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
                    <InputGroup>
                      <InputGroupInput
                        id={field.name}
                        name={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        aria-invalid={isInvalid}
                        placeholder="Enter your password"
                        type="password"
                      />
                    </InputGroup>
                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                )
              }}
            </form.Field>
          </FieldGroup>
        </form>
        <Separator className="my-2" />
        <Button form="sign-in-form" type="submit" className="w-full">
          Login
        </Button>
        <Button variant="link" className="w-full">
          Forgot your password?
        </Button>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <div className="flex h-screen w-full justify-end bg-primary/20">
      <div className="flex w-full flex-col items-center justify-center border border-r bg-background xl:w-md">
        <LoginForm />
        <div className="absolute bottom-4">
          <span className="text-xs">© C-ONE 2026 ☕</span>
        </div>
      </div>
    </div>
  )
}
