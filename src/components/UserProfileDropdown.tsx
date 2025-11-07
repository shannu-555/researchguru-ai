import { User, Settings, LogOut, Shield, Plus, History, Download, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface UserProfile {
  id: string;
  profile_name: string;
  is_active: boolean;
}

interface ProfileHistory {
  id: string;
  action_type: string;
  action_details: any;
  created_at: string;
}

interface ProfileDownload {
  id: string;
  file_name: string;
  file_type: string;
  download_date: string;
}

export function UserProfileDropdown() {
  const { user, signOut } = useAuth();
  const { isAdmin } = useIsAdmin();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [activeProfile, setActiveProfile] = useState<UserProfile | null>(null);
  const [history, setHistory] = useState<ProfileHistory[]>([]);
  const [downloads, setDownloads] = useState<ProfileDownload[]>([]);

  const userInitials = user?.email
    ? user.email.substring(0, 2).toUpperCase()
    : "U";

  useEffect(() => {
    if (user) {
      loadProfiles();
      loadHistory();
      loadDownloads();
    }
  }, [user]);

  const loadProfiles = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    
    if (data) {
      setProfiles(data);
      const active = data.find(p => p.is_active);
      setActiveProfile(active || null);
    }
  };

  const loadHistory = async () => {
    if (!user) return;
    const { data: profilesData } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('user_id', user.id);
    
    if (profilesData && profilesData.length > 0) {
      const { data } = await supabase
        .from('profile_history')
        .select('*')
        .in('profile_id', profilesData.map(p => p.id))
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (data) setHistory(data);
    }
  };

  const loadDownloads = async () => {
    if (!user) return;
    const { data: profilesData } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('user_id', user.id);
    
    if (profilesData && profilesData.length > 0) {
      const { data } = await supabase
        .from('profile_downloads')
        .select('*')
        .in('profile_id', profilesData.map(p => p.id))
        .order('download_date', { ascending: false })
        .limit(5);
      
      if (data) setDownloads(data);
    }
  };

  const createNewProfile = async () => {
    if (!user) return;
    const profileName = `Profile ${profiles.length + 1}`;
    const { error } = await supabase
      .from('user_profiles')
      .insert({
        user_id: user.id,
        profile_name: profileName,
        is_active: profiles.length === 0
      });
    
    if (error) {
      toast({
        title: "Error",
        description: "Failed to create profile",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: `${profileName} created`,
      });
      loadProfiles();
    }
  };

  const switchProfile = async (profileId: string) => {
    if (!user) return;
    
    // Deactivate all profiles
    await supabase
      .from('user_profiles')
      .update({ is_active: false })
      .eq('user_id', user.id);
    
    // Activate selected profile
    const { error } = await supabase
      .from('user_profiles')
      .update({ is_active: true })
      .eq('id', profileId);
    
    if (error) {
      toast({
        title: "Error",
        description: "Failed to switch profile",
        variant: "destructive",
      });
    } else {
      loadProfiles();
      toast({
        title: "Profile Switched",
        description: "Your active profile has been updated",
      });
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full">
          <Avatar className="h-10 w-10 border-2 border-primary/20">
            <AvatarFallback className="bg-gradient-primary text-primary-foreground">
              {userInitials}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-2">
            <p className="text-sm font-medium leading-none">
              {user?.user_metadata?.full_name || "User"}
            </p>
            <p className="text-xs leading-none text-muted-foreground">
              {user?.email}
            </p>
            {isAdmin && (
              <div className="flex items-center gap-1 text-xs text-accent">
                <Shield className="h-3 w-3" />
                <span>Administrator</span>
              </div>
            )}
            {activeProfile && (
              <div className="flex items-center gap-1 text-xs text-primary">
                <User className="h-3 w-3" />
                <span>Active: {activeProfile.profile_name}</span>
              </div>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <User className="mr-2 h-4 w-4" />
            <span>Switch Profile</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {profiles.map((profile) => (
              <DropdownMenuItem
                key={profile.id}
                onClick={() => switchProfile(profile.id)}
                className="flex items-center justify-between"
              >
                <span>{profile.profile_name}</span>
                {profile.is_active && <Check className="h-4 w-4 text-primary" />}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={createNewProfile}>
              <Plus className="mr-2 h-4 w-4" />
              <span>Create New Profile</span>
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <History className="mr-2 h-4 w-4" />
            <span>History</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-64">
            {history.length === 0 ? (
              <div className="p-2 text-xs text-muted-foreground">No history yet</div>
            ) : (
              history.map((item) => (
                <DropdownMenuItem key={item.id} className="flex flex-col items-start">
                  <span className="text-sm font-medium">{item.action_type}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(item.created_at).toLocaleDateString()}
                  </span>
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Download className="mr-2 h-4 w-4" />
            <span>Downloads</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-64">
            {downloads.length === 0 ? (
              <div className="p-2 text-xs text-muted-foreground">No downloads yet</div>
            ) : (
              downloads.map((item) => (
                <DropdownMenuItem key={item.id} className="flex flex-col items-start">
                  <span className="text-sm font-medium">{item.file_name}</span>
                  <span className="text-xs text-muted-foreground">
                    {item.file_type} • {new Date(item.download_date).toLocaleDateString()}
                  </span>
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate("/settings")}>
          <Settings className="mr-2 h-4 w-4" />
          <span>Settings</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
          <LogOut className="mr-2 h-4 w-4" />
          <span>Sign out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
