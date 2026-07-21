"use client"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../ui/accordion"
import {
  BooksIcon,
  CashRegisterIcon,
  DotIcon,
  SquaresFourIcon,
  StorefrontIcon,
  TagIcon,
} from "@phosphor-icons/react"
import { useEffect, useMemo, useState } from "react"

const pointOfSalesItems = [
  {
    label: "Process Sale",
    url: "/process",
  },
  {
    label: "Sale History",
    url: "/sale-history",
  },
  {
    label: "Cash Register",
    url: "/cash-register",
  },
]

const productItems = [
  {
    label: "Products",
    url: "/product",
  },
  {
    label: "Product Types",
    url: "/product-type",
  },
  {
    label: "Brands",
    url: "/brand",
  },
]

const reportItems = [
  {
    label: "Customers",
    url: "/reports/customers",
  },
  {
    label: "Payments",
    url: "/reports/payments",
  },
]

const storeItems = [
  {
    label: "Customers",
    url: "/customer",
  },
  {
    label: "Users",
    url: "/user",
  },
  {
    label: "Outlets",
    url: "/outlet",
  },
  {
    label: "Payment Methods",
    url: "/payment-method",
  },
]

export default function AppSidebar() {
  const LOCAL_STORAGE_KEY = "menu-state"
  const currentPath = usePathname()
  const DEFAULT_OPEN_ITEMS = useMemo(() => ["point_of_sale"], [])
  const [openItems, setOpenItems] = useState<string[]>(DEFAULT_OPEN_ITEMS)

  useEffect(() => {
    const savedItems = localStorage.getItem(LOCAL_STORAGE_KEY)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (savedItems) setOpenItems(JSON.parse(savedItems))
    else
      localStorage.setItem(
        LOCAL_STORAGE_KEY,
        JSON.stringify(DEFAULT_OPEN_ITEMS)
      )
  }, [DEFAULT_OPEN_ITEMS])

  const handleValueChange = (values: string[]) => {
    setOpenItems(values)
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(values))
  }
  return (
    <Sidebar>
      <SidebarHeader className="mx-auto">C-ONE POS System</SidebarHeader>
      <SidebarContent>
        <div className="not-last:border-b">
          <Link
            href="/dashboard"
            className={cn(
              "relative flex flex-1 items-center gap-2 rounded-none border border-transparent px-2.5 pt-2.5 pb-1.75 text-left text-xs font-medium outline-none transition-all hover:cursor-pointer hover:underline focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50",
              currentPath === "/dashboard" && "text-primary"
            )}
          >
            <SquaresFourIcon size={18} />
            <span className="text-sm">Dashboard</span>
          </Link>
        </div>
        <Accordion
          type="multiple"
          value={openItems}
          onValueChange={handleValueChange}
          className="list-none"
        >
          <AccordionItem value="point_of_sale">
            <AccordionTrigger>
              <div className="flex items-center gap-2">
                <CashRegisterIcon size={18} />
                <span className="text-sm">Point of Sale</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              {pointOfSalesItems.map((item) => (
                <SidebarMenuItem key={item.url} className="px-1">
                  <SidebarMenuButton asChild>
                    <Link
                      href={item.url || "/"}
                      className={cn(
                        "flex items-center gap-2 decoration-transparent hover:decoration-current active:decoration-current",
                        item.url === currentPath && "text-primary"
                      )}
                    >
                      <DotIcon size={12} className="ml-px" />
                      <span className="text-sm no-underline">{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="products">
            <AccordionTrigger>
              <div className="flex items-center gap-2">
                <TagIcon size={18} />
                <span className="text-sm">Products</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              {productItems.map((item) => (
                <SidebarMenuItem key={item.url} className="px-1">
                  <SidebarMenuButton asChild>
                    <Link
                      href={item.url || "/"}
                      className={cn(
                        "flex items-center gap-2 decoration-transparent hover:decoration-current active:decoration-current",
                        item.url === currentPath && "text-primary"
                      )}
                    >
                      <DotIcon size={12} className="ml-px" />
                      <span className="text-sm no-underline">{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="reports">
            <AccordionTrigger>
              <div className="flex items-center gap-2">
                <BooksIcon size={18} />
                <span className="text-sm">Reports</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              {reportItems.map((item) => (
                <SidebarMenuItem key={item.url} className="px-1">
                  <SidebarMenuButton asChild>
                    <Link
                      href={item.url || "/"}
                      className={cn(
                        "flex items-center gap-2 decoration-transparent hover:decoration-current active:decoration-current",
                        item.url === currentPath && "text-primary"
                      )}
                    >
                      <DotIcon size={12} className="ml-px" />
                      <span className="text-sm no-underline">{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="store-setup">
            <AccordionTrigger>
              <div className="flex items-center gap-2">
                <StorefrontIcon size={18} />
                <span className="text-sm">Store Setup</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              {storeItems.map((item) => (
                <SidebarMenuItem key={item.url} className="px-1">
                  <SidebarMenuButton asChild>
                    <Link
                      href={item.url || "/"}
                      className={cn(
                        "flex items-center gap-2 decoration-transparent hover:decoration-current active:decoration-current",
                        item.url === currentPath && "text-primary"
                      )}
                    >
                      <DotIcon size={12} className="ml-px" />
                      <span className="text-sm no-underline">{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </SidebarContent>
      <SidebarFooter />
    </Sidebar>
  )
}
