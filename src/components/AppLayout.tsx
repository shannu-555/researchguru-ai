import { Outlet, Link, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { ThemeToggle } from "./ThemeToggle";
import { UserProfileDropdown } from "./UserProfileDropdown";
import { Home, Settings, FileText, LineChart, MessageSquare, BarChart3 } from "lucide-react";
import { Button } from "./ui/button";

export const AppLayout = () => {
  const location = useLocation();
  
  const topNavItems = [
    { title: "Dashboard", url: "/", icon: Home },
    { title: "Research", url: "/research", icon: LineChart },
    { title: "AI Assistant", url: "/ai-assistant", icon: MessageSquare },
    { title: "Comparison", url: "/comparison", icon: BarChart3 },
    { title: "My Notes", url: "/my-notes", icon: FileText },
    { title: "Settings", url: "/settings", icon: Settings },
  ];

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/50">
            <div className="flex items-center justify-between px-6 py-2">
              <h1 className="text-3xl font-bold tracking-tight">
                MARKET RESEARCH
              </h1>
              <div className="flex items-center gap-2">
                <ThemeToggle />
                <UserProfileDropdown />
              </div>
            </div>
            <div className="flex items-center gap-1 px-6 pb-2">
              {topNavItems.map((item) => (
                <Button
                  key={item.url}
                  variant={location.pathname === item.url ? "secondary" : "ghost"}
                  size="sm"
                  asChild
                  className="gap-2"
                >
                  <Link to={item.url}>
                    <item.icon className="h-4 w-4" />
                    {item.title}
                  </Link>
                </Button>
              ))}
            </div>
          </div>
          <Outlet />
        </main>
      </div>
    </SidebarProvider>
  );
};
