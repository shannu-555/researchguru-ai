import { useState, useEffect } from "react";
import { Database, RefreshCw, Loader2, ShieldCheck, AlertTriangle, CheckCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface DataTransparencyPanelProps {
  projectId: string | undefined;
}

interface DataSourceInfo {
  name: string;
  documents: number;
  lastUpdated: string;
  reliability: "High" | "Medium" | "Low";
}

const RELIABILITY_CONFIG = {
  High: { icon: CheckCircle, color: "text-green-600 dark:text-green-400", bg: "bg-green-500/10", badge: "default" as const },
  Medium: { icon: AlertTriangle, color: "text-yellow-600 dark:text-yellow-400", bg: "bg-yellow-500/10", badge: "secondary" as const },
  Low: { icon: ShieldCheck, color: "text-muted-foreground", bg: "bg-muted/40", badge: "outline" as const },
};

// Map agent_type / content_type to human-readable source names
const SOURCE_LABELS: Record<string, string> = {
  sentiment: "Amazon Reviews",
  competitor: "Competitor Analysis",
  trend: "Google News",
  reddit: "Reddit Discussions",
  review: "Amazon Reviews",
  news: "Google News",
  social: "Reddit Discussions",
  feature_gap: "Feature Gap Data",
};

function inferReliability(count: number): "High" | "Medium" | "Low" {
  if (count >= 50) return "High";
  if (count >= 10) return "Medium";
  return "Low";
}

export const DataTransparencyPanel = ({ projectId }: DataTransparencyPanelProps) => {
  const [isOpen, setIsOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [sources, setSources] = useState<DataSourceInfo[]>([]);

  const loadSources = async () => {
    setIsLoading(true);
    try {
      const baseAgentQuery = supabase
        .from("agent_results")
        .select("agent_type, status, created_at, results")
        .eq("status", "completed");

      const baseEmbeddingQuery = supabase
        .from("research_embeddings")
        .select("content_type, created_at");

      const agentQuery = projectId
        ? baseAgentQuery.eq("project_id", projectId)
        : baseAgentQuery.limit(100);

      const embeddingQuery = projectId
        ? baseEmbeddingQuery.eq("project_id", projectId)
        : baseEmbeddingQuery.limit(500);

      const [agentsRes, embeddingsRes] = await Promise.all([agentQuery, embeddingQuery]);

      const agents = (agentsRes.data ?? []) as any[];
      const embeddings = (embeddingsRes.data ?? []) as any[];

      // Aggregate by source
      const sourceMap = new Map<string, { count: number; lastDate: string }>();

      agents.forEach((a) => {
        const label = SOURCE_LABELS[a.agent_type] ?? a.agent_type;
        const existing = sourceMap.get(label);
        const date = a.created_at;
        if (existing) {
          existing.count += 1;
          if (date > existing.lastDate) existing.lastDate = date;
        } else {
          sourceMap.set(label, { count: 1, lastDate: date });
        }
      });

      // Count embeddings per content_type as document count
      const embeddingCounts = new Map<string, { count: number; lastDate: string }>();
      embeddings.forEach((e: any) => {
        const label = SOURCE_LABELS[e.content_type] ?? e.content_type;
        const existing = embeddingCounts.get(label);
        const date = e.created_at;
        if (existing) {
          existing.count += 1;
          if (date > existing.lastDate) existing.lastDate = date;
        } else {
          embeddingCounts.set(label, { count: 1, lastDate: date });
        }
      });

      // Merge: prefer embedding counts for document numbers, agent dates for freshness
      const mergedMap = new Map<string, { count: number; lastDate: string }>();

      sourceMap.forEach((val, key) => {
        mergedMap.set(key, { ...val });
      });

      embeddingCounts.forEach((val, key) => {
        const existing = mergedMap.get(key);
        if (existing) {
          existing.count = Math.max(existing.count, val.count);
          if (val.lastDate > existing.lastDate) existing.lastDate = val.lastDate;
        } else {
          mergedMap.set(key, { ...val });
        }
      });

      const result: DataSourceInfo[] = [];
      mergedMap.forEach((val, name) => {
        result.push({
          name,
          documents: val.count,
          lastUpdated: format(new Date(val.lastDate), "d MMM yyyy"),
          reliability: inferReliability(val.count),
        });
      });

      // Sort by document count descending
      result.sort((a, b) => b.documents - a.documents);
      setSources(result);
    } catch (err) {
      console.error("Data transparency load error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSources();
  }, [projectId]);

  return (
    <Card className="border-border/50 shadow-lg">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              <CardTitle className="text-xl font-semibold">Data Transparency</CardTitle>
            </div>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm">
                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
          </div>
          <CardDescription>
            Data sources powering the insights above — documents indexed, freshness, and reliability
          </CardDescription>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="space-y-3">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="ml-2 text-sm text-muted-foreground">Loading data sources…</span>
              </div>
            ) : sources.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No data sources found. Run research agents to populate this section.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {sources.map((src) => {
                  const cfg = RELIABILITY_CONFIG[src.reliability];
                  const Icon = cfg.icon;
                  return (
                    <div
                      key={src.name}
                      className="rounded-lg border border-border/50 bg-muted/20 p-4 space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold">{src.name}</span>
                        <Badge variant={cfg.badge} className={`text-[10px] ${cfg.color}`}>
                          {src.reliability}
                        </Badge>
                      </div>

                      <div className="space-y-1.5 text-xs text-muted-foreground">
                        <div className="flex justify-between">
                          <span>Documents</span>
                          <span className="font-medium text-foreground">{src.documents.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Last Updated</span>
                          <span className="font-medium text-foreground">{src.lastUpdated}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span>Reliability Score</span>
                          <span className={`flex items-center gap-1 font-medium ${cfg.color}`}>
                            <Icon className="h-3 w-3" />
                            {src.reliability}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Summary row */}
            {sources.length > 0 && (
              <div className="flex items-center justify-between pt-2 border-t border-border/30 text-xs text-muted-foreground">
                <span>
                  <strong className="text-foreground">{sources.length}</strong> sources •{" "}
                  <strong className="text-foreground">{sources.reduce((s, src) => s + src.documents, 0).toLocaleString()}</strong> total documents
                </span>
                <Button onClick={loadSources} disabled={isLoading} variant="ghost" size="sm" className="h-7 text-xs gap-1">
                  <RefreshCw className={`h-3 w-3 ${isLoading ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};
