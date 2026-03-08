import { useState, useEffect } from "react";
import { Radar, RefreshCw, Info, ChevronDown, ChevronUp, Loader2, Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { InsightDrillDown } from "@/components/InsightDrillDown";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface MarketOpportunityDetectorProps {
  projectId: string | undefined;
}

interface Opportunity {
  title: string;
  score: "high" | "medium" | "low";
  numericScore: number;
  evidence: string[];
  sources: string[];
}

const SCORE_CONFIG: Record<string, { label: string; color: string; badgeVariant: "default" | "secondary" | "outline" }> = {
  high: { label: "High", color: "text-green-600 dark:text-green-400", badgeVariant: "default" },
  medium: { label: "Medium", color: "text-yellow-600 dark:text-yellow-400", badgeVariant: "secondary" },
  low: { label: "Low", color: "text-muted-foreground", badgeVariant: "outline" },
};

export const MarketOpportunityDetector = ({ projectId }: MarketOpportunityDetectorProps) => {
  const [isOpen, setIsOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);

  const detect = async () => {
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
      const agents = (agentsRes.data ?? []) as any[];
      const insights = (insightsRes.data ?? []) as any[];

      const detected = analyzeOpportunities(agents, insights);
      setOpportunities(detected);

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

  useEffect(() => {
    detect();
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
                        <span className="font-medium w-8 text-right">{opp.numericScore}%</span>
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
      const score = Math.min(100, Math.round(30 + negPct * 0.5 + (sentiment.negativeThemes.length > 2 ? 10 : 0)));
      opps.push({
        title: `Address unmet need: "${theme}"`,
        numericScore: score,
        score: score >= 70 ? "high" : score >= 45 ? "medium" : "low",
        evidence: [
          `Negative sentiment at ${negPct}% indicates dissatisfaction`,
          `Theme "${theme}" repeatedly surfaced in user feedback`,
        ],
        sources: ["Sentiment Analysis"],
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
      const priorityBoost = f.priority === "high" ? 20 : f.priority === "medium" ? 10 : 0;
      const score = Math.min(100, 50 + priorityBoost + (missingFeatures.length > 2 ? 10 : 0));
      opps.push({
        title: `Close feature gap: "${name}"`,
        numericScore: score,
        score: score >= 70 ? "high" : score >= 45 ? "medium" : "low",
        evidence: [
          `Feature "${name}" is available in competitor products but missing in yours`,
          `Priority: ${f.priority ?? "unknown"}`,
        ],
        sources: ["Feature Gap Analysis", "Competitor Analysis"],
      });
    });
  }

  // 3. Trend-driven opportunities
  if (trend) {
    const growth = trend.growthRate ?? 0;
    if (growth > 0 && trend.emergingTopics?.length) {
      trend.emergingTopics.slice(0, 2).forEach((topic: string) => {
        const score = Math.min(100, Math.round(35 + growth * 0.8 + (trend.trendScore ?? 0) * 0.3));
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
        });
      });
    }
  }

  // 4. Cross-signal: negative sentiment + competitor strength
  if (sentiment?.negative > 25 && competitor?.competitors?.length > 0) {
    const topComp = competitor.competitors[0];
    if (topComp?.rating && topComp.rating >= 4) {
      const score = Math.min(100, Math.round(40 + sentiment.negative * 0.4 + topComp.rating * 5));
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
      });
    }
  }

  // Sort by score descending
  opps.sort((a, b) => b.numericScore - a.numericScore);
  return opps;
}
