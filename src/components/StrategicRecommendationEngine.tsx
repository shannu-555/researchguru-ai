import { useState, useEffect, useCallback } from "react";
import { Compass, RefreshCw, Info, ChevronDown, ChevronUp, Loader2, ArrowRight, Check, X, Filter } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { InsightDrillDown } from "@/components/InsightDrillDown";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface StrategicRecommendationEngineProps {
  projectId: string | undefined;
}

interface Recommendation {
  title: string;
  action: string;
  evidence: string[];
  category: "feature" | "market" | "pricing" | "positioning" | "growth";
  priority: "high" | "medium" | "low";
  key: string; // stable identifier for tracking
}

type TrackingStatus = "pending" | "accepted" | "dismissed";
type FilterView = "all" | "pending" | "accepted" | "dismissed";

const CATEGORY_LABELS: Record<string, string> = {
  feature: "Feature Improvement",
  market: "Market Expansion",
  pricing: "Pricing Strategy",
  positioning: "Positioning",
  growth: "Growth Lever",
};

const PRIORITY_CONFIG: Record<string, { badge: "destructive" | "secondary" | "outline" }> = {
  high: { badge: "destructive" },
  medium: { badge: "secondary" },
  low: { badge: "outline" },
};

const STATUS_STYLES: Record<TrackingStatus, { bg: string; border: string; label: string }> = {
  pending: { bg: "bg-muted/30", border: "border-border/50", label: "Pending" },
  accepted: { bg: "bg-green-50 dark:bg-green-950/20", border: "border-green-200 dark:border-green-900/50", label: "Accepted" },
  dismissed: { bg: "bg-muted/10 opacity-60", border: "border-border/30", label: "Dismissed" },
};

export const StrategicRecommendationEngine = ({ projectId }: StrategicRecommendationEngineProps) => {
  const [isOpen, setIsOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [statuses, setStatuses] = useState<Record<string, TrackingStatus>>({});
  const [filterView, setFilterView] = useState<FilterView>("all");

  const generate = async () => {
    setIsLoading(true);
    try {
      const queries = projectId
        ? [
            supabase.from("agent_results").select("agent_type, results, status").eq("project_id", projectId).eq("status", "completed"),
            supabase.from("insights").select("insight_type, data").eq("project_id", projectId),
          ]
        : [
            supabase.from("agent_results").select("agent_type, results, status").eq("status", "completed").limit(30),
            supabase.from("insights").select("insight_type, data").limit(30),
          ];

      const [agentsRes, insightsRes] = await Promise.all(queries);
      const recs = buildRecommendations((agentsRes.data ?? []) as any[], (insightsRes.data ?? []) as any[]);
      setRecommendations(recs);

      // Load saved statuses
      await loadStatuses(recs.map((r) => r.key));

      if (recs.length === 0) {
        toast.info("No recommendations yet. Run more research to generate strategic insights.");
      }
    } catch (err) {
      console.error("Recommendation engine error:", err);
      toast.error("Failed to generate recommendations.");
    } finally {
      setIsLoading(false);
    }
  };

  const loadStatuses = async (keys: string[]) => {
    if (!projectId || keys.length === 0) return;
    try {
      const { data } = await supabase
        .from("recommendation_tracking" as any)
        .select("recommendation_key, status")
        .eq("project_id", projectId)
        .in("recommendation_key", keys);

      if (data) {
        const map: Record<string, TrackingStatus> = {};
        (data as any[]).forEach((row) => {
          map[row.recommendation_key] = row.status as TrackingStatus;
        });
        setStatuses(map);
      }
    } catch {
      // silently ignore — statuses are optional
    }
  };

  const updateStatus = useCallback(async (key: string, newStatus: TrackingStatus) => {
    if (!projectId) return;

    // Optimistic update
    setStatuses((prev) => ({ ...prev, [key]: newStatus }));

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please sign in to track recommendations.");
        return;
      }

      const { error } = await supabase.from("recommendation_tracking" as any).upsert(
        {
          user_id: user.id,
          project_id: projectId,
          recommendation_key: key,
          status: newStatus,
          updated_at: new Date().toISOString(),
        } as any,
        { onConflict: "user_id,project_id,recommendation_key" }
      );

      if (error) throw error;
      toast.success(`Recommendation ${newStatus}`);
    } catch (err) {
      console.error("Status update error:", err);
      toast.error("Failed to update recommendation status.");
      // Revert optimistic update
      setStatuses((prev) => {
        const copy = { ...prev };
        delete copy[key];
        return copy;
      });
    }
  }, [projectId]);

  useEffect(() => { generate(); }, [projectId]);

  const filteredRecs = recommendations.filter((rec) => {
    const s = statuses[rec.key] ?? "pending";
    return filterView === "all" || s === filterView;
  });

  const counts = {
    all: recommendations.length,
    pending: recommendations.filter((r) => (statuses[r.key] ?? "pending") === "pending").length,
    accepted: recommendations.filter((r) => statuses[r.key] === "accepted").length,
    dismissed: recommendations.filter((r) => statuses[r.key] === "dismissed").length,
  };

  return (
    <Card className="border-border/50 shadow-lg">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Compass className="h-5 w-5 text-primary" />
              <CardTitle className="text-xl font-semibold">Strategic Recommendation Engine</CardTitle>
              <Tooltip>
                <TooltipTrigger><Info className="h-4 w-4 text-muted-foreground" /></TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>Generates actionable strategic recommendations by synthesizing sentiment, feature gaps, trends, and competitive intelligence from your existing research.</p>
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
            Data-driven strategic actions from research insights
            {projectId ? "" : " (aggregated across all projects)"}
          </CardDescription>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="space-y-4">
            {/* Filter tabs */}
            {recommendations.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                {(["all", "pending", "accepted", "dismissed"] as FilterView[]).map((view) => (
                  <Button
                    key={view}
                    variant={filterView === view ? "default" : "outline"}
                    size="sm"
                    className="h-7 text-xs capitalize"
                    onClick={() => setFilterView(view)}
                  >
                    {view} ({counts[view]})
                  </Button>
                ))}
              </div>
            )}

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-2 text-muted-foreground">Generating strategic recommendations…</span>
              </div>
            ) : filteredRecs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                {recommendations.length === 0
                  ? "No recommendations available. Run sentiment, competitor, and trend analyses first."
                  : `No ${filterView} recommendations.`}
              </p>
            ) : (
              <ul className="space-y-4">
                {filteredRecs.map((rec) => {
                  const currentStatus = statuses[rec.key] ?? "pending";
                  const style = STATUS_STYLES[currentStatus];
                  return (
                    <li key={rec.key} className={`p-4 rounded-lg border ${style.border} ${style.bg} space-y-3 transition-all`}>
                      {/* Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2 flex-1">
                          <ArrowRight className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                          <span className="text-sm font-semibold leading-snug">{rec.title}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                          {currentStatus !== "pending" && (
                            <Badge variant={currentStatus === "accepted" ? "default" : "outline"} className="text-xs capitalize">
                              {style.label}
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-xs">{CATEGORY_LABELS[rec.category]}</Badge>
                          <Badge variant={PRIORITY_CONFIG[rec.priority].badge} className="text-xs capitalize">{rec.priority}</Badge>
                        </div>
                      </div>

                      {/* Action */}
                      <div className="p-3 rounded-md bg-primary/5 border border-primary/10">
                        <span className="text-xs font-medium text-primary">Strategic Action</span>
                        <p className="text-sm text-foreground mt-1">{rec.action}</p>
                      </div>

                      {/* Evidence */}
                      <div className="space-y-1">
                        <span className="text-xs font-medium text-muted-foreground">Supporting Evidence</span>
                        <ul className="space-y-1">
                          {rec.evidence.map((ev, i) => (
                            <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                              <span className="text-primary mt-px">•</span>{ev}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Actions row */}
                      <div className="flex items-center justify-between pt-1">
                        <div className="flex items-center gap-2">
                          {currentStatus !== "accepted" && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs gap-1 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950/30"
                              onClick={() => updateStatus(rec.key, "accepted")}
                            >
                              <Check className="h-3.5 w-3.5" />
                              Accept
                            </Button>
                          )}
                          {currentStatus !== "dismissed" && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs gap-1 text-muted-foreground hover:text-destructive"
                              onClick={() => updateStatus(rec.key, "dismissed")}
                            >
                              <X className="h-3.5 w-3.5" />
                              Dismiss
                            </Button>
                          )}
                          {currentStatus !== "pending" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs gap-1 text-muted-foreground"
                              onClick={() => updateStatus(rec.key, "pending")}
                            >
                              Reset
                            </Button>
                          )}
                        </div>
                        <InsightDrillDown
                          projectId={projectId}
                          insightText={rec.title}
                          insightType="opportunity"
                          impact={rec.priority}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="flex justify-end pt-2">
              <Button onClick={generate} disabled={isLoading} variant="outline" size="sm">
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
                Regenerate Recommendations
              </Button>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};
/* ------------------------------------------------------------------ */
/*  Pure recommendation logic — reads existing data only               */
/* ------------------------------------------------------------------ */

function buildRecommendations(agents: any[], insights: any[]): Recommendation[] {
  const sentiment = agents.find((a) => a.agent_type === "sentiment")?.results as any;
  const competitor = agents.find((a) => a.agent_type === "competitor")?.results as any;
  const trend = agents.find((a) => a.agent_type === "trend")?.results as any;

  const gapInsight = insights.find((i) => i.insight_type === "feature_gap");
  const gapData = gapInsight?.data as any;
  const gapFeatures: any[] = Array.isArray(gapData) ? gapData : gapData?.features ?? gapData?.items ?? [];

  const recs: Recommendation[] = [];

  // 1. Feature improvement recommendations from gaps
  const missingHighPriority = gapFeatures.filter(
    (f: any) => f.yourProduct === false && (f.competitor === true || f.competitor === "partial") && f.priority === "high"
  );
  if (missingHighPriority.length > 0) {
    const names = missingHighPriority.slice(0, 3).map((f: any) => f.feature ?? f.name ?? "unknown");
    recs.push({
      title: `Prioritize development of ${names.length} critical missing feature${names.length > 1 ? "s" : ""}`,
      action: `Allocate engineering resources to build ${names.join(", ")}. These features are available in competitor products and marked as high priority gaps.`,
      evidence: [
        `${missingHighPriority.length} high-priority features missing vs competitors`,
        ...names.map((n: string) => `"${n}" is available in competitor offerings`),
      ],
      category: "feature",
      priority: "high",
    });
  }

  const missingMedium = gapFeatures.filter(
    (f: any) => f.yourProduct === false && f.competitor === true && f.priority === "medium"
  );
  if (missingMedium.length > 0) {
    recs.push({
      title: `Plan roadmap for ${missingMedium.length} medium-priority feature gap${missingMedium.length > 1 ? "s" : ""}`,
      action: `Schedule these features in the next 1-2 quarters: ${missingMedium.slice(0, 3).map((f: any) => f.feature ?? "unknown").join(", ")}.`,
      evidence: [`${missingMedium.length} medium-priority gaps identified in feature comparison`],
      category: "feature",
      priority: "medium",
    });
  }

  // 2. Sentiment-driven recommendations
  if (sentiment) {
    if (sentiment.negative > 30) {
      const themes = (sentiment.negativeThemes ?? []).slice(0, 3).map((t: any) => typeof t === "string" ? t : t.theme);
      recs.push({
        title: "Address high negative sentiment to reduce churn risk",
        action: `Focus on resolving top user complaints${themes.length ? `: ${themes.join(", ")}` : ""}. Consider a dedicated "quality sprint" to address the most impactful issues.`,
        evidence: [
          `Negative sentiment at ${sentiment.negative}% — above healthy threshold`,
          ...(themes.length ? [`Top pain points: ${themes.join(", ")}`] : []),
        ],
        category: "positioning",
        priority: "high",
      });
    }

    if (sentiment.positive > 60) {
      const themes = (sentiment.positiveThemes ?? []).slice(0, 2).map((t: any) => typeof t === "string" ? t : t.theme);
      recs.push({
        title: "Amplify strong positive sentiment in marketing",
        action: `Leverage high user satisfaction (${sentiment.positive}% positive) in marketing materials. Highlight${themes.length ? ` "${themes.join('", "')}"` : " key strengths"} in campaigns and case studies.`,
        evidence: [
          `Positive sentiment at ${sentiment.positive}% indicates strong product-market fit`,
          ...(themes.length ? [`Key themes: ${themes.join(", ")}`] : []),
        ],
        category: "positioning",
        priority: "medium",
      });
    }
  }

  // 3. Trend-based market expansion
  if (trend) {
    if (trend.growthRate > 15 && trend.emergingTopics?.length) {
      const topics = trend.emergingTopics.slice(0, 2);
      recs.push({
        title: `Enter growing market segment around "${topics[0]}"`,
        action: `The market is growing at ${trend.growthRate}%. Position the product to capture emerging demand in ${topics.join(" and ")} by developing targeted features or content.`,
        evidence: [
          `Market growth rate: ${trend.growthRate}%`,
          `Trend score: ${trend.trendScore ?? "N/A"}`,
          `Emerging topics: ${topics.join(", ")}`,
        ],
        category: "market",
        priority: "high",
      });
    }

    if (trend.keywords?.length > 5) {
      recs.push({
        title: "Optimize SEO and content strategy around trending keywords",
        action: `Incorporate top trending keywords into product pages and content: ${trend.keywords.slice(0, 5).join(", ")}.`,
        evidence: [
          `${trend.keywords.length} trending keywords identified`,
          `Demand pattern: ${trend.demandPattern ?? "N/A"}`,
        ],
        category: "growth",
        priority: "medium",
      });
    }
  }

  // 4. Pricing strategy from competitor data
  if (competitor?.competitors?.length > 1) {
    const prices = competitor.competitors
      .map((c: any) => parseFloat(String(c.price ?? "").replace(/[^0-9.]/g, "")))
      .filter((p: number) => !isNaN(p) && p > 0);

    if (prices.length >= 2) {
      const avg = prices.reduce((a: number, b: number) => a + b, 0) / prices.length;
      const min = Math.min(...prices);
      const max = Math.max(...prices);
      recs.push({
        title: "Review pricing strategy relative to competitors",
        action: `Competitor pricing ranges from $${min.toFixed(0)} to $${max.toFixed(0)} (avg $${avg.toFixed(0)}). Evaluate whether your pricing reflects your value proposition and feature set. Consider tiered pricing to capture different segments.`,
        evidence: [
          `${prices.length} competitor prices analyzed`,
          `Price range: $${min.toFixed(0)} – $${max.toFixed(0)}`,
          `Average: $${avg.toFixed(0)}`,
        ],
        category: "pricing",
        priority: sentiment?.negative > 25 ? "high" : "medium",
      });
    }
  }

  // 5. Competitive differentiation
  if (competitor?.competitors?.length && sentiment) {
    const topRated = competitor.competitors.filter((c: any) => (c.rating ?? 0) >= 4);
    if (topRated.length > 0 && sentiment.negative > 20) {
      recs.push({
        title: "Strengthen differentiation against highly-rated competitors",
        action: `${topRated.length} competitor(s) have ratings ≥ 4/5 while your product faces ${sentiment.negative}% negative sentiment. Identify and double down on unique value propositions that competitors cannot easily replicate.`,
        evidence: [
          `${topRated.length} competitors with 4+ star ratings`,
          `Your negative sentiment: ${sentiment.negative}%`,
          "Differentiation is critical to maintain market position",
        ],
        category: "positioning",
        priority: "high",
      });
    }
  }

  // Sort: high first, then medium, then low
  const order = { high: 0, medium: 1, low: 2 };
  recs.sort((a, b) => order[a.priority] - order[b.priority]);
  return recs;
}
