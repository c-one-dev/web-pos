"use client"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { useRegisterStore } from "@/hooks/use-register"
import { useMutation, useQuery } from "@apollo/client/react"
import { gql } from "@apollo/client"
import { ButtonGroup } from "@/components/ui/button-group"
import { Input } from "@/components/ui/input"
import {
  CaretDownIcon,
  CheckIcon,
  DotIcon,
  GraduationCapIcon,
  PlusCircleIcon,
  TrashSimpleIcon,
} from "@phosphor-icons/react"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { use, useEffect, useState, useTransition } from "react"
import Image from "next/image"
import { cn } from "@/lib/utils"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { IOption } from "@/types/shared.type"
import { IProduct } from "@/types/product.type"
import z from "zod"
import { useForm, useStore } from "@tanstack/react-form"
import { Field } from "@/components/ui/field"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { saleSchema } from "@/validators/sale.validator"
import AddCustomer from "./_dialogs/add-customer"
import PerItem from "./_dialogs/per-item"
import TotalDiscount from "./_dialogs/total-discount"
import Pay from "./_dialogs/pay"
import { toast } from "sonner"
import { Spinner } from "@/components/ui/spinner"

const GENERATE_SALE = gql`
  mutation GenerateSale($input: SaleInput) {
    generateSale(input: $input) {
      ok
      message
    }
  }
`

const GET_REGISTER = gql`
  query ProcessedRegister($_id: ID!) {
    processedRegister(_id: $_id) {
      _id
      name
      prefix
      outlet {
        _id
        name
      }
      products {
        _id
        image
        sku
        name
        barcode
        description
        currentPrice
        type {
          _id
          name
        }
      }
      productTypes {
        _id
        name
      }
      paymentMethods {
        _id
        name
      }
    }
  }
`

function DiscardDialog({ discard }: { discard: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="link" className="text-destructive">
          Discard
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Discard Sale?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete this
            transaction and its content.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction className="bg-red-600" onClick={discard}>
            Yes, Discard
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export default function Page() {
  const [isPending, startTransition] = useTransition()
  const params = useParams()
  const { setRegister } = useRegisterStore()
  const { data, loading } = useQuery(GET_REGISTER, {
    variables: { _id: params.id },
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "network-only",
  })
  const register = (data as any)?.processedRegister || null
  const router = useRouter()
  const [selectedType, setSelectedType] = useState<string>("")
  const [generateSale] = useMutation(GENERATE_SALE)
  const [openPay, setOpenPay] = useState(false)

  useEffect(() => {
    if (register && register.productTypes.length > 0)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedType(register.productTypes[0]._id)
  }, [register])

  const [openSearchCommand, setOpenSearchCommand] = useState(false)

  const form = useForm({
    defaultValues: {
      customer: "",
      items: [] as any,
      payments: [] as any,
      discount: 0,
      subTotal: 0,
      total: 0,
      notes: "",
      receivedAmount: 0,
      changeAmount: 0,
      netAmount: 0,
      register: register?._id || "",
    },
    onSubmit: ({ value: payload }: any) =>
      startTransition(async () => {
        try {
          if (payload.receivedAmount < payload.total) {
            toast.error("Received amount cannot be less than total")
            return
          }
          const result = await generateSale({
            variables: {
              input: {
                ...payload,
              },
            },
          })
          if ((result.data as any).generateSale.ok) {
            form.reset()
            toast.success((result.data as any).generateSale.message)
            setOpenPay(false)
          }
        } catch (error: any) {
          console.error(JSON.stringify(error, null, 2))
          throw error
        }
      }),
  })

  useEffect(() => {
    form.setFieldValue("register", register?._id || "")
  }, [register?._id, form])

  const items = useStore(form.store, (state) => state.values.items)
  const discount = useStore(form.store, (state) => state.values.discount)

  useEffect(() => {
    if (items.length > 0) {
      const total = items.reduce((acc: any, curr: any) => acc + curr.total, 0)
      form.setFieldValue("subTotal", total)
      form.setFieldValue("total", total - discount)
    } else {
      form.setFieldValue("discount", 0)
      form.setFieldValue("total", 0)
    }
  }, [items, form, discount])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner className="size-10 text-primary" />
      </div>
    )
  }

  return (
    <form
      id="sale-form"
      onSubmit={(e) => {
        e.preventDefault()
        form.handleSubmit()
      }}
      className="flex h-full w-full"
    >
      <form.Subscribe
        selector={(state) => state.values}
        // eslint-disable-next-line react/no-children-prop
        children={(state) => {
          return (
            <>
              <div className="flex-1 flex-col space-y-1.5 bg-muted p-2.5">
                <div>
                  <Breadcrumb>
                    <BreadcrumbList>
                      <BreadcrumbItem>
                        <BreadcrumbLink>
                          {register?.outlet?.name}
                        </BreadcrumbLink>
                      </BreadcrumbItem>
                      <BreadcrumbSeparator />
                      <BreadcrumbItem>
                        <BreadcrumbPage
                          className="cursor-pointer hover:underline"
                          onClick={() => {
                            router.push("/process")
                            setRegister("")
                          }}
                        >
                          {register?.name || params.id}
                        </BreadcrumbPage>
                      </BreadcrumbItem>
                    </BreadcrumbList>
                  </Breadcrumb>
                </div>
                <div className="flex">
                  <Popover
                    open={openSearchCommand}
                    onOpenChange={setOpenSearchCommand}
                  >
                    <PopoverTrigger asChild>
                      <ButtonGroup className="w-full bg-white">
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={openSearchCommand}
                          className={cn(
                            "font-base flex-1 justify-between border-r-transparent bg-white text-muted-foreground capitalize hover:bg-transparent hover:text-muted-foreground"
                          )}
                          type="button"
                        >
                          Search SKU, Barcode / Product Name
                        </Button>
                      </ButtonGroup>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0">
                      <Command>
                        <CommandInput placeholder="Search products" />
                        <CommandList>
                          <CommandEmpty>No option/s found.</CommandEmpty>
                          <CommandGroup>
                            {register?.products?.map((product: IProduct) => (
                              <CommandItem
                                key={product._id.toString()}
                                value={product._id.toString()}
                              >
                                <span className="block">{product.name}</span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <ButtonGroup>
                    <Button
                      variant="outline"
                      disabled
                      size="icon"
                      className="font-base"
                      type="button"
                    >
                      <GraduationCapIcon />
                    </Button>
                    <Button
                      variant="outline"
                      disabled
                      className="font-base"
                      type="button"
                    >
                      Gift Card
                    </Button>
                    <Button
                      variant="outline"
                      disabled
                      className="font-base"
                      type="button"
                    >
                      Custom Sale
                    </Button>
                  </ButtonGroup>
                </div>
                <ButtonGroup>
                  {register?.productTypes.map((type: any, index: number) => (
                    <Button
                      key={index}
                      variant="outline"
                      className={cn(
                        "font-base cursor-pointer",
                        selectedType === type._id &&
                          "bg-blue-400 text-primary-foreground hover:bg-blue-400/80 hover:text-white"
                      )}
                      onClick={() => setSelectedType(type._id)}
                      type="button"
                    >
                      {type.name}
                    </Button>
                  ))}
                </ButtonGroup>
                <div className="grid gap-2.5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
                  {register?.products
                    .filter((p: any) => selectedType === p.type._id)
                    .map((product: any) => (
                      <div
                        key={product._id}
                        className="flex h-45 flex-col border hover:cursor-pointer hover:drop-shadow"
                        onClick={() => {
                          form.setFieldValue(
                            "items",
                            (() => {
                              const currentItems = state.items
                              const existingItem = currentItems.find(
                                (item: any) => {
                                  return (
                                    product._id === item.product &&
                                    item.price == item.snapshotPrice
                                  )
                                }
                              )

                              if (existingItem) {
                                return currentItems.map((item: any) => {
                                  if (
                                    existingItem.product === item.product &&
                                    item.price == item.snapshotPrice
                                  ) {
                                    const newQty = item.quantity + 1
                                    const itemPrice =
                                      item.snapshotPrice - item.discount
                                    return {
                                      ...item,
                                      subTotal: item.snapshotPrice * newQty,
                                      quantity: newQty,
                                      price: itemPrice,
                                      total: itemPrice * newQty,
                                    }
                                  } else return item
                                })
                              }

                              return [
                                ...form.getFieldValue("items"),
                                {
                                  product: product._id,
                                  snapshotPrice: product.currentPrice,
                                  snapshotName: product.name,
                                  quantity: 1,
                                  price: product.currentPrice,
                                  subTotal: product.currentPrice,
                                  discount: 0,
                                  total: product.currentPrice,
                                },
                              ]
                            })()
                          )
                        }}
                      >
                        <div className="flex flex-1 items-center justify-center bg-slate-300">
                          <span className="text-6xl font-semibold text-muted uppercase">
                            {(() => {
                              const image = product.image?.[0]
                              if (image)
                                return (
                                  <Image
                                    src={image}
                                    alt={product.name}
                                    className="h-16 w-16 object-cover"
                                  />
                                )
                              const nameArray = product.name.split(" ")
                              if (nameArray.length > 1)
                                return `${nameArray[0][0]}`
                              else return `${product.name[0]}${product.name[1]}`
                            })()}
                          </span>
                        </div>
                        <div className="bg-white">
                          <span className="block text-center text-sm font-medium">
                            {product.name}
                          </span>
                          <span className="block text-center text-[0.65rem] text-muted-foreground">
                            {new Intl.NumberFormat("en-PH", {
                              style: "currency",
                              currency: "PHP",
                            }).format(product.currentPrice)}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
              <div className="flex w-96 flex-col justify-between gap-2.5 p-2">
                <AddCustomer form={form} />
                <div className="flex flex-1 flex-col items-start justify-start overflow-y-auto">
                  {state.items.length > 0 && (
                    <div className="flex max-h-96 w-full flex-col gap-2.5">
                      {state.items.map((item: any, index: number) => {
                        return (
                          <PerItem
                            form={form}
                            state={state}
                            index={index}
                            key={index}
                          >
                            <div
                              key={index}
                              className="relative flex items-start justify-start border"
                            >
                              <div className="absolute flex h-5.5 w-5.5 items-center justify-center rounded-full bg-primary">
                                <span className="block text-sm text-white">
                                  {item.quantity}
                                </span>
                              </div>
                              <div className="flex h-16 w-16 items-center justify-center bg-slate-300">
                                <span className="text-3xl font-semibold text-muted uppercase">
                                  {(() => {
                                    const nameArray =
                                      item.snapshotName.split(" ")
                                    if (nameArray.length > 1)
                                      return `${nameArray[0][0]}`
                                    else
                                      return `${item.snapshotName[0]}${item.snapshotName[1]}`
                                  })()}
                                </span>
                              </div>
                              <div className="flex flex-1 items-start justify-between p-2">
                                <span className="block text-sm">
                                  {item.snapshotName}
                                </span>
                                <div className="text-right">
                                  <span className="block text-sm font-medium">
                                    {new Intl.NumberFormat("en-PH", {
                                      style: "currency",
                                      currency: "PHP",
                                    }).format(item.total)}
                                  </span>
                                  {item.discount > 0 && (
                                    <>
                                      <span className="block text-sm text-muted-foreground">
                                        <span className="line-through">
                                          {new Intl.NumberFormat("en-PH", {
                                            style: "currency",
                                            currency: "PHP",
                                          }).format(
                                            item.quantity * item.snapshotPrice
                                          )}
                                        </span>
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                className="h-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                                size="icon-sm"
                                onClick={() => {
                                  form.setFieldValue(
                                    "items",
                                    form
                                      .getFieldValue("items")
                                      .filter(
                                        (_: any, i: number) => i !== index
                                      )
                                  )
                                }}
                                type="button"
                              >
                                <TrashSimpleIcon />
                              </Button>
                            </div>
                          </PerItem>
                        )
                      })}
                    </div>
                  )}
                </div>
                <div>
                  <div>
                    <Accordion
                      type="multiple"
                      className="list-none"
                      defaultValue={["summary"]}
                    >
                      <AccordionItem value="notes">
                        <AccordionTrigger className="text-primary hover:underline-offset-2">
                          Notes{" "}
                          {state.notes && (
                            <span className="font-bold text-destructive">
                              *
                            </span>
                          )}
                        </AccordionTrigger>
                        <AccordionContent className="h-fit px-2.5">
                          <Textarea
                            placeholder="Add notes for this sale"
                            onChange={(e) =>
                              form.setFieldValue("notes", e.target.value)
                            }
                            value={state.notes}
                          />
                        </AccordionContent>
                      </AccordionItem>
                      <AccordionItem
                        value="summary"
                        className="border-b border-dashed"
                      >
                        <AccordionTrigger className="text-primary hover:underline-offset-2">
                          Summary
                        </AccordionTrigger>
                        <AccordionContent className="h-fit px-2.5">
                          <TotalDiscount form={form} state={state}>
                            <div className="space-y-1">
                              {state.discount > 0 && (
                                <div className="flex items-center justify-between">
                                  <span>Subtotal</span>
                                  <span className="text-muted-foreground line-through">
                                    {new Intl.NumberFormat("en-PH", {
                                      style: "currency",
                                      currency: "PHP",
                                    }).format(state.subTotal)}
                                  </span>
                                </div>
                              )}
                              <Separator />
                              {state.discount > 0 ? (
                                <>
                                  <div className="flex items-center justify-between text-blue-800">
                                    <span>Discount</span>
                                    <div>
                                      <span className="text-blue">
                                        -{" "}
                                        {new Intl.NumberFormat("en-PH", {
                                          style: "currency",
                                          currency: "PHP",
                                        }).format(state.discount)}
                                      </span>
                                    </div>
                                  </div>
                                  <Separator />
                                </>
                              ) : (
                                ""
                              )}

                              <div className="flex items-center justify-between font-semibold">
                                <span>
                                  Total (Items:{" "}
                                  {state.items.reduce(
                                    (acc: any, curr: any) =>
                                      acc + curr.quantity,
                                    0
                                  )}
                                  )
                                </span>
                                <span>
                                  {new Intl.NumberFormat("en-PH", {
                                    style: "currency",
                                    currency: "PHP",
                                  }).format(state.total)}
                                </span>
                              </div>
                            </div>
                          </TotalDiscount>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </div>
                  <div>
                    <DiscardDialog discard={() => form.reset()} />
                    <Pay
                      form={form}
                      state={state}
                      register={register}
                      open={openPay}
                      setOpen={setOpenPay}
                    >
                      <Button
                        className="flex h-20 w-full justify-between p-3.5 text-2xl"
                        form="sale-form"
                        type="button"
                        disabled={state.items.length === 0}
                        loading={isPending}
                      >
                        <span>Pay</span>
                        <span>
                          {new Intl.NumberFormat("en-PH", {
                            style: "currency",
                            currency: "PHP",
                          }).format(state.total)}
                        </span>
                      </Button>
                    </Pay>
                  </div>
                </div>
              </div>
            </>
          )
        }}
      />
    </form>
  )
}
