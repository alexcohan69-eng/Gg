import {
  House,
  Search,
  Bell,
  Mail,
  Bookmark,
  User,
  Settings,
  type LucideIcon,
} from "lucide-react"

export type NavItem = {
  href: string
  label: string
  icon: LucideIcon
}

// Shown in the desktop sidebar, in order. The first four also appear in
// the mobile bottom tab bar; the rest live in the mobile menu sheet.
export const NAV_ITEMS: NavItem[] = [
  { href: "/home", label: "Home", icon: House },
  { href: "/explore", label: "Explore", icon: Search },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/messages", label: "Messages", icon: Mail },
  { href: "/bookmarks", label: "Bookmarks", icon: Bookmark },
  { href: "/profile", label: "Profile", icon: User },
  { href: "/settings", label: "Settings", icon: Settings },
]

export const MOBILE_TAB_ITEMS = NAV_ITEMS.slice(0, 4)
export const MOBILE_MENU_ITEMS = NAV_ITEMS.slice(4)
