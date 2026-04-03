import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Palette, Download, Key } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useTheme } from "next-themes";
import { WorkspaceCollaboration } from "@/components/WorkspaceCollaboration";
import { toast as sonnerToast } from "sonner";
import { Input } from "@/components/ui/input";

interface SettingsState {
  agents: { sentiment: boolean; competitor: boolean; trends: boolean; insights: boolean };
  retentionDays: string;
  defaultExportFormat: string;
  voiceOutput: boolean;
}

const DEFAULT_SETTINGS: SettingsState = {
  agents: { sentiment: true, competitor: true, trends: true, insights: true },
  retentionDays: "90",
  defaultExportFormat: "pdf",
  voiceOutput: false,
};

export default function EnhancedSettings() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const [settings, setSettings] = useState<SettingsState>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasGeminiKey, setHasGeminiKey] = useState(false);
  const [hasGroqKey, setHasGroqKey] = useState(false);
  const [hasPerplexityKey, setHasPerplexityKey] = useState(false);

  const loadSettings = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("user_settings")
      .select("preferences")
      .eq("user_id", user.id)
      .single();
    if (data?.preferences && typeof data.preferences === "object") {
      setSettings(prev => ({ ...prev, ...(data.preferences as Partial<SettingsState>) }));
    }

    // Check API keys existence
    const { data: keys } = await supabase
      .from("user_api_keys")
      .select("key_name")
      .eq("user_id", user.id);
    
    if (keys) {
      setHasGeminiKey(keys.some(k => k.key_name === "GEMINI_API_KEY"));
      setHasGroqKey(keys.some(k => k.key_name === "GROQ_API_KEY"));
      setHasPerplexityKey(keys.some(k => k.key_name === "PERPLEXITY_API_KEY"));
    }
  }, [user]);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  const saveSettings = async () => {
    if (!user) return;
    setIsSaving(true);
    const { data: existing } = await supabase.from("user_settings").select("id").eq("user_id", user.id).single();
    if (existing) {
      await supabase.from("user_settings").update({ preferences: settings as any, updated_at: new Date().toISOString() }).eq("id", existing.id);
    } else {
      await supabase.from("user_settings").insert({ user_id: user.id, preferences: settings as any });
    }
    setIsSaving(false);
    sonnerToast.success("Settings saved");
  };

  const update = <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const saveApiKey = async (keyName: string, keyValue: string) => {
    if (!user || !keyValue.trim()) return;
    const { data: existing } = await supabase
      .from("user_api_keys")
      .select("id")
      .eq("user_id", user.id)
      .eq("key_name", keyName)
      .single();
    
    if (existing) {
      await supabase.from("user_api_keys").update({ key_value: keyValue.trim() }).eq("id", existing.id);
    } else {
      await supabase.from("user_api_keys").insert({ user_id: user.id, key_name: keyName, key_value: keyValue.trim() });
    }
    sonnerToast.success(`${keyName} saved`);
    loadSettings();
  };

  const handleDeleteAllData = async () => {
    if (!window.confirm("Are you sure you want to delete ALL your data? This cannot be undone.")) return;
    setIsLoading(true);
    try {
      await supabase.from("agent_results").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("insights").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("research_projects").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("user_settings").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("user_api_keys").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      toast({ title: "All data deleted", description: "Your data has been permanently removed" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally { setIsLoading(false); }
  };

  const exportAllData = async () => {
    sonnerToast.info("Exporting data...");
    const [projects, notes, insights] = await Promise.all([
      supabase.from("research_projects").select("*"),
      supabase.from("research_notes").select("*"),
      supabase.from("insights").select("*"),
    ]);
    const exportData = {
      exported_at: new Date().toISOString(),
      projects: projects.data || [],
      notes: notes.data || [],
      insights: insights.data || [],
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `research-backup-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    sonnerToast.success("Data exported");
  };

  const SettingRow = ({ label, desc, children }: { label: string; desc: string; children: React.ReactNode }) => (
    <div className="flex items-center justify-between p-3 border rounded-lg border-border/50">
      <div className="flex-1 min-w-0 mr-4">
        <Label className="font-medium">{label}</Label>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );

  const ApiKeyInput = ({ keyName, label, hasKey }: { keyName: string; label: string; hasKey: boolean }) => {
    const [value, setValue] = useState("");
    return (
      <div className="flex items-center justify-between p-3 border rounded-lg border-border/50">
        <div className="flex-1 min-w-0 mr-4">
          <Label className="font-medium">{label}</Label>
          <p className="text-xs text-muted-foreground">
            {hasKey ? "✓ Key configured" : "Not configured"}
          </p>
        </div>
        <div className="flex gap-2">
          <Input
            type="password"
            placeholder={hasKey ? "••••••••••••" : "Enter API key"}
            value={value}
            onChange={e => setValue(e.target.value)}
            className="w-[180px] text-xs"
          />
          <Button size="sm" variant="outline" onClick={() => { saveApiKey(keyName, value); setValue(""); }} disabled={!value.trim()}>
            Save
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl md:text-4xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Configure your research platform preferences</p>
        </div>
        <Button onClick={saveSettings} disabled={isSaving} className="gap-2">
          {isSaving ? "Saving..." : "Save All"}
        </Button>
      </div>

      <WorkspaceCollaboration />

      <Accordion type="multiple" className="space-y-3" defaultValue={["agents", "api-keys"]}>

        {/* Agent Controls */}
        <AccordionItem value="agents" className="border rounded-lg">
          <AccordionTrigger className="px-6 hover:no-underline">
            <span className="text-lg font-semibold">Agent Controls</span>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-6 space-y-3">
            {(["sentiment", "competitor", "trends", "insights"] as const).map(key => (
              <SettingRow key={key} label={`${key.charAt(0).toUpperCase() + key.slice(1)} Agent`} desc={{
                sentiment: "Analyze customer sentiment and reviews",
                competitor: "Research competitor products and pricing",
                trends: "Track market trends and patterns",
                insights: "Generate AI-powered insights",
              }[key]}>
                <Switch checked={settings.agents[key]} onCheckedChange={v => update("agents", { ...settings.agents, [key]: v })} />
              </SettingRow>
            ))}
          </AccordionContent>
        </AccordionItem>

        {/* API Configuration */}
        <AccordionItem value="api-keys" className="border rounded-lg">
          <AccordionTrigger className="px-6 hover:no-underline">
            <div className="flex items-center gap-2"><Key className="h-5 w-5 text-primary" /><span className="text-lg font-semibold">API Configuration</span></div>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-6 space-y-3">
            <p className="text-xs text-muted-foreground mb-2">Optional API keys for enhanced analysis. The platform works without them using Lovable AI.</p>
            <ApiKeyInput keyName="GEMINI_API_KEY" label="Gemini API Key" hasKey={hasGeminiKey} />
            <ApiKeyInput keyName="GROQ_API_KEY" label="Groq API Key" hasKey={hasGroqKey} />
            <ApiKeyInput keyName="PERPLEXITY_API_KEY" label="Perplexity API Key" hasKey={hasPerplexityKey} />
          </AccordionContent>
        </AccordionItem>

        {/* Theme */}
        <AccordionItem value="theme" className="border rounded-lg">
          <AccordionTrigger className="px-6 hover:no-underline">
            <div className="flex items-center gap-2"><Palette className="h-5 w-5" /><span className="text-lg font-semibold">Theme & Appearance</span></div>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-6 space-y-3">
            <SettingRow label="Theme Mode" desc="Choose your preferred color scheme">
              <div className="flex gap-2">
                {(["light", "dark", "system"] as const).map(t => (
                  <Button key={t} variant={theme === t ? "default" : "outline"} size="sm" onClick={() => setTheme(t)} className="capitalize">{t}</Button>
                ))}
              </div>
            </SettingRow>
            <SettingRow label="Voice Output" desc="Enable text-to-speech for AI responses">
              <Switch checked={settings.voiceOutput} onCheckedChange={v => update("voiceOutput", v)} />
            </SettingRow>
          </AccordionContent>
        </AccordionItem>

        {/* Export Settings */}
        <AccordionItem value="export" className="border rounded-lg">
          <AccordionTrigger className="px-6 hover:no-underline">
            <div className="flex items-center gap-2"><Download className="h-5 w-5 text-primary" /><span className="text-lg font-semibold">Export & Data</span></div>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-6 space-y-3">
            <SettingRow label="Default Export Format" desc="Preferred format for research exports">
              <Select value={settings.defaultExportFormat} onValueChange={v => update("defaultExportFormat", v)}>
                <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pdf">PDF</SelectItem>
                  <SelectItem value="xlsx">Excel</SelectItem>
                  <SelectItem value="json">JSON</SelectItem>
                </SelectContent>
              </Select>
            </SettingRow>
            <SettingRow label="Data Retention" desc="Auto-delete old projects after this period">
              <Select value={settings.retentionDays} onValueChange={v => update("retentionDays", v)}>
                <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 days</SelectItem>
                  <SelectItem value="90">90 days</SelectItem>
                  <SelectItem value="180">6 months</SelectItem>
                  <SelectItem value="365">1 year</SelectItem>
                  <SelectItem value="forever">Forever</SelectItem>
                </SelectContent>
              </Select>
            </SettingRow>
            <Button onClick={exportAllData} variant="outline" className="gap-2 w-full">
              <Download className="h-4 w-4" /> Export All Research Data
            </Button>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Danger Zone */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>Irreversible actions - proceed with caution</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleDeleteAllData} variant="destructive" className="w-full" disabled={isLoading}>
            <Trash2 className="mr-2 h-4 w-4" />
            {isLoading ? "Deleting..." : "Delete All Data"}
          </Button>
          <p className="text-xs text-muted-foreground mt-2">
            This will permanently delete all research projects, insights, API keys, and settings
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
