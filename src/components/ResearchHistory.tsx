import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  History, Search, Trash2, Eye, RefreshCw, Pin, PinOff,
  Download, FileText, FileSpreadsheet, ChevronDown, ChevronUp,
  TrendingUp, Users, Lightbulb, Calendar, Filter
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface ResearchHistoryProps {
  onViewResults: (project: any, agentResults: Record<string, any>) => void;
  onRerun: (project: any) => void;
  onDeleted: () => void;
}

interface HistoryItem {
  id: string;
  product_name: string;
  company_name: string | null;
  description: string | null;
  status: string | null;
  created_at: string;
  updated_at: string;
  // enriched
  sentimentScore?: number | null;
  insightCount?: number;
  competitorCount?: number;
  pinned?: boolean;
}

export default function ResearchHistory({ onViewResults, onRerun, onDeleted }: ResearchHistoryProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [loadingResultsId, setLoadingResultsId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadHistory();
      loadPins();
    }
  }, [user]);

  const loadPins = () => {
    const stored = localStorage.getItem(`research_pins_${user?.id}`);
    if (stored) setPinnedIds(new Set(JSON.parse(stored)));
  };

  const savePins = (pins: Set<string>) => {
    localStorage.setItem(`research_pins_${user?.id}`, JSON.stringify([...pins]));
    setPinnedIds(pins);
  };

  const togglePin = (id: string) => {
    const next = new Set(pinnedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    savePins(next);
  };

  const loadHistory = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: projects } = await supabase
        .from("research_projects")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (!projects?.length) { setHistory([]); setLoading(false); return; }

      const projectIds = projects.map(p => p.id);

      const [agentRes, insightRes] = await Promise.all([
        supabase.from("agent_results").select("project_id, agent_type, results, status").in("project_id", projectIds),
        supabase.from("insights").select("project_id").in("project_id", projectIds),
      ]);

      const agentMap: Record<string, any[]> = {};
      (agentRes.data || []).forEach(r => {
        if (!agentMap[r.project_id]) agentMap[r.project_id] = [];
        agentMap[r.project_id].push(r);
      });

      const insightCounts: Record<string, number> = {};
      (insightRes.data || []).forEach(r => {
        insightCounts[r.project_id] = (insightCounts[r.project_id] || 0) + 1;
      });

      const enriched: HistoryItem[] = projects.map(p => {
        const agents = agentMap[p.id] || [];
        const sentiment = agents.find(a => a.agent_type === "sentiment");
        const competitors = agents.find(a => a.agent_type === "competitor");
        return {
          ...p,
          sentimentScore: sentiment?.results?.overallScore ?? null,
          insightCount: insightCounts[p.id] || 0,
          competitorCount: competitors?.results?.competitors?.length || 0,
          pinned: false,
        };
      });

      setHistory(enriched);
    } catch (e) {
      console.error("Failed to load history", e);
    } finally {
      setLoading(false);
    }
  };

  const handleViewResults = async (project: HistoryItem) => {
    setLoadingResultsId(project.id);
    try {
      const { data: agentResults } = await supabase
        .from("agent_results")
        .select("*")
        .eq("project_id", project.id);

      const outcomes: Record<string, any> = {};
      (agentResults || []).forEach(r => { outcomes[r.agent_type] = r; });
      onViewResults(project, outcomes);
    } catch (e) {
      toast({ title: "Error", description: "Failed to load results", variant: "destructive" });
    } finally {
      setLoadingResultsId(null);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await supabase.from("research_embeddings").delete().eq("project_id", id);
      await supabase.from("agent_results").delete().eq("project_id", id);
      await supabase.from("insights").delete().eq("project_id", id);
      await supabase.from("research_projects").delete().eq("id", id);
      toast({ title: "Deleted", description: "Research project removed." });
      loadHistory();
      onDeleted();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const companies = useMemo(() => {
    const set = new Set(history.map(h => h.company_name).filter(Boolean) as string[]);
    return [...set].sort();
  }, [history]);

  const filtered = useMemo(() => {
    let items = [...history];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      items = items.filter(h => h.product_name.toLowerCase().includes(q) || h.company_name?.toLowerCase().includes(q));
    }
    if (statusFilter !== "all") items = items.filter(h => h.status === statusFilter);
    if (companyFilter !== "all") items = items.filter(h => h.company_name === companyFilter);
    if (dateFilter) items = items.filter(h => h.created_at.startsWith(dateFilter));

    // pinned first
    items.sort((a, b) => {
      const ap = pinnedIds.has(a.id) ? 0 : 1;
      const bp = pinnedIds.has(b.id) ? 0 : 1;
      if (ap !== bp) return ap - bp;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return items;
  }, [history, searchQuery, statusFilter, companyFilter, dateFilter, pinnedIds]);

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("Research History Report", 14, 20);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);

    autoTable(doc, {
      startY: 35,
      head: [["Product", "Company", "Status", "Sentiment", "Insights", "Competitors", "Date"]],
      body: filtered.map(h => [
        h.product_name,
        h.company_name || "-",
        h.status || "-",
        h.sentimentScore != null ? `${h.sentimentScore}/10` : "-",
        String(h.insightCount || 0),
        String(h.competitorCount || 0),
        new Date(h.created_at).toLocaleDateString(),
      ]),
    });
    doc.save("research-history.pdf");
  };

  const exportCSV = () => {
    const headers = ["Product", "Company", "Status", "Sentiment Score", "Insights", "Competitors", "Date"];
    const rows = filtered.map(h => [
      h.product_name,
      h.company_name || "",
      h.status || "",
      h.sentimentScore != null ? String(h.sentimentScore) : "",
      String(h.insightCount || 0),
      String(h.competitorCount || 0),
      new Date(h.created_at).toLocaleDateString(),
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "research-history.csv";
    a.click();
  };

  if (loading) {
    return (
      <Card className="glass-effect border-border/50">
        <CardContent className="p-8 text-center text-muted-foreground">Loading history...</CardContent>
      </Card>
    );
  }

  if (!history.length) return null;

  return (
    <Card className="glass-effect border-border/50">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Recent Research History
            </CardTitle>
            <CardDescription>{history.length} research projects</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)} className="gap-1">
              <Filter className="h-4 w-4" />
              {showFilters ? "Hide" : "Filters"}
            </Button>
            <Button variant="outline" size="sm" onClick={exportPDF} className="gap-1">
              <FileText className="h-4 w-4" /> PDF
            </Button>
            <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1">
              <FileSpreadsheet className="h-4 w-4" /> CSV
            </Button>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="mt-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by product or company..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {showFilters && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={companyFilter} onValueChange={setCompanyFilter}>
                <SelectTrigger><SelectValue placeholder="Company" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Companies</SelectItem>
                  {companies.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} />
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-3">
          {filtered.length === 0 && (
            <p className="text-center text-muted-foreground py-4">No matching research found.</p>
          )}
          {filtered.map(project => {
            const isPinned = pinnedIds.has(project.id);
            const isLoadingThis = loadingResultsId === project.id;

            return (
              <div
                key={project.id}
                className={`group relative p-4 rounded-lg border transition-all cursor-pointer
                  ${isPinned
                    ? "bg-primary/5 border-primary/30 hover:bg-primary/10"
                    : "bg-secondary/50 border-border/50 hover:bg-secondary/70"
                  }`}
                onClick={() => project.status === "completed" && handleViewResults(project)}
              >
                {isPinned && (
                  <div className="absolute top-2 right-2">
                    <Pin className="h-3.5 w-3.5 text-primary" />
                  </div>
                )}

                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-semibold truncate">{project.product_name}</h4>
                      <Badge
                        variant="outline"
                        className={`text-xs ${
                          project.status === "completed" ? "bg-green-500/10 text-green-600 border-green-500/30" :
                          project.status === "in_progress" ? "bg-blue-500/10 text-blue-600 border-blue-500/30" :
                          project.status === "failed" ? "bg-destructive/10 text-destructive border-destructive/30" :
                          "bg-yellow-500/10 text-yellow-600 border-yellow-500/30"
                        }`}
                      >
                        {project.status}
                      </Badge>
                    </div>
                    {project.company_name && (
                      <p className="text-sm text-muted-foreground">{project.company_name}</p>
                    )}

                    {/* Preview metrics */}
                    <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(project.created_at).toLocaleDateString()}
                      </span>
                      {project.sentimentScore != null && (
                        <span className="flex items-center gap-1">
                          <TrendingUp className="h-3 w-3" />
                          Sentiment: {project.sentimentScore}/10
                        </span>
                      )}
                      {project.insightCount > 0 && (
                        <span className="flex items-center gap-1">
                          <Lightbulb className="h-3 w-3" />
                          {project.insightCount} insights
                        </span>
                      )}
                      {project.competitorCount > 0 && (
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {project.competitorCount} competitors
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                    {project.status === "completed" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1"
                        disabled={isLoadingThis}
                        onClick={() => handleViewResults(project)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">{isLoadingThis ? "Loading..." : "View"}</span>
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={() => onRerun(project)}
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Re-run</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => togglePin(project.id)}
                      className={isPinned ? "text-primary" : "text-muted-foreground"}
                    >
                      {isPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Research</AlertDialogTitle>
                          <AlertDialogDescription>
                            Permanently delete "{project.product_name}" and all associated data?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(project.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
