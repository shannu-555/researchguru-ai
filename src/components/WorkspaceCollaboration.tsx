import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Users, Mail, Trash2, UserPlus } from "lucide-react";

interface Collaborator {
  id: string;
  collaborator_email: string;
  role: string;
  status: string;
  invited_at: string;
}

export function WorkspaceCollaboration() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState("viewer");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      loadCollaborators();
    }
  }, [user]);

  const loadCollaborators = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('workspace_collaborators')
      .select('*')
      .eq('workspace_owner_id', user.id)
      .order('invited_at', { ascending: false });
    
    if (error) {
      console.error('Error loading collaborators:', error);
    } else {
      setCollaborators(data || []);
    }
  };

  const inviteCollaborator = async () => {
    if (!user || !newEmail) return;
    setLoading(true);

    const { error } = await supabase
      .from('workspace_collaborators')
      .insert({
        workspace_owner_id: user.id,
        collaborator_email: newEmail,
        role: newRole,
      });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to invite collaborator",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: `Invitation sent to ${newEmail}`,
      });
      setNewEmail("");
      loadCollaborators();
    }
    setLoading(false);
  };

  const removeCollaborator = async (id: string) => {
    const { error } = await supabase
      .from('workspace_collaborators')
      .delete()
      .eq('id', id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to remove collaborator",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Collaborator removed",
      });
      loadCollaborators();
    }
  };

  return (
    <Card className="p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Users className="h-5 w-5" />
        <h2 className="text-2xl font-bold">Workspace Collaboration</h2>
      </div>

      <div className="space-y-4">
        <p className="text-muted-foreground">
          Invite team members to collaborate on your research projects
        </p>

        <div className="flex gap-2">
          <Input
            type="email"
            placeholder="colleague@example.com"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            className="flex-1"
          />
          <Select value={newRole} onValueChange={setNewRole}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="viewer">Viewer</SelectItem>
              <SelectItem value="editor">Editor</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={inviteCollaborator} disabled={loading || !newEmail}>
            <UserPlus className="h-4 w-4 mr-2" />
            Invite
          </Button>
        </div>

        <div className="space-y-2">
          <h3 className="font-semibold">Team Members</h3>
          {collaborators.length === 0 ? (
            <p className="text-sm text-muted-foreground">No collaborators yet</p>
          ) : (
            <div className="space-y-2">
              {collaborators.map((collab) => (
                <div
                  key={collab.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-muted/20"
                >
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{collab.collaborator_email}</p>
                      <p className="text-xs text-muted-foreground">
                        Invited {new Date(collab.invited_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={collab.status === 'accepted' ? 'default' : 'secondary'}>
                      {collab.status}
                    </Badge>
                    <Badge variant="outline">{collab.role}</Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeCollaborator(collab.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
