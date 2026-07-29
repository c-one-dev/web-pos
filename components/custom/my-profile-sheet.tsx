"use client"
import { useEffect, useState, useTransition, ReactNode } from "react"
import { useMutation, useQuery } from "@apollo/client/react"
import gql from "graphql-tag"
import { useForm } from "@tanstack/react-form"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldLabel, FieldSet } from "@/components/ui/field"
import { InputGroup, InputGroupInput } from "@/components/ui/input-group"
import { PasswordInput } from "@/components/ui/password-input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

const GET_MY_PROFILE = gql`
  query MyProfile($_id: ID!) {
    user(_id: $_id) {
      _id
      image
      name
      surname
      displayName
      email
      username
      role
    }
  }
`

const UPDATE_MY_PROFILE = gql`
  mutation UpdateMyProfile($id: ID!, $input: UserInput!) {
    updateUser(_id: $id, input: $input) {
      ok
      message
    }
  }
`

type Props = {
  children: ReactNode
}

export default function MyProfileSheet({ children }: Props) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const { data: session, update }: any = useSession()
  const currentUserId = session?.user?._id

  const { data }: any = useQuery(GET_MY_PROFILE, {
    variables: { _id: currentUserId },
    fetchPolicy: "network-only",
    nextFetchPolicy: "cache-first",
    skip: !currentUserId || !open,
  })
  const [updateProfile] = useMutation(UPDATE_MY_PROFILE)

  const profile = data?.user

  const form = useForm({
    defaultValues: {
      name: "",
      surname: "",
      displayName: "",
      email: "",
      username: "",
      role: "",
      pin: "",
    },
    onSubmit: ({ value }: any) =>
      startTransition(async () => {
        try {
          const input: Record<string, any> = {
            name: value.name,
            surname: value.surname,
            displayName: value.displayName,
            email: value.email,
            username: value.username,
            role: value.role,
          }
          if (value.pin) input.pin = value.pin

          const result: any = await updateProfile({
            variables: { id: currentUserId, input },
          })
          if (result.data.updateUser.ok) {
            toast.success(result.data.updateUser.message)
            if (value.name !== session?.user?.name)
              await update({ name: value.name })
            form.setFieldValue("pin", "")
            setOpen(false)
          }
        } catch (error: any) {
          toast.error(error.graphQLErrors?.[0]?.message ?? error.message)
        }
      }),
  })

  useEffect(() => {
    if (profile) {
      form.setFieldValue("name", profile.name)
      form.setFieldValue("surname", profile.surname)
      form.setFieldValue("displayName", profile.displayName)
      form.setFieldValue("email", profile.email || "")
      form.setFieldValue("username", profile.username)
      form.setFieldValue("role", profile.role)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile])

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>My Profile</SheetTitle>
          <SheetDescription>
            View and update your own account details.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4">
          <div className="flex items-center gap-3">
            <Avatar className="size-16">
              <AvatarImage src={profile?.image || undefined} />
              <AvatarFallback className="text-lg">
                {profile?.name?.[0]}
                {profile?.surname?.[0]}
              </AvatarFallback>
            </Avatar>
            <div className="-space-y-0.5">
              <span className="block font-medium capitalize">
                {profile?.role?.toLowerCase()}
              </span>
              <span className="block text-xs text-muted-foreground">
                @{profile?.username}
              </span>
            </div>
          </div>
          <form
            id="my-profile-form"
            onSubmit={(e) => {
              e.preventDefault()
              form.handleSubmit()
            }}
          >
            <FieldSet>
              <form.Field name="name">
                {(field) => (
                  <Field>
                    <FieldLabel htmlFor={field.name}>Name</FieldLabel>
                    <InputGroup className="-my-1">
                      <InputGroupInput
                        disabled={isPending}
                        id={field.name}
                        name={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                      />
                    </InputGroup>
                  </Field>
                )}
              </form.Field>
              <form.Field name="surname">
                {(field) => (
                  <Field>
                    <FieldLabel htmlFor={field.name}>Surname</FieldLabel>
                    <InputGroup className="-my-1">
                      <InputGroupInput
                        disabled={isPending}
                        id={field.name}
                        name={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                      />
                    </InputGroup>
                  </Field>
                )}
              </form.Field>
              <form.Field name="displayName">
                {(field) => (
                  <Field>
                    <FieldLabel htmlFor={field.name}>Display Name</FieldLabel>
                    <InputGroup className="-my-1">
                      <InputGroupInput
                        disabled={isPending}
                        id={field.name}
                        name={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                      />
                    </InputGroup>
                  </Field>
                )}
              </form.Field>
              <form.Field name="email">
                {(field) => (
                  <Field>
                    <FieldLabel htmlFor={field.name}>Email</FieldLabel>
                    <InputGroup className="-my-1">
                      <InputGroupInput
                        type="email"
                        disabled={isPending}
                        id={field.name}
                        name={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                      />
                    </InputGroup>
                  </Field>
                )}
              </form.Field>
              <form.Field name="username">
                {(field) => (
                  <Field>
                    <FieldLabel htmlFor={field.name}>Username</FieldLabel>
                    <InputGroup className="-my-1">
                      <InputGroupInput
                        disabled={isPending}
                        id={field.name}
                        name={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                      />
                    </InputGroup>
                  </Field>
                )}
              </form.Field>
              <form.Field name="pin">
                {(field) => (
                  <Field>
                    <FieldLabel htmlFor={field.name}>New PIN</FieldLabel>
                    <PasswordInput
                      toggleLabel="PIN"
                      groupClassName="-my-1"
                      placeholder="Leave blank to keep current PIN"
                      disabled={isPending}
                      id={field.name}
                      name={field.name}
                      inputMode="numeric"
                      maxLength={4}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) =>
                        field.handleChange(
                          e.target.value.replace(/\D/g, "").slice(0, 4)
                        )
                      }
                    />
                  </Field>
                )}
              </form.Field>
            </FieldSet>
          </form>
        </div>
        <SheetFooter className="flex-row">
          <SheetClose asChild>
            <Button variant="outline" className="flex-1">
              Cancel
            </Button>
          </SheetClose>
          <Button
            form="my-profile-form"
            type="submit"
            className="flex-1"
            disabled={isPending}
            loading={isPending}
          >
            Save
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
