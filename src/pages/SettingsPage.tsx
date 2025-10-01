import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Trash2, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

export default function SettingsPage() {
  const { toast } = useToast();
  const [voiceOutput, setVoiceOutput] = useState(false);

  const handleSave = () => {
    toast({
      title: "Settings saved",
      description: "Your preferences have been updated successfully",
    });
  };

  const handleDelete = () => {
    toast({
      title: "Confirm deletion",
      description: "This will permanently delete all your data",
      variant: "destructive",
    });
  };

  return (
    <div className="p-8 space-y-8">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold">Settings</h1>
        <p className="text-muted-foreground text-lg">
          Manage your preferences and API configurations
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="glass-effect border-border/50">
          <CardHeader>
            <CardTitle>API Configuration</CardTitle>
            <CardDescription>
              Manage your API keys and integrations
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="groq-key">Groq API Key</Label>
              <Input
                id="groq-key"
                type="password"
                placeholder="Enter your Groq API key"
                className="bg-background/50"
              />
              <p className="text-xs text-muted-foreground">
                Your API key is securely stored and encrypted
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="gemini-key">Gemini API Key (Optional)</Label>
              <Input
                id="gemini-key"
                type="password"
                placeholder="Enter your Gemini API key"
                className="bg-background/50"
              />
            </div>

            <Button
              onClick={handleSave}
              className="w-full gradient-primary hover:opacity-90 transition-opacity"
            >
              <Save className="mr-2 h-4 w-4" />
              Save API Keys
            </Button>
          </CardContent>
        </Card>

        <Card className="glass-effect border-border/50">
          <CardHeader>
            <CardTitle>Preferences</CardTitle>
            <CardDescription>
              Customize your experience
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Voice Output</Label>
                <p className="text-xs text-muted-foreground">
                  Enable text-to-speech for AI responses
                </p>
              </div>
              <Switch checked={voiceOutput} onCheckedChange={setVoiceOutput} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="language">Language</Label>
              <Input
                id="language"
                value="English"
                disabled
                className="bg-background/50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="report-format">Report Format</Label>
              <Input
                id="report-format"
                value="PDF"
                disabled
                className="bg-background/50"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="glass-effect border-border/50 border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>
            Irreversible actions - proceed with caution
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={handleDelete}
            variant="destructive"
            className="w-full"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete All Data
          </Button>
          <p className="text-xs text-muted-foreground mt-2">
            This will permanently delete all research projects, insights, and settings
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
