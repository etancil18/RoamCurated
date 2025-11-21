import Link from "next/link"
import { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { usePathname } from "next/navigation"

// Sidebar links for venue portal
const navItems = (venueId: string) => [
  {
    name: "Dashboard",
    href: `/venues/${venueId}/portal`,
  },
  {
    name: "Events",
    href: `/venues/${venueId}/portal/events`,
  },
  {
    name: "Create Event",
    href: `/venues/${venueId}/portal/events/new`,
  },
]

export default function VenuePortalLayout({
  children,
  params,
}: {
  children: ReactNode
  params: { venueId: string }
}) {
  const { venueId } = params

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="hidden md:flex md:flex-col w-64 border-r bg-white px-4 py-6">
        <h2 className="text-xl font-semibold mb-6">Venue Portal</h2>

        <Separator className="mb-4" />

        <nav className="flex flex-col gap-2">
          {navItems(venueId).map((item) => (
            <SidebarLink key={item.href} href={item.href}>
              {item.name}
            </SidebarLink>
          ))}
        </nav>
      </aside>

      {/* Mobile Top Nav */}
      <div className="md:hidden w-full border-b bg-white p-4 flex items-center gap-2 overflow-x-auto">
        {navItems(venueId).map((item) => (
          <MobileNavLink key={item.href} href={item.href}>
            {item.name}
          </MobileNavLink>
        ))}
      </div>

      {/* Main content */}
      <main className="flex-1 p-6">{children}</main>
    </div>
  )
}

/* ----------------------------
   Sidebar Link Component
----------------------------- */
function SidebarLink({
  href,
  children,
}: {
  href: string
  children: ReactNode
}) {
  const pathname = usePathname()
  const isActive = pathname === href

  return (
    <Link href={href}>
      <Button
        variant={isActive ? "default" : "ghost"}
        className={cn("w-full justify-start")}
      >
        {children}
      </Button>
    </Link>
  )
}

/* ----------------------------
   Mobile Navigation Button
----------------------------- */
function MobileNavLink({
  href,
  children,
}: {
  href: string
  children: ReactNode
}) {
  const pathname = usePathname()
  const isActive = pathname === href

  return (
    <Link href={href}>
      <Button
        size="sm"
        variant={isActive ? "default" : "outline"}
        className="whitespace-nowrap"
      >
        {children}
      </Button>
    </Link>
  )
}
