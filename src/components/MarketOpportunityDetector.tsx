import { useState, useEffect, useMemo } from "react";
import { Radar, RefreshCw, Info, ChevronDown, ChevronUp, Loader2, Sparkles, Bot, PieChart, History, GitCompareArrows, Bell } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InsightDrillDown } from "@/components/InsightDrillDown";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  Legend, ResponsiveContainer, LineChart, Line,
} from "recharts";
import { format } from "date-fns";

interface MarketOpportunityDetectorProps {
  projectId: string | undefined;
}

interface ScoreBreakdown {
  label: string;
  value: number;
  color: string;
}

interface Opportunity {
  title: string;
  score: "high" | "medium" | "low";
  numericScore: number;
  evidence: string[];
  sources: string[];
  breakdown: ScoreBreakdown[];
  contributingAgents: string[];
}

interface HistoryPoint {
  date: string;
  avgScore: number;
  count: number;
}

interface ComparisonProject {
  id: string;
  name: string;
  avgScore: number;
  opportunities: Opportunity[];
}

const SCORE_CONFIG: Record<string, { label: string; color: string; badgeVariant: "default" | "secondary" | "outline" }> = {
  high: { label: "High", color: "text-green-600 dark:text-green-400", badgeVariant: "default" },
  medium: { label: "Medium", color: "text-yellow-600 dark:text-yellow-400", badgeVariant: "secondary" },
  low: { label: "Low", color: "text-muted-foreground", badgeVariant: "outline" },
};

const BREAKDOWN_COLORS = [
  "hsl(var(--primary))",
  "hsl(142 71% 45%)",
  "hsl(48 96% 53%)",
  "hsl(280 65% 60%)",
];

const COMPARISON_COLORS = [
  "hsl(var(--primary))",
  "hsl(142 71% 45%)",
  "hsl(280 65% 60%)",
  "hsl(48 96% 53%)",
];

/* ------------------------------------------------------------------ */
/*  Stacked breakdown bar                                              */
/* ------------------------------------------------------------------ */
const BreakdownBar = ({ breakdown, total }: { breakdown: ScoreBreakdown[]; total: number }) => {
  if (total === 0) return null;
  return (
    <div className="space-y-1.5 rounded-md bg-background/50 border border-border/30 p-2.5">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <PieChart className="h-3 w-3" />
        Score Breakdown
      </div>
      <div className="flex h-5 w-full rounded-full overflow-hidden bg-muted/40">
        {breakdown.map((b, i) => {
          const pct = (b.value / Math.max(total, 1)) * 100;
          if (pct <= 0) return null;
          return (
            <Tooltip key={i}>
              <TooltipTrigger asChild>
                <div
                  className="h-full transition-all duration-500"
                  style={{ width: `${pct}%`, backgroundColor: b.color }}
                />
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                {b.label}: {b.value}%
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {breakdown.map((b, i) => (
          <div key={i} className="flex items-center gap-1.5 text-xs">
            <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: b.color }} />
            <span className="text-muted-foreground">{b.label}</span>
            <span className="font-medium">{b.value}%</span>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between text-xs border-t border-border/30 pt-1 mt-1">
        <span className="font-semibold">Total Score</span>
        <span className="font-semibold">{Math.round(total)}%</span>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */
export const MarketOpportunityDetector = ({ projectId }: MarketOpportunityDetectorProps) => {
  const [isOpen, setIsOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [comparisonProjects, setComparisonProjects] = useState<ComparisonProject[]>([]);
  const [allProjects, setAllProjects] = useState<{ id: string; name: string }[]>([]);
  const [selectedCompareIds, setSelectedCompareIds] = useState<string[]>([]);
  const [isLoadingComparison, setIsLoadingComparison] = useState(false);

  const detect = async () => {
    setIsLoading(true);
    try {
      const queries = projectId
        ? [
            supabase.from("agent_results").select("agent_type, results, status, created_at").eq("project_id", projectId).eq("status", "completed"),
            supabase.from("insights").select("insight_type, data").eq("project_id", projectId),
          ]
        : [
            supabase.from("agent_results").select("agent_type, results, status, created_at").eq("status", "completed").limit(30),
            supabase.from("insights").select("insight_type, data").limit(30),
          ];

      const [agentsRes, insightsRes] = await Promise.all(queries);
      const agents = (agentsRes.data ?? []) as any[];
      const insights = (insightsRes.data ?? []) as any[];

      const detected = analyzeOpportunities(agents, insights);
      setOpportunities(detected);
      buildHistory(agents, insights);

      // Notify on high-score opportunities
      await notifyHighScoreOpportunities(detected);

      if (detected.length === 0) {
        toast.info("No market opportunities detected yet. Run more research to generate data.");
      }
    } catch (err) {
      console.error("Market opportunity detection error:", err);
      toast.error("Failed to detect market opportunities.");
    } finally {
      setIsLoading(false);
    }
  };

  const notifyHighScoreOpportunities = async (opps: Opportunity[]) => {
    const highScoreOpps = opps.filter((o) => o.numericScore >= 70);
    if (highScoreOpps.length === 0) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check if we already notified for these opportunities recently (last 24h)
      const { data: recentNotifs } = await supabase
        .from("user_notifications")
        .select("title")
        .eq("user_id", user.id)
        .eq("notification_type", "high_opportunity")
        .gte("created_at", new Date(Date.now() - 86400000).toISOString());

      const recentTitles = new Set((recentNotifs ?? []).map((n: any) => n.title));

      const newNotifs = highScoreOpps
        .filter((o) => !recentTitles.has(`High Opportunity: ${o.title}`))
        .slice(0, 3)
        .map((o) => ({
          user_id: user.id,
          notification_type: "high_opportunity",
          title: `High Opportunity: ${o.title}`,
          message: `Score: ${Math.round(o.numericScore)}% — ${o.evidence[0] ?? "Detected from cross-source analysis"}`,
          link: projectId ? `/ai-insights?project=${projectId}` : "/ai-insights",
        }));

      if (newNotifs.length > 0) {
        await supabase.from("user_notifications").insert(newNotifs);
        toast.success(`${newNotifs.length} high-score opportunity alert${newNotifs.length > 1 ? "s" : ""} created!`, {
          icon: <Bell className="h-4 w-4" />,
        });
      }
    } catch (err) {
      console.error("Failed to create opportunity notifications:", err);
    }
  };

  const buildHistory = (agents: any[], insights: any[]) => {
    const dateMap = new Map<string, any[]>();
    agents.forEach((a) => {
      const date = format(new Date(a.created_at), "MMM dd");
      if (!dateMap.has(date)) dateMap.set(date, []);
      dateMap.get(date)!.push(a);
    });

    const points: HistoryPoint[] = [];
    dateMap.forEach((dateAgents, date) => {
      const opps = analyzeOpportunities(dateAgents, insights);
      if (opps.length > 0) {
        const avg = Math.round(opps.reduce((s, o) => s + o.numericScore, 0) / opps.length);
        points.push({ date, avgScore: avg, count: opps.length });
      }
    });

    setHistory(points);
  };

  // Load all projects for comparison
  const loadProjects = async () => {
    const { data } = await supabase
      .from("research_projects")
      .select("id, product_name")
      .order("created_at", { ascending: false });
    if (data) {
      setAllProjects(data.map((p) => ({ id: p.id, name: p.product_name })));
    }
  };

  const addComparisonProject = async (id: string) => {
    if (selectedCompareIds.includes(id) || selectedCompareIds.length >= 4) return;
    setSelectedCompareIds((prev) => [...prev, id]);
    setIsLoadingComparison(true);

    try {
      const [agentsRes, insightsRes] = await Promise.all([
        supabase.from("agent_results").select("agent_type, results, status, created_at").eq("project_id", id).eq("status", "completed"),
        supabase.from("insights").select("insight_type, data").eq("project_id", id),
      ]);

      const agents = (agentsRes.data ?? []) as any[];
      const insights = (insightsRes.data ?? []) as any[];
      const opps = analyzeOpportunities(agents, insights);
      const proj = allProjects.find((p) => p.id === id);
      const avg = opps.length > 0 ? Math.round(opps.reduce((s, o) => s + o.numericScore, 0) / opps.length) : 0;

      setComparisonProjects((prev) => [
        ...prev,
        { id, name: proj?.name ?? "Unknown", avgScore: avg, opportunities: opps },
      ]);
    } catch (err) {
      console.error("Comparison load error:", err);
    } finally {
      setIsLoadingComparison(false);
    }
  };

  const removeComparisonProject = (id: string) => {
    setSelectedCompareIds((prev) => prev.filter((p) => p !== id));
    setComparisonProjects((prev) => prev.filter((p) => p.id !== id));
  };

  // Build comparison bar chart data
  const comparisonChartData = useMemo(() => {
    // Current project data
    const currentAvg = opportunities.length > 0
      ? Math.round(opportunities.reduce((s, o) => s + o.numericScore, 0) / opportunities.length)
      : 0;
    const currentName = allProjects.find((p) => p.id === projectId)?.name ?? "Current Project";

    const data = [
      { name: currentName.slice(0, 20), avgScore: currentAvg, count: opportunities.length },
      ...comparisonProjects.map((cp) => ({
        name: cp.name.slice(0, 20),
        avgScore: cp.avgScore,
        count: cp.opportunities.length,
      })),
    ];
    return data;
  }, [opportunities, comparisonProjects, projectId, allProjects]);

  useEffect(() => {
    detect();
    loadProjects();
  }, [projectId]);

  return (
    <Card className="border-border/50 shadow-lg">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Radar className="h-5 w-5 text-primary" />
              <CardTitle className="text-xl font-semibold">Market Opportunity Detector</CardTitle>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>
                    Automatically identifies market opportunities by cross-referencing negative sentiment (unmet needs),
                    feature gaps, and rising market trends from your existing research data.
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm">
                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
          </div>
          <CardDescription>
            Cross-source opportunity detection from sentiment, trends, competitors &amp; feature gaps
            {projectId ? "" : " (aggregated across all projects)"}
          </CardDescription>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-2 text-muted-foreground">Scanning for market opportunities…</span>
              </div>
            ) : opportunities.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No opportunities detected yet. Run sentiment, competitor, and trend analyses to generate data.
              </p>
            ) : (
              <>
                {/* Historical Score Timeline */}
                {history.length > 0 && (
                  <Collapsible open={showHistory} onOpenChange={setShowHistory}>
                    <CollapsibleTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full gap-2 text-xs">
                        <History className="h-3.5 w-3.5" />
                        {showHistory ? "Hide" : "Show"} Opportunity Score History
                        {showHistory ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="mt-3 p-4 rounded-lg border border-border/30 bg-background/50 space-y-2">
                        <h4 className="text-sm font-semibold flex items-center gap-1.5">
                          <History className="h-4 w-4 text-primary" />
                          Opportunity Score Trend
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          Average opportunity score across research runs
                        </p>
                        <ResponsiveContainer width="100%" height={180}>
                          <LineChart data={history}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                            <XAxis dataKey="date" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                            <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} className="text-muted-foreground" />
                            <RechartsTooltip
                              contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))" }}
                              formatter={(value: number, name: string) => [
                                name === "avgScore" ? `${value}%` : value,
                                name === "avgScore" ? "Avg Score" : "Opportunities"
                              ]}
                            />
                            <Line
                              type="monotone"
                              dataKey="avgScore"
                              stroke="hsl(var(--primary))"
                              strokeWidth={2}
                              dot={{ fill: "hsl(var(--primary))", r: 4 }}
                              name="avgScore"
                            />
                          </LineChart>
                        </ResponsiveContainer>
                        <div className="flex gap-4 text-xs text-muted-foreground">
                          {history.map((h, i) => (
                            <span key={i}>{h.date}: {h.count} opportunities</span>
                          ))}
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {/* Cross-Project Comparison */}
                <Collapsible open={showComparison} onOpenChange={setShowComparison}>
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full gap-2 text-xs">
                      <GitCompareArrows className="h-3.5 w-3.5" />
                      {showComparison ? "Hide" : "Show"} Cross-Project Comparison
                      {showComparison ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-3 p-4 rounded-lg border border-border/30 bg-background/50 space-y-3">
                      <h4 className="text-sm font-semibold flex items-center gap-1.5">
                        <GitCompareArrows className="h-4 w-4 text-primary" />
                        Compare Opportunity Scores Across Projects
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        Select up to 3 additional projects to compare opportunity scores side by side.
                      </p>

                      {/* Project selector */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <Select
                          onValueChange={(val) => addComparisonProject(val)}
                          disabled={selectedCompareIds.length >= 3}
                        >
                          <SelectTrigger className="w-56 h-8 text-xs">
                            <SelectValue placeholder="Add project to compare…" />
                          </SelectTrigger>
                          <SelectContent>
                            {allProjects
                              .filter((p) => p.id !== projectId && !selectedCompareIds.includes(p.id))
                              .map((p) => (
                                <SelectItem key={p.id} value={p.id} className="text-xs">
                                  {p.name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        {isLoadingComparison && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                      </div>

                      {/* Selected comparison badges */}
                      {comparisonProjects.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {comparisonProjects.map((cp) => (
                            <Badge
                              key={cp.id}
                              variant="secondary"
                              className="text-xs cursor-pointer gap-1"
                              onClick={() => removeComparisonProject(cp.id)}
                            >
                              {cp.name} — {cp.avgScore}% avg
                              <span className="text-muted-foreground ml-1">×</span>
                            </Badge>
                          ))}
                        </div>
                      )}

                      {/* Comparison Bar Chart */}
                      {comparisonProjects.length > 0 && (
                        <ResponsiveContainer width="100%" height={220}>
                          <BarChart data={comparisonChartData} layout="vertical" margin={{ left: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                            <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                            <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={100} />
                            <RechartsTooltip
                              contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))" }}
                              formatter={(value: number, name: string) => [
                                name === "avgScore" ? `${value}%` : value,
                                name === "avgScore" ? "Avg Score" : "Opportunities"
                              ]}
                            />
                            <Bar dataKey="avgScore" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name="avgScore" />
                            <Bar dataKey="count" fill="hsl(142 71% 45%)" radius={[0, 4, 4, 0]} name="count" />
                            <Legend formatter={(value) => value === "avgScore" ? "Avg Score %" : "# Opportunities"} />
                          </BarChart>
                        </ResponsiveContainer>
                      )}

                      {/* Detailed comparison table */}
                      {comparisonProjects.length > 0 && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-border/30">
                                <th className="text-left py-1.5 font-medium text-muted-foreground">Project</th>
                                <th className="text-center py-1.5 font-medium text-muted-foreground">Avg Score</th>
                                <th className="text-center py-1.5 font-medium text-muted-foreground">Opportunities</th>
                                <th className="text-center py-1.5 font-medium text-muted-foreground">High</th>
                                <th className="text-center py-1.5 font-medium text-muted-foreground">Medium</th>
                                <th className="text-center py-1.5 font-medium text-muted-foreground">Low</th>
                              </tr>
                            </thead>
                            <tbody>
                              {/* Current project row */}
                              <tr className="border-b border-border/20 bg-primary/5">
                                <td className="py-1.5 font-medium">
                                  {allProjects.find((p) => p.id === projectId)?.name ?? "Current"} ★
                                </td>
                                <td className="text-center font-semibold">
                                  {opportunities.length > 0 ? Math.round(opportunities.reduce((s, o) => s + o.numericScore, 0) / opportunities.length) : 0}%
                                </td>
                                <td className="text-center">{opportunities.length}</td>
                                <td className="text-center text-green-600">{opportunities.filter((o) => o.score === "high").length}</td>
                                <td className="text-center text-yellow-600">{opportunities.filter((o) => o.score === "medium").length}</td>
                                <td className="text-center text-muted-foreground">{opportunities.filter((o) => o.score === "low").length}</td>
                              </tr>
                              {comparisonProjects.map((cp) => (
                                <tr key={cp.id} className="border-b border-border/20">
                                  <td className="py-1.5">{cp.name}</td>
                                  <td className="text-center font-semibold">{cp.avgScore}%</td>
                                  <td className="text-center">{cp.opportunities.length}</td>
                                  <td className="text-center text-green-600">{cp.opportunities.filter((o) => o.score === "high").length}</td>
                                  <td className="text-center text-yellow-600">{cp.opportunities.filter((o) => o.score === "medium").length}</td>
                                  <td className="text-center text-muted-foreground">{cp.opportunities.filter((o) => o.score === "low").length}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                {/* Opportunity Cards */}
                <ul className="space-y-4">
                  {opportunities.map((opp, idx) => {
                    const cfg = SCORE_CONFIG[opp.score];
                    return (
                      <li
                        key={idx}
                        className="p-4 rounded-lg border border-border/50 bg-muted/30 space-y-3"
                      >
                        {/* Title row */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2">
                            <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                            <span className="text-sm font-medium leading-snug">{opp.title}</span>
                          </div>
                          <Badge variant={cfg.badgeVariant} className={`shrink-0 capitalize ${cfg.color}`}>
                            {cfg.label}
                          </Badge>
                        </div>

                        {/* Score bar */}
                        <div className="flex items-center gap-3 text-xs">
                          <span className="text-muted-foreground w-24 shrink-0">Opportunity Score</span>
                          <Progress value={opp.numericScore} className="h-2 flex-1" />
                          <span className="font-medium w-8 text-right">{Math.round(opp.numericScore)}%</span>
                        </div>

                        {/* Stacked Breakdown Bar */}
                        <BreakdownBar breakdown={opp.breakdown} total={opp.numericScore} />

                        {/* Contributing Agents */}
                        <div className="space-y-1">
                          <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                            <Bot className="h-3 w-3" /> Contributing Agents
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {opp.contributingAgents.map((agent, i) => (
                              <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0.5">{agent}</Badge>
                            ))}
                          </div>
                        </div>

                        {/* Evidence */}
                        <div className="space-y-1">
                          <span className="text-xs font-medium text-muted-foreground">Supporting Evidence</span>
                          <ul className="space-y-1">
                            {opp.evidence.map((ev, i) => (
                              <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                                <span className="text-primary mt-px">•</span>
                                {ev}
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Sources */}
                        <div className="flex flex-wrap gap-1.5">
                          {opp.sources.map((s, i) => (
                            <Badge key={i} variant="outline" className="text-[10px] px-1.5 py-0">
                              {s}
                            </Badge>
                          ))}
                        </div>

                        {/* Drill-down */}
                        <div className="flex justify-end">
                          <InsightDrillDown
                            projectId={projectId}
                            insightText={opp.title}
                            insightType="opportunity"
                            confidence={opp.numericScore}
                            impact={opp.score}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}

            <div className="flex justify-end pt-2">
              <Button onClick={detect} disabled={isLoading} variant="outline" size="sm">
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
                Re-scan Opportunities
              </Button>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};

/* ------------------------------------------------------------------ */
/*  Pure analysis logic — reads existing data, writes nothing          */
/* ------------------------------------------------------------------ */

function analyzeOpportunities(agents: any[], insights: any[]): Opportunity[] {
  const sentiment = agents.find((a) => a.agent_type === "sentiment")?.results as any;
  const competitor = agents.find((a) => a.agent_type === "competitor")?.results as any;
  const trend = agents.find((a) => a.agent_type === "trend")?.results as any;

  const opps: Opportunity[] = [];

  // 1. Negative-sentiment-driven opportunities (unmet needs)
  if (sentiment?.negativeThemes?.length) {
    const negPct = sentiment.negative ?? 0;
    sentiment.negativeThemes.slice(0, 3).forEach((t: any) => {
      const theme = typeof t === "string" ? t : t.theme ?? "";
      if (!theme) return;
      const basePart = 30;
      const sentimentPart = Math.round(negPct * 0.5);
      const volumePart = sentiment.negativeThemes.length > 2 ? 10 : 0;
      const score = Math.min(100, basePart + sentimentPart + volumePart);
      opps.push({
        title: `Address unmet need: "${theme}"`,
        numericScore: score,
        score: score >= 70 ? "high" : score >= 45 ? "medium" : "low",
        evidence: [
          `Negative sentiment at ${negPct}% indicates dissatisfaction`,
          `Theme "${theme}" repeatedly surfaced in user feedback`,
        ],
        sources: ["Sentiment Analysis"],
        breakdown: [
          { label: "Base Score", value: basePart, color: BREAKDOWN_COLORS[0] },
          { label: "Sentiment Dissatisfaction", value: sentimentPart, color: BREAKDOWN_COLORS[1] },
          { label: "Theme Volume Bonus", value: volumePart, color: BREAKDOWN_COLORS[2] },
        ],
        contributingAgents: ["Sentiment Agent"],
      });
    });
  }

  // 2. Feature-gap-driven opportunities
  const featureGapInsight = insights.find((i) => i.insight_type === "feature_gap");
  if (featureGapInsight?.data) {
    const d = featureGapInsight.data as any;
    const items: any[] = Array.isArray(d) ? d : d.features ?? d.items ?? d.list ?? [];
    const missingFeatures = items.filter(
      (f: any) => f.yourProduct === false && (f.competitor === true || f.competitor === "partial")
    );
    missingFeatures.slice(0, 3).forEach((f: any) => {
      const name = f.feature ?? f.text ?? f.name ?? "Unknown feature";
      const basePart = 50;
      const priorityBoost = f.priority === "high" ? 20 : f.priority === "medium" ? 10 : 0;
      const volumeBonus = missingFeatures.length > 2 ? 10 : 0;
      const score = Math.min(100, basePart + priorityBoost + volumeBonus);
      opps.push({
        title: `Close feature gap: "${name}"`,
        numericScore: score,
        score: score >= 70 ? "high" : score >= 45 ? "medium" : "low",
        evidence: [
          `Feature "${name}" is available in competitor products but missing in yours`,
          `Priority: ${f.priority ?? "unknown"}`,
        ],
        sources: ["Feature Gap Analysis", "Competitor Analysis"],
        breakdown: [
          { label: "Feature Gap Base", value: basePart, color: BREAKDOWN_COLORS[0] },
          { label: "Priority Boost", value: priorityBoost, color: BREAKDOWN_COLORS[1] },
          { label: "Gap Volume Bonus", value: volumeBonus, color: BREAKDOWN_COLORS[2] },
        ],
        contributingAgents: ["Competitor Agent"],
      });
    });
  }

  // 3. Trend-driven opportunities
  if (trend) {
    const growth = trend.growthRate ?? 0;
    if (growth > 0 && trend.emergingTopics?.length) {
      trend.emergingTopics.slice(0, 2).forEach((topic: string) => {
        const basePart = 35;
        const growthPart = Math.round(growth * 0.8);
        const trendScorePart = Math.round((trend.trendScore ?? 0) * 0.3);
        const score = Math.min(100, basePart + growthPart + trendScorePart);
        opps.push({
          title: `Capitalize on rising trend: "${topic}"`,
          numericScore: score,
          score: score >= 70 ? "high" : score >= 45 ? "medium" : "low",
          evidence: [
            `Market growth rate: ${growth}%`,
            `Trend score: ${trend.trendScore ?? "N/A"}`,
            `"${topic}" is an emerging topic with increasing search interest`,
          ],
          sources: ["Trend Analysis"],
          breakdown: [
            { label: "Base Score", value: basePart, color: BREAKDOWN_COLORS[0] },
            { label: "Trend Growth", value: growthPart, color: BREAKDOWN_COLORS[1] },
            { label: "Trend Score Factor", value: trendScorePart, color: BREAKDOWN_COLORS[2] },
          ],
          contributingAgents: ["Trend Agent"],
        });
      });
    }
  }

  // 4. Cross-signal: negative sentiment + competitor strength
  if (sentiment?.negative > 25 && competitor?.competitors?.length > 0) {
    const topComp = competitor.competitors[0];
    if (topComp?.rating && topComp.rating >= 4) {
      const basePart = 40;
      const sentimentPart = Math.round(sentiment.negative * 0.4);
      const ratingPart = Math.round(topComp.rating * 5);
      const score = Math.min(100, basePart + sentimentPart + ratingPart);
      opps.push({
        title: `Differentiate against ${topComp.name ?? "top competitor"} by resolving user pain points`,
        numericScore: score,
        score: score >= 70 ? "high" : score >= 45 ? "medium" : "low",
        evidence: [
          `Your product shows ${sentiment.negative}% negative sentiment`,
          `Top competitor "${topComp.name}" has a ${topComp.rating}/5 rating`,
          `Closing the satisfaction gap could capture market share`,
        ],
        sources: ["Sentiment Analysis", "Competitor Analysis"],
        breakdown: [
          { label: "Base Score", value: basePart, color: BREAKDOWN_COLORS[0] },
          { label: "Sentiment Dissatisfaction", value: sentimentPart, color: BREAKDOWN_COLORS[1] },
          { label: "Competitor Rating Factor", value: ratingPart, color: BREAKDOWN_COLORS[2] },
        ],
        contributingAgents: ["Sentiment Agent", "Competitor Agent"],
      });
    }
  }

  // Sort by score descending
  opps.sort((a, b) => b.numericScore - a.numericScore);
  return opps;
}
