"use client"
import { useMutation } from "@apollo/client/react"
import gql from "graphql-tag"
import { useForm } from "@tanstack/react-form"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import { useTransition } from "react"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { PasswordInput } from "@/components/ui/password-input"
import { Separator } from "@/components/ui/separator"

const CHANGE_PASSWORD = gql`
  mutation ChangePassword($oldPassword: String!, $newPassword: String!) {
    changePassword(oldPassword: $oldPassword, newPassword: $newPassword) {
      ok
      message
    }
  }
`

const changePasswordSchema = z
  .object({
    oldPassword: z.string().nonempty("Current password is required."),
    newPassword: z
      .string()
      .min(8, "New password must be at least 8 characters."),
    confirmPassword: z.string().nonempty("Please confirm your new password."),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  })

export default function ChangePasswordForm() {
  const [isPending, startTransition] = useTransition()
  const { update } = useSession()
  const [changePassword] = useMutation(CHANGE_PASSWORD)

  const form = useForm({
    defaultValues: {
      oldPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
    validators: {
      onSubmit: changePasswordSchema,
    },
    onSubmit: ({ value }: any) =>
      startTransition(async () => {
        try {
          const result: any = await changePassword({
            variables: {
              oldPassword: value.oldPassword,
              newPassword: value.newPassword,
            },
          })
          if (result.data.changePassword.ok) {
            toast.success(result.data.changePassword.message)
            await update({ mustChangePassword: false })
          }
        } catch (error: any) {
          toast.error(error.graphQLErrors?.[0]?.message ?? error.message)
        }
      }),
  })

  return (
    <div className="w-full max-w-sm space-y-2">
      <div className="flex flex-col">
        <span className="font-heading text-sm font-medium">
          Set a new password
        </span>
        <span className="text-xs/relaxed text-muted-foreground">
          You&apos;re signed in with a temporary password. Choose a new one to
          continue.
        </span>
      </div>
      <form
        id="change-password-form"
        onSubmit={(e) => {
          e.preventDefault()
          form.handleSubmit()
        }}
      >
        <FieldGroup className="-space-y-2">
          <form.Field name="oldPassword">
            {(field) => {
              const isInvalid =
                field.state.meta.isTouched && !field.state.meta.isValid
              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor={field.name}>
                    Current (temporary) password
                  </FieldLabel>
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
          <form.Field name="newPassword">
            {(field) => {
              const isInvalid =
                field.state.meta.isTouched && !field.state.meta.isValid
              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor={field.name}>New password</FieldLabel>
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
          <form.Field name="confirmPassword">
            {(field) => {
              const isInvalid =
                field.state.meta.isTouched && !field.state.meta.isValid
              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor={field.name}>
                    Confirm new password
                  </FieldLabel>
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
      <Separator className="my-2" />
      <Button
        form="change-password-form"
        type="submit"
        className="w-full"
        disabled={isPending}
        loading={isPending}
      >
        Update Password
      </Button>
    </div>
  )
}
