import { useMutation, useQuery } from "@apollo/client/react"
import gql from "graphql-tag"
import React, { useEffect, useState, useTransition } from "react"
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
import { useForm } from "@tanstack/react-form"
import { userSchema } from "@/validators/user.validator"
import { toast } from "sonner"
import { Field, FieldError, FieldLabel, FieldSet } from "@/components/ui/field"
import { InputGroup, InputGroupInput } from "@/components/ui/input-group"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { Role } from "@/types/user.type"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const CREATE_USER = gql`
  mutation CreateUser($input: UserInput!) {
    createUser(input: $input) {
      ok
      message
      data
    }
  }
`

const UPDATE_USER = gql`
  mutation UpdateUser($id: ID!, $input: UserInput!) {
    updateUser(_id: $id, input: $input) {
      ok
      message
      data
    }
  }
`

const FETCH_USER = gql`
  query User($_id: ID!) {
    user(_id: $_id) {
      _id
      name
      surname
      displayName
      email
      username
      role
      pin
    }
  }
`

type Props = {
  _id?: string
  onClose?: () => void
}

export default function FormDialog({ _id, onClose }: Props) {
  const isUpdate = Boolean(_id)
  const [open, setOpen] = useState<boolean>(false)
  const [isPending, startTransition] = useTransition()
  const [createUser] = useMutation(CREATE_USER, {
    updateQueries: {
      UserTable: (prev, { mutationResult }: any) => {
        if (!mutationResult.data.createUser.ok) return prev
        const newUser = mutationResult.data.createUser.data
        return {
          ...prev,
          userTable: {
            ...prev.userTable,
            edges: [
              ...prev.userTable.edges,
              {
                node: newUser.node,
                __typename: "UserEdge",
                cursor: newUser.cursor,
              },
            ],
          },
        }
      },
    },
  })
  const [updateUser] = useMutation(UPDATE_USER, {
    updateQueries: {
      UserTable: (prev, { mutationResult }: any) => {
        if (!mutationResult.data.updateUser.ok) return prev
        const updatedUser = mutationResult.data.updateUser.data
        const updatedEdges = prev.userTable.edges.map((edge: any) =>
          edge.node._id === updatedUser._id
            ? { ...edge, node: { ...edge.node, ...updatedUser } }
            : edge
        )
        return {
          ...prev,
          userTable: {
            ...prev.userTable,
            edges: updatedEdges,
          },
        }
      },
    },
  })
  const { data }: any = useQuery(FETCH_USER, {
    variables: {
      _id,
    },
    fetchPolicy: "network-only",
    nextFetchPolicy: "cache-first",
    skip: !isUpdate || !open,
  })

  const form = useForm({
    defaultValues: {
      name: "",
      surname: "",
      displayName: "",
      email: "",
      username: "",
      role: Role.CASHIER,
      pin: "",
    },
    validators: {
      onSubmit: ({ formApi, value }: any) => {
        try {
          userSchema.parse(value)
        } catch (error: any) {
          JSON.parse(error).map(({ path, message }: any) => {
            const pathName = path.join(".")
            formApi.fieldInfo[pathName].instance?.setErrorMap({
              onSubmit: { message },
            })
          })
        }
      },
    },
    onSubmit: ({ value }: any) =>
      startTransition(async () => {
        try {
          const payload = {
            name: value.name,
            surname: value.surname,
            displayName: value.displayName,
            email: value.email,
            username: value.username,
            role: value.role,
            pin: value.pin,
          }

          const result: any = isUpdate
            ? await updateUser({
                variables: {
                  id: _id,
                  input: payload,
                },
              })
            : await createUser({
                variables: {
                  input: payload,
                },
              })

          if (result.data.createUser?.ok || result.data.updateUser?.ok) {
            setOpen(false)
            toast.success(
              result.data.createUser?.message || result.data.updateUser?.message
            )
            onClose?.()
            form.reset()
          }
        } catch (error: any) {
          toast.error(error.graphQLErrors?.[0]?.message ?? error.message)
        }
      }),
  })

  useEffect(() => {
    if (data?.user) {
      form.setFieldValue("name", data.user.name)
      form.setFieldValue("surname", data.user.surname)
      form.setFieldValue("displayName", data.user.displayName)
      form.setFieldValue("email", data.user.email)
      form.setFieldValue("username", data.user.username)
      form.setFieldValue("role", data.user.role)
      form.setFieldValue("pin", data.user.pin)
    }
  }, [data, form])

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {isUpdate ? (
          <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
            Edit
          </DropdownMenuItem>
        ) : (
          <Button>Create User</Button>
        )}
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>User Form</SheetTitle>
          <SheetDescription>
            Make changes to your user here. Click save when you&apos;re done.
          </SheetDescription>
        </SheetHeader>
        <div className="px-4">
          <form
            id="user-form"
            onSubmit={(e) => {
              e.preventDefault()
              form.handleSubmit()
            }}
          >
            <FieldSet>
              <form.Field name="name">
                {(field) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>Name</FieldLabel>
                      <InputGroup className="-my-1">
                        <InputGroupInput
                          placeholder="Name"
                          disabled={isPending}
                          id={field.name}
                          name={field.name}
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
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
              <form.Field name="surname">
                {(field) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>Surname</FieldLabel>
                      <InputGroup className="-my-1">
                        <InputGroupInput
                          placeholder="Surname"
                          disabled={isPending}
                          id={field.name}
                          name={field.name}
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
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
              <form.Field name="displayName">
                {(field) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>Display Name</FieldLabel>
                      <InputGroup className="-my-1">
                        <InputGroupInput
                          placeholder="Display Name"
                          disabled={isPending}
                          id={field.name}
                          name={field.name}
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
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
              <form.Field name="email">
                {(field) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>Email</FieldLabel>
                      <InputGroup className="-my-1">
                        <InputGroupInput
                          placeholder="Email"
                          disabled={isPending}
                          type="email"
                          id={field.name}
                          name={field.name}
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
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
              <form.Field name="username">
                {(field) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>Username</FieldLabel>
                      <InputGroup className="-my-1">
                        <InputGroupInput
                          placeholder="Username"
                          disabled={isPending}
                          id={field.name}
                          name={field.name}
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
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
              <form.Field name="role">
                {(field) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>Role</FieldLabel>
                      <Select
                        value={field.state.value}
                        onValueChange={(value) =>
                          field.handleChange(value as Role)
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.values(Role).map((role) => (
                            <SelectItem key={role} value={role}>
                              {role}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  )
                }}
              </form.Field>
              <form.Field name="pin">
                {(field) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>Pin</FieldLabel>
                      <InputGroup className="-my-1">
                        <InputGroupInput
                          placeholder="Pin"
                          disabled={isPending}
                          id={field.name}
                          name={field.name}
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
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
            </FieldSet>
          </form>
        </div>
        <SheetFooter>
          <Button type="submit" form="user-form" disabled={isPending}>
            Submit
          </Button>
          <SheetClose asChild>
            <Button variant="outline">Cancel</Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
