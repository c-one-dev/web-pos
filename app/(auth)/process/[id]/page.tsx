"use client"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { useMutation, useQuery } from "@apollo/client/react"
import { gql } from "@apollo/client"
import { ButtonGroup } from "@/components/ui/button-group"
import { Input } from "@/components/ui/input"
import {
  CashRegisterIcon,
  CaretDownIcon,
  CheckIcon,
  DotIcon,
  ArrowLeftIcon,
  GraduationCapIcon,
  PlusCircleIcon,
  TrashSimpleIcon,
  XIcon,
} from "@phosphor-icons/react"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import {
  Suspense,
  use,
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react"
import Image from "next/image"
import { cn } from "@/lib/utils"
import {
  Command,
  CommandDialog,
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
import SelectRegisterSheet from "./_dialogs/select-register"
import PerItem from "./_dialogs/per-item"
import TotalDiscount from "./_dialogs/total-discount"
import Pay from "./_dialogs/pay"
import ShortcutsDialog from "./_dialogs/shortcuts"
import ShortcutHint from "./_dialogs/shortcut-hint"
import ReceiptDialog from "./_dialogs/receipt"
import { toast } from "sonner"
import { refetchOnlyReadyQueries } from "@/lib/refetch"
import ProcessSaleSkeleton from "@/components/custom/process-sale-skeleton"
import OpenRegisterDialog from "@/components/custom/open-register-dialog"

const GENERATE_SALE = gql`
  mutation GenerateSale($input: SaleInput) {
    generateSale(input: $input) {
      ok
      message
      data
    }
  }
`

const UPDATE_SALE = gql`
  mutation UpdateSale($_id: ID!, $input: SaleInput) {
    updateSale(_id: $_id, input: $input) {
      ok
      message
      data
    }
  }
`

const GET_SALE_FOR_EDIT = gql`
  query SaleForEdit($_id: ID!) {
    sale(_id: $_id) {
      _id
      saleNumber
      subTotal
      discount
      total
      receivedAmount
      changeAmount
      netAmount
      notes
      isEditable
      customer {
        _id
      }
      items {
        snapshotName
        snapshotPrice
        quantity
        discount
        price
        subTotal
        total
        product {
          _id
          name
          image
        }
      }
      payments {
        amount
        change
        note
        reference
        date
        method {
          _id
        }
      }
    }
  }
`

const GET_REGISTER = gql`
  query ProcessedRegister($_id: ID!) {
    processedRegister(_id: $_id) {
      _id
      name
      prefix
      isOpen
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
        # DIGITAL methods (Gcash, Card, BPI QR, bank transfers) need a
        # reference captured at checkout - see pay.tsx.
        type
      }
    }
  }
`

const DRAFT_STORAGE_PREFIX = "pos-sale-draft:"

// Persists the in-progress sale (items, notes, discount, etc.) per register
// so a refresh or navigating away and back doesn't lose the cart.
function loadDraft(registerId: string) {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(`${DRAFT_STORAGE_PREFIX}${registerId}`)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

// Shapes a saved sale back into the cart's form values so an edit starts
// from exactly what was rung up. Fed in as the form's initial values rather
// than reset in afterwards, so there's no window where the cart is empty.
function saleToFormValues(sale: any, registerId: string) {
  return {
    customer: sale.customer?._id || "",
    // Mirrors exactly the shape the add-to-cart handler builds - anything
    // extra (product name/image for display) is rejected by SaleItemInput.
    items: (sale.items || []).map((item: any) => ({
      product: item.product?._id,
      snapshotName: item.snapshotName,
      snapshotPrice: item.snapshotPrice,
      quantity: item.quantity,
      discount: item.discount,
      price: item.price,
      subTotal: item.subTotal,
      total: item.total,
    })),
    payments: (sale.payments || []).map((payment: any) => ({
      method: payment.method?._id,
      amount: payment.amount,
      change: payment.change,
      note: payment.note || "",
      reference: payment.reference || "",
      date: payment.date,
    })),
    discount: sale.discount,
    subTotal: sale.subTotal,
    total: sale.total,
    notes: sale.notes || "",
    receivedAmount: sale.receivedAmount,
    changeAmount: sale.changeAmount,
    netAmount: sale.netAmount,
    register: registerId,
  }
}

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

function ProcessSalePage({
  editSale,
  duplicateSale,
}: {
  editSale?: any
  duplicateSale?: any
}) {
  const [isPending, startTransition] = useTransition()
  // isPending only flips on the next render, so two clicks landing in the
  // same frame could both get through and ring the cart up twice. This ref
  // is set synchronously, closing that window.
  const submitLock = useRef(false)
  const params = useParams()
  const registerId = params.id as string
  // Present when ?edit=<saleId> resolved to a sale - switches this page from
  // ringing up a new sale to correcting an existing one (see updateSale).
  const editSaleId = editSale?._id || null
  const isEditing = Boolean(editSale)
  // ?duplicate=<saleId> instead pre-fills the cart from a past sale and then
  // behaves like any new sale: generateSale, its own sale number, its own
  // payment. The original is never touched.
  const isDuplicating = Boolean(duplicateSale)
  const clearDraft = () => {
    try {
      localStorage.removeItem(`${DRAFT_STORAGE_PREFIX}${registerId}`)
    } catch {
      // ignore
    }
  }
  const { data, loading } = useQuery(GET_REGISTER, {
    variables: { _id: params.id },
    fetchPolicy: "network-only",
  })
  const register = (data as any)?.processedRegister || null
  const router = useRouter()
  const [selectedType, setSelectedType] = useState<string>("")
  const [generateSale] = useMutation(GENERATE_SALE)
  const [updateSale] = useMutation(UPDATE_SALE, {
    refetchQueries: ["SaleHistoryTable", "Sale"],
    onQueryUpdated: refetchOnlyReadyQueries,
  })
  const [openPay, setOpenPay] = useState(false)
  // Lifted out of AddCustomer so F2 can open it.
  const [openCustomerPicker, setOpenCustomerPicker] = useState(false)
  const [receiptSaleId, setReceiptSaleId] = useState<string | null>(null)

  useEffect(() => {
    if (register && register.productTypes.length > 0)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedType(register.productTypes[0]._id)
  }, [register])

  const [openSearchCommand, setOpenSearchCommand] = useState(false)

  const emptySaleValues = {
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
    // Set from the Pay sheet when the cashier chooses to keep a sale's
    // change as store credit rather than hand it back.
    changeToStoreCredit: false,
    register: register?._id || "",
  }

  const form = useForm({
    defaultValues: {
      ...emptySaleValues,
      // A draft is a half-rung-up new sale; when correcting an existing one
      // the saved sale is the source of truth. The parent remounts this
      // component per sale, so these initial values are always right and
      // nothing has to be reset in afterwards.
      ...(editSale
        ? saleToFormValues(editSale, registerId)
        : duplicateSale
          ? {
              // Same items/customer/notes, but nothing that belongs to the
              // original transaction: no payments, no tendered amount, and
              // no sale identity. Line prices are the ones the original was
              // rung up at, so a duplicate reproduces that sale exactly
              // rather than silently re-pricing it.
              ...saleToFormValues(duplicateSale, registerId),
              payments: [] as any,
              receivedAmount: 0,
              changeAmount: 0,
              netAmount: 0,
              changeToStoreCredit: false,
            }
          : loadDraft(registerId)),
    },
    onSubmit: ({ value: payload }: any) => {
      if (submitLock.current) return
      submitLock.current = true
      startTransition(async () => {
        try {
          if (payload.receivedAmount < payload.total) {
            toast.error("Received amount cannot be less than total")
            return
          }
          if (isEditing) {
            const result = await updateSale({
              variables: { _id: editSaleId, input: { ...payload } },
            })
            if ((result.data as any).updateSale.ok) {
              toast.success((result.data as any).updateSale.message)
              setOpenPay(false)
              router.push("/sale-history")
            }
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
            toast.success((result.data as any).generateSale.message)
            clearDraft()
            setOpenPay(false)
            setReceiptSaleId((result.data as any).generateSale.data._id)
          }
        } catch (error: any) {
          toast.error(error.graphQLErrors?.[0]?.message ?? error.message)
        } finally {
          // Released on failure too, so a rejected sale (insufficient
          // balance, closed register) can be corrected and retried.
          submitLock.current = false
        }
      })
    },
  })

  // Keyboard shortcuts for the three things a cashier does on a sale.
  // Each key carries a browser default that has to be suppressed - F3 opens
  // the browser's find bar, and F5 would reload the page and drop the cart
  // mid-sale - so preventDefault runs before anything else.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "F2" && event.key !== "F3" && event.key !== "F5") return
      event.preventDefault()

      // F2 opens the customer picker. Harmless at any point in a sale - the
      // customer can be attached before or after the cart is filled.
      if (event.key === "F2") {
        setOpenCustomerPicker(true)
        return
      }

      if (event.key === "F3") {
        setOpenSearchCommand(true)
        return
      }

      // F5 opens the Pay sheet, exactly like clicking the green button -
      // it doesn't ring the sale up; confirming inside the sheet still does.
      if (isPending || openPay) return
      if ((form.state.values.items?.length ?? 0) === 0) {
        toast.error("Add an item to the cart before taking payment.")
        return
      }
      setOpenPay(true)
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [form, isPending, openPay])

  const formValues = useStore(form.store, (state) => state.values)

  // Mirror the whole cart to localStorage on every change so a refresh or
  // navigating away and back restores it, keyed per register. Skipped while
  // editing so correcting a past sale doesn't overwrite the cashier's
  // in-progress new sale on this register.
  useEffect(() => {
    if (!registerId || isEditing) return
    try {
      localStorage.setItem(
        `${DRAFT_STORAGE_PREFIX}${registerId}`,
        JSON.stringify(formValues)
      )
    } catch {
      // ignore (e.g. storage disabled/full)
    }
  }, [registerId, formValues, isEditing])

  useEffect(() => {
    form.setFieldValue("register", register?._id || "")
  }, [register?._id, form])

  // Adding a product from the tile grid and from the search popover has to do
  // exactly the same thing, so the "bump the quantity or append a line" rule
  // lives here instead of inline on the tile.
  const addProductToCart = useCallback(
    (product: any) => {
      const currentItems = (form.getFieldValue("items") ?? []) as any[]
      const existingItem = currentItems.find(
        (item: any) =>
          product._id === item.product && item.price == item.snapshotPrice
      )

      if (existingItem) {
        form.setFieldValue(
          "items",
          currentItems.map((item: any) => {
            if (
              existingItem.product === item.product &&
              item.price == item.snapshotPrice
            ) {
              const newQty = item.quantity + 1
              const itemPrice = item.snapshotPrice - item.discount
              return {
                ...item,
                subTotal: item.snapshotPrice * newQty,
                quantity: newQty,
                price: itemPrice,
                total: itemPrice * newQty,
              }
            }
            return item
          })
        )
        return
      }

      form.setFieldValue("items", [
        ...currentItems,
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
      ])
    },
    [form]
  )

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

  // A skeleton of the register rather than a bare spinner: the grid is the
  // page, and showing its shape keeps the cards from appearing to jump into
  // place once the products arrive.
  if (loading) return <ProcessSaleSkeleton />

  if (register && !register.isOpen) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
        <div className="mb-1 flex size-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <CashRegisterIcon size={28} />
        </div>
        <p className="text-lg font-semibold">
          Your Cash Register is Currently Closed
        </p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Open {register.name} to start this shift before processing sales.
        </p>
        <div className="mt-3 flex flex-col items-center gap-2">
          <OpenRegisterDialog
            registerId={register._id}
            registerName={register.name}
            size="lg"
          />
          <Button
            variant="link"
            className="cursor-pointer text-muted-foreground"
            onClick={() => router.push("/process")}
          >
            <ArrowLeftIcon size={14} />
            Back to registers
          </Button>
        </div>
      </div>
    )
  }

  return (
    <>
      <form
        id="sale-form"
        onSubmit={(e) => {
          e.preventDefault()
          form.handleSubmit()
        }}
        className="flex h-full min-h-0 w-full flex-col overflow-y-auto lg:flex-row lg:overflow-hidden"
      >
        <form.Subscribe
          selector={(state) => state.values}
          // eslint-disable-next-line react/no-children-prop
          children={(state) => {
            return (
              <>
                <div className="flex min-w-0 flex-1 flex-col gap-1.5 bg-muted p-2.5 lg:overflow-y-auto">
                  <div className="shrink-0">
                    <SelectRegisterSheet>
                      <Breadcrumb className="w-fit cursor-pointer hover:opacity-80">
                        <BreadcrumbList>
                          <BreadcrumbItem>
                            <BreadcrumbLink>
                              {register?.outlet?.name}
                            </BreadcrumbLink>
                          </BreadcrumbItem>
                          <BreadcrumbSeparator />
                          <BreadcrumbItem>
                            <BreadcrumbPage className="hover:underline">
                              {register?.name || params.id}
                            </BreadcrumbPage>
                          </BreadcrumbItem>
                        </BreadcrumbList>
                      </Breadcrumb>
                    </SelectRegisterSheet>
                  </div>
                  {isEditing && editSale && (
                    <div className="flex flex-col items-start justify-between gap-2 border border-primary/30 bg-primary/10 px-3 py-2 sm:flex-row sm:items-center">
                      <span className="text-sm">
                        Editing sale{" "}
                        <span className="font-semibold">
                          {editSale.saleNumber}
                        </span>{" "}
                        — changes replace the original once you confirm payment.
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="shrink-0 rounded-md border-primary/40 bg-white hover:bg-white/70"
                        onClick={() => router.push("/sale-history")}
                      >
                        <XIcon /> Cancel edit
                      </Button>
                    </div>
                  )}
                  {isDuplicating && (
                    <div className="flex flex-col items-start justify-between gap-2 border border-blue-500/30 bg-blue-500/10 px-3 py-2 sm:flex-row sm:items-center">
                      <span className="text-sm">
                        Duplicating sale{" "}
                        <span className="font-semibold">
                          {duplicateSale.saleNumber}
                        </span>{" "}
                        — items are copied at their original prices and rung up
                        as a brand new sale.
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="shrink-0 rounded-md border-blue-500/40 bg-white hover:bg-white/70"
                        onClick={() => router.push("/sale-history")}
                      >
                        <XIcon /> Cancel
                      </Button>
                    </div>
                  )}
                  <div className="flex shrink-0 flex-col gap-1.5 sm:flex-row">
                    {/*
                      The field is a button, not an input: typing happens in
                      the centred palette F3 opens, so there's only one search
                      surface to learn and it works the same either way.
                    */}
                    <ButtonGroup className="w-full bg-white">
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={openSearchCommand}
                        onClick={() => setOpenSearchCommand(true)}
                        className={cn(
                          "font-base flex-1 justify-between border-r-transparent bg-white text-muted-foreground capitalize hover:bg-transparent hover:text-muted-foreground"
                        )}
                        type="button"
                      >
                        Search SKU, Barcode / Product Name
                        <ShortcutHint
                          keys="F3"
                          className="h-7 min-w-9 px-2 text-sm font-semibold"
                        />
                      </Button>
                    </ButtonGroup>
                    <ButtonGroup className="shrink-0 self-start sm:self-auto">
                      {/*
                        The graduation cap was a disabled placeholder. It is
                        the obvious home for a shortcuts guide, and keeps the
                        help next to the keys it explains.
                      */}
                      <ShortcutsDialog>
                        <Button
                          variant="outline"
                          size="icon"
                          className="font-base"
                          type="button"
                          title="Keyboard shortcuts"
                          aria-label="Keyboard shortcuts"
                        >
                          <GraduationCapIcon />
                        </Button>
                      </ShortcutsDialog>
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
                  <div className="-mb-0.5 shrink-0 overflow-x-auto pb-0.5">
                    <ButtonGroup className="w-max">
                      {register?.productTypes.map(
                        (type: any, index: number) => (
                          <Button
                            key={index}
                            variant="outline"
                            className={cn(
                              "font-base cursor-pointer",
                              selectedType === type._id &&
                                "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                            )}
                            onClick={() => setSelectedType(type._id)}
                            type="button"
                          >
                            {type.name}
                          </Button>
                        )
                      )}
                    </ButtonGroup>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                    {register?.products
                      .filter((p: any) => selectedType === p.type._id)
                      .map((product: any) => (
                        <div
                          key={product._id}
                          className="flex h-36 flex-col border hover:cursor-pointer hover:drop-shadow sm:h-45"
                          onClick={() => addProductToCart(product)}
                        >
                          <div className="flex flex-1 items-center justify-center bg-slate-300">
                            <span className="text-4xl font-semibold text-muted uppercase sm:text-6xl">
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
                                else
                                  return `${product.name[0]}${product.name[1]}`
                              })()}
                            </span>
                          </div>
                          <div className="bg-white">
                            <span className="block px-1 text-center text-xs leading-tight font-medium break-words sm:text-sm">
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
                {/* The panel itself never scrolls - the cart list inside it does - so
                    the totals and the Pay button stay on screen no matter how
                    long the order gets. */}
                <div className="flex w-full min-h-0 shrink-0 flex-col justify-between gap-2.5 border-t p-2 lg:w-96 lg:overflow-hidden lg:border-t-0 lg:border-l">
                  <AddCustomer
                    form={form}
                    open={openCustomerPicker}
                    onOpenChange={setOpenCustomerPicker}
                  />
                  <div className="flex min-h-0 flex-1 flex-col items-start justify-start overflow-y-auto">
                    {state.items.length > 0 && (
                      <div className="flex w-full flex-col gap-2.5">
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
                      <DiscardDialog
                        discard={() => {
                          form.reset(emptySaleValues)
                          clearDraft()
                        }}
                      />
                      <Pay
                        form={form}
                        state={state}
                        register={register}
                        open={openPay}
                        setOpen={setOpenPay}
                        submitting={isPending}
                      >
                        <Button
                          className="flex h-16 w-full justify-between p-3.5 text-xl sm:h-20 sm:text-2xl"
                          form="sale-form"
                          type="button"
                          disabled={state.items.length === 0}
                          loading={isPending}
                        >
                          <span className="flex items-center gap-2">
                            Pay
                            <ShortcutHint
                              keys="F5"
                              className="h-8 min-w-10 bg-primary-foreground/20 px-2 text-base font-semibold text-primary-foreground"
                              iconClassName="text-primary-foreground"
                            />
                          </span>
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
      {/*
        Product search as a centred command palette (F3), rather than a
        dropdown pinned under the field - at a register the cashier is looking
        at the middle of the screen, not at the toolbar.
      */}
      <CommandDialog
        open={openSearchCommand}
        onOpenChange={setOpenSearchCommand}
        title="Search products"
        description="Find a product by name, SKU or barcode and add it to the cart."
        className="sm:max-w-2xl"
      >
        <Command>
          <CommandInput placeholder="Search SKU, Barcode / Product Name" />
          <CommandList className="max-h-[60vh]">
            <CommandEmpty>No product found.</CommandEmpty>
            <CommandGroup heading="Products">
              {register?.products?.map((product: IProduct) => (
                <CommandItem
                  key={product._id.toString()}
                  // cmdk scores the typed query against `value`, so it has to
                  // carry the fields the placeholder promises - an ObjectId
                  // matches nothing.
                  value={[product.name, product.sku, product.barcode]
                    .filter(Boolean)
                    .join(" ")}
                  className="cursor-pointer gap-3 py-2.5"
                  onSelect={() => {
                    addProductToCart(product)
                    setOpenSearchCommand(false)
                  }}
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-slate-200 text-sm font-semibold text-slate-600">
                    {(product.name || "?").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {product.name}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {[product.sku, product.barcode]
                        .filter(Boolean)
                        .join(" · ") || "No SKU"}
                    </span>
                  </div>
                  <span className="shrink-0 font-medium tabular-nums">
                    {new Intl.NumberFormat("en-PH", {
                      style: "currency",
                      currency: "PHP",
                    }).format(product.currentPrice)}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
      <ReceiptDialog
        saleId={receiptSaleId}
        onClose={() => {
          setReceiptSaleId(null)
          form.reset(emptySaleValues)
        }}
      />
    </>
  )
}

// Resolves ?edit=<saleId> before the cart mounts, so ProcessSalePage can
// take the sale as its initial form values instead of having them reset in
// after the fact (which raced the form's own mount).
function ProcessSaleRoute() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const registerId = params.id as string
  const editSaleId = searchParams.get("edit")
  // Both modes load the same sale; only what's done with it differs, so one
  // query covers them. ?edit corrects the original, ?duplicate copies it.
  const duplicateSaleId = searchParams.get("duplicate")
  const sourceSaleId = editSaleId || duplicateSaleId

  const { data, loading } = useQuery(GET_SALE_FOR_EDIT, {
    variables: { _id: sourceSaleId },
    fetchPolicy: "network-only",
    skip: !sourceSaleId,
  })
  const sale = (data as any)?.sale || null

  // Loading a sale to correct lands on the same register screen, so it gets
  // the same skeleton.
  if (sourceSaleId && loading) return <ProcessSaleSkeleton />

  // Mirrors updateSale's own guard - a sale in a closed shift, or a voided
  // one, can't be corrected, so don't present an editable cart for it.
  if (editSaleId && sale && !sale.isEditable) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
        <p className="text-lg font-semibold">
          Sale {sale.saleNumber} can no longer be edited
        </p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Its register shift has already been closed, or the sale was voided.
          Closing a shift freezes its counted-cash record, so past sales stay as
          they were.
        </p>
        <Button
          variant="link"
          className="cursor-pointer text-muted-foreground"
          onClick={() => router.push("/sale-history")}
        >
          <ArrowLeftIcon size={14} />
          Back to sale history
        </Button>
      </div>
    )
  }

  return (
    <ProcessSalePage
      key={`${registerId}:${sourceSaleId ?? "new"}`}
      editSale={editSaleId ? sale : undefined}
      duplicateSale={duplicateSaleId ? sale : undefined}
    />
  )
}

// useSearchParams (for ?edit=) requires a Suspense boundary above it.
export default function Page() {
  return (
    <Suspense fallback={<ProcessSaleSkeleton />}>
      <ProcessSaleRoute />
    </Suspense>
  )
}
