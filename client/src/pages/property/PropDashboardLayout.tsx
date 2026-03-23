import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/useMobile";
import {
  LayoutDashboard,
  Building2,
  PlusCircle,
  CalendarClock,
  TrendingDown,
  FolderOpen,
  Settings,
  LogOut,
  Home,
  ArrowLeft,
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/", adminOnly: false },
  { icon: Building2, label: "Properties", path: "/properties", adminOnly: false },
  { icon: PlusCircle, label: "Add Property", path: "/properties/new", adminOnly: true },
  { icon: CalendarClock, label: "Payment Calendar", path: "/payments", adminOnly: false },
  { icon: TrendingDown, label: "Liability Forecast", path: "/liability", adminOnly: false },
  { icon: Home, label: "Rentals", path: "/rentals", adminOnly: false },
  { icon: FolderOpen, label: "Documents", path: "/documents", adminOnly: false },
  { icon: Settings, label: "Settings", path: "/settings", adminOnly: false },
];

const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;

export default function PropDashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarWidth] = useState(DEFAULT_WIDTH);
  const { loading, user } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login");
    }
  }, [loading, user, navigate]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: "#FAF8F5" }}>
        <div className="animate-spin h-8 w-8 rounded-full border-4" style={{ borderColor: "#2D5A3D", borderTopColor: "transparent" }} />
      </div>
    );
  }

  return (
    <SidebarProvider
      style={{
        "--sidebar-width": `${sidebarWidth}px`,
        "--sidebar": "#1a3828",
        "--sidebar-foreground": "#FFFFFF",
        "--sidebar-accent": "rgba(255,255,255,0.12)",
        "--sidebar-accent-foreground": "#FFFFFF",
        "--sidebar-border": "rgba(255,255,255,0.1)",
      } as CSSProperties}
    >
      <PropLayoutContent>{children}</PropLayoutContent>
    </SidebarProvider>
  );
}

function PropLayoutContent({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const [currentWidth, setCurrentWidth] = useState(DEFAULT_WIDTH);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const filteredMenu = menuItems.filter(item => !item.adminOnly || user?.role === "admin");

  const activeMenuItem = filteredMenu.find(item => {
    if (item.path === "/") return location === "/" || location === "";
    return location.startsWith(item.path);
  }) || filteredMenu[0];

  useEffect(() => {
    if (isCollapsed) setIsResizing(false);
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) setCurrentWidth(newWidth);
    };
    const handleMouseUp = () => setIsResizing(false);
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing]);

  const handleLogout = async () => {
    await logout();
    window.location.href = "/login";
  };

  const initials = (user?.name || user?.email || "U").split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);

  return (
    <>
      <div
        ref={sidebarRef}
        style={{
          position: "relative",
          width: isCollapsed ? undefined : `${currentWidth}px`,
        }}
      >
        <Sidebar
          className="[&_[data-sidebar=sidebar]]:[background:linear-gradient(180deg,_#1a3828_0%,_#2D5A3D_60%,_#3A7350_100%)] border-none"
        >
          <SidebarHeader className="p-4">
            <div className="flex items-center gap-3">
              {!isCollapsed && (
                <>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "rgba(255,255,255,0.15)" }}>
                    <Building2 className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <div className="font-bold text-white text-sm">Property Portfolio</div>
                    <div className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>Management Portal</div>
                  </div>
                </>
              )}
              {isCollapsed && (
                <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "rgba(255,255,255,0.15)" }}>
                  <Building2 className="h-5 w-5 text-white" />
                </div>
              )}
            </div>
          </SidebarHeader>

          <SidebarContent className="px-3 py-2">
            {!isCollapsed && (
              <button
                onClick={() => window.location.href = "/"}
                className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs mb-3 transition-all hover:opacity-90"
                style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)" }}
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to ERP Portal
              </button>
            )}
            <SidebarMenu>
              {filteredMenu.map((item) => {
                const isActive = activeMenuItem?.path === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      onClick={() => setLocation(item.path)}
                      isActive={isActive}
                      className="transition-all duration-150"
                      style={{
                        background: isActive ? "rgba(255,255,255,0.15)" : "transparent",
                        color: isActive ? "#FFFFFF" : "rgba(255,255,255,0.75)",
                        borderRadius: "0.5rem",
                        fontWeight: isActive ? 600 : 400,
                      }}
                    >
                      <item.icon className="h-4 w-4" />
                      {!isCollapsed && <span>{item.label}</span>}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex w-full items-center gap-3 rounded-lg p-2 transition-colors" style={{ background: "rgba(255,255,255,0.08)" }}>
                  <Avatar className="h-8 w-8">
                    <AvatarFallback style={{ background: "rgba(255,255,255,0.2)", color: "#FFFFFF", fontSize: "0.75rem" }}>
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  {!isCollapsed && (
                    <div className="flex-1 overflow-hidden text-left">
                      <p className="truncate text-sm font-medium text-white">{user?.name || user?.username || "User"}</p>
                      <p className="truncate text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>{user?.email || ""}</p>
                    </div>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={handleLogout} className="cursor-pointer" style={{ color: "#C0714A" }}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>

        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-white/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => { if (!isCollapsed) setIsResizing(true); }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        {isMobile && (
          <div
            className="flex h-14 items-center justify-between px-3 backdrop-blur sticky top-0 z-40"
            style={{ background: "rgba(250,248,245,0.95)", borderBottom: "1px solid #E8E5E0" }}
          >
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9 rounded-lg" />
              <span className="font-semibold text-sm" style={{ color: "#2C3E50" }}>
                {activeMenuItem?.label ?? "Property Portfolio"}
              </span>
            </div>
          </div>
        )}
        <main className="flex-1 p-4 md:p-6" style={{ background: "#FAF8F5" }}>
          {children}
        </main>
      </SidebarInset>
    </>
  );
}
