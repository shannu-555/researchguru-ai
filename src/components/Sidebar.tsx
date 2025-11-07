import { Activity, TrendingUp, Users, Target, Menu } from "lucide-react";
import { NavLink } from "react-router-dom";
import {
  Sidebar as SidebarUI,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";

const aiFeatures = [
  { title: "Market Pulse Index", url: "/future-insights#pulse", icon: Activity },
  { title: "Cross-Market Correlation", url: "/future-insights#correlation", icon: TrendingUp },
  { title: "Consumer Persona Predictor", url: "/future-insights#personas", icon: Users },
  { title: "Scenario Simulator", url: "/future-insights#simulator", icon: Target },
];

export function Sidebar() {
  const { open } = useSidebar();

  return (
    <SidebarUI className={open ? "w-60" : "w-14"} collapsible="icon">
      <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
        {open && (
          <h2 className="text-lg font-bold bg-gradient-primary bg-clip-text text-transparent">
            AI Features
          </h2>
        )}
        <SidebarTrigger className="ml-auto">
          <Menu className="h-5 w-5" />
        </SidebarTrigger>
      </div>

      <SidebarContent className="flex flex-col h-full">
        <SidebarGroup className="flex-1">
          <SidebarGroupLabel className={!open ? "sr-only" : ""}>
            AI-Powered Analytics
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {aiFeatures.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
                          isActive
                            ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                            : "hover:bg-sidebar-accent/50"
                        }`
                      }
                    >
                      <item.icon className="h-5 w-5 flex-shrink-0" />
                      {open && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </SidebarUI>
  );
}
