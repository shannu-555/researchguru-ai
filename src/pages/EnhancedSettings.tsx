import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Palette, Brain, Search, Database, Settings2, Shield, Bell, Clock, Download, Gauge, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useTheme } from "next-themes";
import { WorkspaceCollaboration } from "@/components/WorkspaceCollaboration";
import { toast as sonnerToast } from "sonner";
import { jsPDF } from "jspdf";

interface SettingsState {
  // AI Model
  modelProvider: string;
  temperature: number;
  maxTokens: number;
  responseStyle: string;
  // Research
  researchDepth: string;
  maxSources: number;
  // Data Sources
  sourcesEnabled: { amazon: boolean; reddit: boolean; googleNews: boolean; techBlogs: boolean };
  // RAG
  embeddingModel: string;
  chunkSize: number;
  chunkOverlap: number;
  similarityThreshold: number;
  // API Usage
  dailyTokenLimit: number;
  budgetAlert: number;
  // Insights
  insightSensitivity: number;
  // Notifications
  researchCompletion: boolean;
  opportunityDetection: boolean;
  emailNotifications: boolean;
  inAppNotifications: boolean;
  agentComplete: boolean;
  newInsights: boolean;
  // Security
  sessionTimeout: number;
  twoFactorEnabled: boolean;
  // Data Retention
  retentionDays: string;
  // Agent toggles
  agents: { sentiment: boolean; competitor: boolean; trends: boolean; insights: boolean };
  voiceOutput: boolean;
}

const DEFAULT_SETTINGS: SettingsState = {
  modelProvider: "lovable-ai",
  temperature: 0.7,
  maxTokens: 4096,
  responseStyle: "balanced",
  researchDepth: "standard",
  maxSources: 50,
  sourcesEnabled: { amazon: true, reddit: true, googleNews: true, techBlogs: true },
  embeddingModel: "text-embedding-ada-002",
  chunkSize: 512,
  chunkOverlap: 50,
  similarityThreshold: 0.7,
  dailyTokenLimit: 100000,
  budgetAlert: 80,
  insightSensitivity: 50,
  researchCompletion: true,
  opportunityDetection: true,
  emailNotifications: true,
  inAppNotifications: true,
  agentComplete: true,
  newInsights: true,
  sessionTimeout: 30,
  twoFactorEnabled: false,
  retentionDays: "90",
  agents: { sentiment: true, competitor: true, trends: true, insights: true },
  voiceOutput: false,
};

export default function EnhancedSettings() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const [settings, setSettings] = useState<SettingsState>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

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

      <Accordion type="multiple" className="space-y-3" defaultValue={["ai-model", "agents"]}>

        {/* 1. AI Model Settings */}
        <AccordionItem value="ai-model" className="border rounded-lg">
          <AccordionTrigger className="px-6 hover:no-underline">
            <div className="flex items-center gap-2"><Brain className="h-5 w-5 text-primary" /><span className="text-lg font-semibold">AI Model Settings</span></div>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-6 space-y-3">
            <SettingRow label="Model Provider" desc="Select AI model provider for analysis">
              <Select value={settings.modelProvider} onValueChange={v => update("modelProvider", v)}>
                <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="lovable-ai">Lovable AI</SelectItem>
                  <SelectItem value="groq">Groq</SelectItem>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="anthropic">Anthropic</SelectItem>
                </SelectContent>
              </Select>
            </SettingRow>
            <SettingRow label={`Temperature: ${settings.temperature.toFixed(1)}`} desc="Controls randomness (0 = focused, 1 = creative)">
              <Slider value={[settings.temperature]} onValueChange={([v]) => update("temperature", v)} min={0} max={1} step={0.1} className="w-[140px]" />
            </SettingRow>
            <SettingRow label={`Max Tokens: ${settings.maxTokens}`} desc="Maximum response length">
              <Slider value={[settings.maxTokens]} onValueChange={([v]) => update("maxTokens", v)} min={256} max={16384} step={256} className="w-[140px]" />
            </SettingRow>
            <SettingRow label="Response Style" desc="How AI structures responses">
              <Select value={settings.responseStyle} onValueChange={v => update("responseStyle", v)}>
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="concise">Concise</SelectItem>
                  <SelectItem value="balanced">Balanced</SelectItem>
                  <SelectItem value="detailed">Detailed</SelectItem>
                  <SelectItem value="technical">Technical</SelectItem>
                </SelectContent>
              </Select>
            </SettingRow>
          </AccordionContent>
        </AccordionItem>

        {/* 2. Research Configuration */}
        <AccordionItem value="research" className="border rounded-lg">
          <AccordionTrigger className="px-6 hover:no-underline">
            <div className="flex items-center gap-2"><Search className="h-5 w-5 text-primary" /><span className="text-lg font-semibold">Research Configuration</span></div>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-6 space-y-3">
            <SettingRow label="Research Depth" desc="Controls how thorough each analysis is">
              <Select value={settings.researchDepth} onValueChange={v => update("researchDepth", v)}>
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="quick">Quick</SelectItem>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="deep">Deep</SelectItem>
                  <SelectItem value="exhaustive">Exhaustive</SelectItem>
                </SelectContent>
              </Select>
            </SettingRow>
            <SettingRow label={`Max Sources: ${settings.maxSources}`} desc="Maximum number of sources to analyze per run">
              <Slider value={[settings.maxSources]} onValueChange={([v]) => update("maxSources", v)} min={10} max={200} step={10} className="w-[140px]" />
            </SettingRow>
          </AccordionContent>
        </AccordionItem>

        {/* 3. Data Source Management */}
        <AccordionItem value="data-sources" className="border rounded-lg">
          <AccordionTrigger className="px-6 hover:no-underline">
            <div className="flex items-center gap-2"><Database className="h-5 w-5 text-primary" /><span className="text-lg font-semibold">Data Source Management</span></div>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-6 space-y-3">
            {([["amazon", "Amazon Reviews", "Product reviews and ratings"], ["reddit", "Reddit Discussions", "Reddit posts and comments"], ["googleNews", "Google News", "News articles and reports"], ["techBlogs", "Tech Blogs", "Technology and industry blogs"]] as const).map(([key, label, desc]) => (
              <SettingRow key={key} label={label} desc={desc}>
                <Switch checked={settings.sourcesEnabled[key]} onCheckedChange={v => update("sourcesEnabled", { ...settings.sourcesEnabled, [key]: v })} />
              </SettingRow>
            ))}
          </AccordionContent>
        </AccordionItem>

        {/* 4. RAG Configuration */}
        <AccordionItem value="rag" className="border rounded-lg">
          <AccordionTrigger className="px-6 hover:no-underline">
            <div className="flex items-center gap-2"><Settings2 className="h-5 w-5 text-primary" /><span className="text-lg font-semibold">RAG Configuration</span></div>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-6 space-y-3">
            <SettingRow label="Embedding Model" desc="Model used for vector embeddings">
              <Select value={settings.embeddingModel} onValueChange={v => update("embeddingModel", v)}>
                <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="text-embedding-ada-002">text-embedding-ada-002</SelectItem>
                  <SelectItem value="text-embedding-3-small">text-embedding-3-small</SelectItem>
                  <SelectItem value="text-embedding-3-large">text-embedding-3-large</SelectItem>
                </SelectContent>
              </Select>
            </SettingRow>
            <SettingRow label={`Chunk Size: ${settings.chunkSize}`} desc="Size of text chunks for embedding">
              <Slider value={[settings.chunkSize]} onValueChange={([v]) => update("chunkSize", v)} min={128} max={2048} step={64} className="w-[140px]" />
            </SettingRow>
            <SettingRow label={`Chunk Overlap: ${settings.chunkOverlap}`} desc="Overlap between consecutive chunks">
              <Slider value={[settings.chunkOverlap]} onValueChange={([v]) => update("chunkOverlap", v)} min={0} max={256} step={16} className="w-[140px]" />
            </SettingRow>
            <SettingRow label={`Similarity Threshold: ${settings.similarityThreshold.toFixed(2)}`} desc="Min similarity score for retrieval matches">
              <Slider value={[settings.similarityThreshold]} onValueChange={([v]) => update("similarityThreshold", v)} min={0.1} max={1} step={0.05} className="w-[140px]" />
            </SettingRow>
          </AccordionContent>
        </AccordionItem>

        {/* 5. API Usage Limits */}
        <AccordionItem value="api-usage" className="border rounded-lg">
          <AccordionTrigger className="px-6 hover:no-underline">
            <div className="flex items-center gap-2"><Gauge className="h-5 w-5 text-primary" /><span className="text-lg font-semibold">API Usage Limits</span></div>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-6 space-y-3">
            <SettingRow label={`Daily Token Limit: ${settings.dailyTokenLimit.toLocaleString()}`} desc="Maximum tokens consumed per day">
              <Slider value={[settings.dailyTokenLimit]} onValueChange={([v]) => update("dailyTokenLimit", v)} min={10000} max={500000} step={10000} className="w-[140px]" />
            </SettingRow>
            <SettingRow label={`Budget Alert at ${settings.budgetAlert}%`} desc="Alert when usage reaches this percentage">
              <Slider value={[settings.budgetAlert]} onValueChange={([v]) => update("budgetAlert", v)} min={50} max={100} step={5} className="w-[140px]" />
            </SettingRow>
          </AccordionContent>
        </AccordionItem>

        {/* 6. Insight Generation Settings */}
        <AccordionItem value="insights" className="border rounded-lg">
          <AccordionTrigger className="px-6 hover:no-underline">
            <div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /><span className="text-lg font-semibold">Insight Generation</span></div>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-6 space-y-3">
            <SettingRow label={`Sensitivity: ${settings.insightSensitivity}%`} desc="Higher = more insights generated (may include lower confidence)">
              <Slider value={[settings.insightSensitivity]} onValueChange={([v]) => update("insightSensitivity", v)} min={10} max={100} step={5} className="w-[140px]" />
            </SettingRow>
          </AccordionContent>
        </AccordionItem>

        {/* Agent Controls (existing) */}
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

        {/* 7. Notification Settings */}
        <AccordionItem value="notifications" className="border rounded-lg">
          <AccordionTrigger className="px-6 hover:no-underline">
            <div className="flex items-center gap-2"><Bell className="h-5 w-5 text-primary" /><span className="text-lg font-semibold">Notifications & Alerts</span></div>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-6 space-y-3">
            <SettingRow label="Research Completion" desc="Notify when research runs complete"><Switch checked={settings.researchCompletion} onCheckedChange={v => update("researchCompletion", v)} /></SettingRow>
            <SettingRow label="Opportunity Detection" desc="Alert on high-score opportunities"><Switch checked={settings.opportunityDetection} onCheckedChange={v => update("opportunityDetection", v)} /></SettingRow>
            <SettingRow label="Email Notifications" desc="Receive updates via email"><Switch checked={settings.emailNotifications} onCheckedChange={v => update("emailNotifications", v)} /></SettingRow>
            <SettingRow label="In-App Notifications" desc="Show toast notifications"><Switch checked={settings.inAppNotifications} onCheckedChange={v => update("inAppNotifications", v)} /></SettingRow>
            <SettingRow label="Agent Completion Alerts" desc="Notify when agents finish"><Switch checked={settings.agentComplete} onCheckedChange={v => update("agentComplete", v)} /></SettingRow>
            <SettingRow label="New Insights Alerts" desc="Notify on new insights"><Switch checked={settings.newInsights} onCheckedChange={v => update("newInsights", v)} /></SettingRow>
          </AccordionContent>
        </AccordionItem>

        {/* Theme (existing) */}
        <AccordionItem value="theme" className="border rounded-lg">
          <AccordionTrigger className="px-6 hover:no-underline">
            <div className="flex items-center gap-2"><Palette className="h-5 w-5" /><span className="text-lg font-semibold">Theme & Appearance</span></div>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-6">
            <SettingRow label="Theme Mode" desc="Choose your preferred color scheme">
              <div className="flex gap-2">
                {(["light", "dark", "system"] as const).map(t => (
                  <Button key={t} variant={theme === t ? "default" : "outline"} size="sm" onClick={() => setTheme(t)} className="capitalize">{t}</Button>
                ))}
              </div>
            </SettingRow>
            <div className="mt-3">
              <SettingRow label="Voice Output" desc="Enable text-to-speech for AI responses">
                <Switch checked={settings.voiceOutput} onCheckedChange={v => update("voiceOutput", v)} />
              </SettingRow>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* 8. Security Settings */}
        <AccordionItem value="security" className="border rounded-lg">
          <AccordionTrigger className="px-6 hover:no-underline">
            <div className="flex items-center gap-2"><Shield className="h-5 w-5 text-primary" /><span className="text-lg font-semibold">Security Settings</span></div>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-6 space-y-3">
            <SettingRow label={`Session Timeout: ${settings.sessionTimeout} min`} desc="Auto-logout after inactivity">
              <Slider value={[settings.sessionTimeout]} onValueChange={([v]) => update("sessionTimeout", v)} min={5} max={120} step={5} className="w-[140px]" />
            </SettingRow>
            <SettingRow label="Two-Factor Authentication" desc="Add an extra layer of security">
              <Switch checked={settings.twoFactorEnabled} onCheckedChange={v => update("twoFactorEnabled", v)} />
            </SettingRow>
          </AccordionContent>
        </AccordionItem>

        {/* 9. Data Retention */}
        <AccordionItem value="retention" className="border rounded-lg">
          <AccordionTrigger className="px-6 hover:no-underline">
            <div className="flex items-center gap-2"><Clock className="h-5 w-5 text-primary" /><span className="text-lg font-semibold">Data Retention Policy</span></div>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-6 space-y-3">
            <SettingRow label="Retention Period" desc="How long research data is stored">
              <Select value={settings.retentionDays} onValueChange={v => update("retentionDays", v)}>
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 days</SelectItem>
                  <SelectItem value="60">60 days</SelectItem>
                  <SelectItem value="90">90 days</SelectItem>
                  <SelectItem value="180">6 months</SelectItem>
                  <SelectItem value="365">1 year</SelectItem>
                  <SelectItem value="forever">Forever</SelectItem>
                </SelectContent>
              </Select>
            </SettingRow>
          </AccordionContent>
        </AccordionItem>

        {/* 10. Export & Backup */}
        <AccordionItem value="export" className="border rounded-lg">
          <AccordionTrigger className="px-6 hover:no-underline">
            <div className="flex items-center gap-2"><Download className="h-5 w-5 text-primary" /><span className="text-lg font-semibold">Export & Backup</span></div>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-6 space-y-3">
            <p className="text-sm text-muted-foreground mb-2">Export all your research data, notes, and insights as a JSON backup file.</p>
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
