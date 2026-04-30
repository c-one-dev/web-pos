"use client"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { useRegisterStore } from "@/hooks/use-register"
import { useQuery } from "@apollo/client/react"
import { gql } from "@apollo/client"
import { ButtonGroup } from "@/components/ui/button-group"
import { Input } from "@/components/ui/input"
import {
  CaretDownIcon,
  CheckIcon,
  GraduationCapIcon,
  PlusCircleIcon,
} from "@phosphor-icons/react"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { useEffect, useState, useTransition } from "react"
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
import { useForm } from "@tanstack/react-form"
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
        isActive
        createdAt
        updatedAt
        type {
          _id
          name
        }
      }
      productTypes {
        _id
        name
      }
    }
  }
`

const saleSchema = z.object({
  saleNumber: z.string(),
  customer: z.string().optional(),
  items: z.array(
    z.object({
      product: z.string(),
      name: z.string(),
      price: z.number(),
      quantity: z.number(),
      subTotal: z.number(),
      discount: z.number(),
      total: z.number(),
    })
  ),
  notes: z.string().optional(),
  subTotal: z.number(),
  discount: z.number(),
  total: z.number(),
  by: z.string(),
  currentStatus: z.string(),
  onAccount: z.boolean(),
})

function DiscardDialog() {
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
          <AlertDialogAction className="bg-red-600">
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
  const { data } = useQuery(GET_REGISTER, {
    variables: { _id: params.id },
  })
  const register = (data as any)?.processedRegister || null
  const router = useRouter()
  const [selectedType, setSelectedType] = useState<string>("")

  useEffect(() => {
    if (register && register.productTypes.length > 0)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedType(register.productTypes[0]._id)
  }, [register])

  const [openSearchCommand, setOpenSearchCommand] = useState(false)

  const TEST_SALE_NUMBER = `${register?.prefix}-0000001`

  const form = useForm({
    defaultValues: {
      name: "",
    },
    validators: {
      onSubmit: ({ formApi, value }: any) => {
        try {
          saleSchema.parse(value)
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
      startTransition(() => {
        try {
          const payload = {
            name: value.name,
          }
          console.log(value)
        } catch (error: any) {
          throw error
        }
      }),
  })

  return (
    <div className="flex h-full">
      <div className="flex-1 flex-col space-y-1.5 bg-muted p-2.5">
        <div>
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink>{register?.outlet?.name}</BreadcrumbLink>
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
          <Popover open={openSearchCommand} onOpenChange={setOpenSearchCommand}>
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
                        onSelect={(val) => {}}
                      >
                        <span className="block">{product.name}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          {/* <Input
            className="border-r-transparent bg-white"
            placeholder="Search SKU, Barcode or Product Name"
          /> */}
          <ButtonGroup>
            <Button
              variant="outline"
              disabled
              size="icon"
              className="font-base"
            >
              <GraduationCapIcon />
            </Button>
            <Button variant="outline" disabled className="font-base">
              Gift Card
            </Button>
            <Button variant="outline" disabled className="font-base">
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
              >
                <div className="flex flex-1 items-center justify-center bg-slate-200">
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
                      if (nameArray.length > 1) return `${nameArray[0][0]}`
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
          <div>
            <span></span>
          </div>
        </div>
      </div>
      <div className="flex w-sm flex-col bg-white p-2.5">
        <Button variant="outline">
          <PlusCircleIcon /> Add Customer
        </Button>
        <div className="flex-1"></div>
        <div>
          <Accordion
            type="multiple"
            className="list-none"
            defaultValue={["summary"]}
          >
            <AccordionItem value="notes">
              <AccordionTrigger className="text-primary hover:underline-offset-2">
                Notes
              </AccordionTrigger>
              <AccordionContent className="h-fit px-2.5">
                <Textarea placeholder="Add notes for this sale" />
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="summary" className="border-b border-dashed">
              <AccordionTrigger className="text-primary hover:underline-offset-2">
                Summary
              </AccordionTrigger>
              <AccordionContent className="h-fit px-2.5">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span>Subtotal</span>
                    <span>
                      {new Intl.NumberFormat("en-PH", {
                        style: "currency",
                        currency: "PHP",
                      }).format(0)}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span>Discount</span>
                    <span>
                      {new Intl.NumberFormat("en-PH", {
                        style: "currency",
                        currency: "PHP",
                      }).format(0)}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span>Tax</span>
                    <span>
                      {new Intl.NumberFormat("en-PH", {
                        style: "currency",
                        currency: "PHP",
                      }).format(0)}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between font-semibold">
                    <span>Total (Items: 1)</span>
                    <span>
                      {new Intl.NumberFormat("en-PH", {
                        style: "currency",
                        currency: "PHP",
                      }).format(0)}
                    </span>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
        <div>
          <DiscardDialog />
          <Button
            className="flex h-fit w-full justify-between p-3.5 text-xl"
            size="lg"
          >
            <span>Pay</span>
            <span>
              {new Intl.NumberFormat("en-PH", {
                style: "currency",
                currency: "PHP",
              }).format(0)}
            </span>
          </Button>
        </div>
      </div>
    </div>
  )
}
