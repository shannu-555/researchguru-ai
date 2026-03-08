import { useState, useEffect } from "react";
import { Eye, Loader2, TrendingUp, AlertTriangle, Users, Target, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

interface InsightDrillDownProps {
  projectId?: string;
  insightText: string;
  insightType: "strength" | "weakness" | "risk" | "opportunity" | "feature_gap";
  confidence?: number;
  impact?: string;
  triggerVariant?: "icon" | "text";
}

interface DrillDownData {
  explanation: string;
  supportingDataPoints: string[];
  sentimentSignals: { signal: string; direction: "positive" | "negative" | "neutral" }[];
  competitorReferences: { name: string; detail: string }[];
  strategicImpact: string;
}

export const InsightDrillDown = ({
  projectId,
  insightText,
  insightType,
  confidence,
  impact,
  triggerVariant = "icon",
}: InsightDrillDownProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<DrillDownData | null>(null);

  const typeLabels: Record<string, string> = {
    strength: "Strength",
    weakness: "Weakness",
    risk: "Risk",
    opportunity: "Opportunity",
    feature_gap: "Feature Gap",
  };

  const typeColors: Record<string, string> = {
    strength: "text-green-600 dark:text-green-400",
    weakness: "text-red-600 dark:text-red-400",
    risk: "text-yellow-600 dark:text-yellow-400",
    opportunity: "text-blue-600 dark:text-blue-400",
    feature_gap: "text-purple-600 dark:text-purple-400",
  };

  useEffect(() => {
    if (!open || data) return;
    loadDrillDownData();
  }, [open]);

  const loadDrillDownData = async () => {
    setLoading(true);
    try {
      // Fetch agent results and insights to build context
      const queries = projectId
        ? [
            supabase.from("agent_results").select("agent_type, results, status").eq("project_id", projectId).eq("status", "completed"),
            supabase.from("insights").select("insight_type, data").eq("project_id", projectId),
          ]
        : [
            supabase.from("agent_results").select("agent_type, results, status").eq("status", "completed").limit(20),
            supabase.from("insights").select("insight_type, data").limit(20),
          ];

      const [agentRes, insightsRes] = await Promise.all(queries);
      const agents = agentRes.data ?? [];
      const insights = insightsRes.data ?? [];

      // Build drill-down from existing data
      const drillDown = buildDrillDown(insightText, insightType, agents, insights);
      setData(drillDown);
    } catch (err) {
      console.error("DrillDown fetch error:", err);
      setData(buildFallback(insightText, insightType));
    } finally {
      setLoading(false);
    }
  };

  const buildDrillDown = (
    text: string,
    type: string,
    agents: any[],
    insights: any[]
  ): DrillDownData => {
    const sentiment = agents.find((a) => a.agent_type === "sentiment")?.results as any;
    const competitor = agents.find((a) => a.agent_type === "competitor")?.results as any;
    const trend = agents.find((a) => a.agent_type === "trend")?.results as any;

    // Supporting data points from agent results
    const supportingDataPoints: string[] = [];
    if (sentiment) {
      supportingDataPoints.push(
        `Sentiment distribution: ${sentiment.positive ?? 0}% positive, ${sentiment.neutral ?? 0}% neutral, ${sentiment.negative ?? 0}% negative`
      );
      if (sentiment.overallScore) supportingDataPoints.push(`Overall sentiment score: ${sentiment.overallScore}`);
    }
    if (trend) {
      if (trend.trendScore) supportingDataPoints.push(`Market trend score: ${trend.trendScore}`);
      if (trend.growthRate) supportingDataPoints.push(`Growth rate: ${trend.growthRate}%`);
      if (trend.demandPattern) supportingDataPoints.push(`Demand pattern: ${trend.demandPattern}`);
    }
    if (competitor?.competitors?.length) {
      supportingDataPoints.push(`${competitor.competitors.length} competitors analyzed in the market`);
    }

    // Sentiment signals
    const sentimentSignals: DrillDownData["sentimentSignals"] = [];
    if (sentiment?.positiveThemes?.length) {
      sentiment.positiveThemes.slice(0, 3).forEach((t: any) => {
        sentimentSignals.push({
          signal: typeof t === "string" ? t : t.theme,
          direction: "positive",
        });
      });
    }
    if (sentiment?.negativeThemes?.length) {
      sentiment.negativeThemes.slice(0, 3).forEach((t: any) => {
        sentimentSignals.push({
          signal: typeof t === "string" ? t : t.theme,
          direction: "negative",
        });
      });
    }
    if (sentimentSignals.length === 0) {
      sentimentSignals.push({ signal: "No sentiment themes available yet", direction: "neutral" });
    }

    // Competitor references
    const competitorReferences: DrillDownData["competitorReferences"] = [];
    if (competitor?.competitors?.length) {
      competitor.competitors.slice(0, 4).forEach((c: any) => {
        competitorReferences.push({
          name: c.name ?? "Unknown",
          detail: `${c.company ?? "N/A"} — Rating: ${c.rating ?? "N/A"}/5, Price: ${c.price ?? "N/A"}`,
        });
      });
    }

    // Explanation
    const explanationMap: Record<string, string> = {
      strength: `This strength was identified through analysis of positive sentiment patterns, market positioning data, and competitive advantages. The insight "${text}" reflects areas where the product excels relative to market expectations and competitor offerings.`,
      weakness: `This weakness was detected from negative sentiment signals, feature gap comparisons, and user feedback patterns. The insight "${text}" highlights an area requiring attention to maintain competitive positioning.`,
      risk: `This risk was flagged based on market trend analysis, competitive movements, and emerging threat patterns. The insight "${text}" represents a potential challenge that could impact market position if left unaddressed.`,
      opportunity: `This opportunity was surfaced through analysis of market gaps, emerging trends, and unmet customer needs. The insight "${text}" represents a potential growth area supported by market signals.`,
      feature_gap: `This feature gap was identified by comparing product capabilities against competitor offerings and customer expectations. The insight "${text}" represents a functional area where development could improve competitive position.`,
    };

    // Strategic impact
    const strategicImpactMap: Record<string, string> = {
      strength: "Leverage this strength in marketing and positioning. It provides a defensible competitive advantage that should be maintained and communicated clearly to target audiences.",
      weakness: "Address this weakness through targeted development or strategic partnerships. Leaving it unresolved may erode market share as competitors capitalize on the gap.",
      risk: "Develop mitigation strategies and monitor closely. Consider scenario planning to prepare contingency responses if this risk materializes.",
      opportunity: "Prioritize exploration and resource allocation toward this opportunity. Early movers in this space may establish significant competitive advantages.",
      feature_gap: "Evaluate the cost-benefit of closing this gap. High-priority gaps with competitor parity should be addressed in the near-term product roadmap.",
    };

    return {
      explanation: explanationMap[type] ?? `Detailed analysis for: "${text}"`,
      supportingDataPoints,
      sentimentSignals,
      competitorReferences,
      strategicImpact: strategicImpactMap[type] ?? "Evaluate strategic implications and adjust planning accordingly.",
    };
  };

  const buildFallback = (text: string, type: string): DrillDownData => ({
    explanation: `This ${typeLabels[type]?.toLowerCase() ?? "insight"} — "${text}" — was generated from available research data. Additional research runs may enrich the supporting evidence.`,
    supportingDataPoints: ["Run additional research to generate more supporting data points."],
    sentimentSignals: [{ signal: "No sentiment data available yet", direction: "neutral" as const }],
    competitorReferences: [],
    strategicImpact: "Complete more research analyses to generate a comprehensive strategic impact assessment.",
  });

  const directionIcon = (d: string) => {
    if (d === "positive") return <TrendingUp className="h-3.5 w-3.5 text-green-500" />;
    if (d === "negative") return <AlertTriangle className="h-3.5 w-3.5 text-red-500" />;
    return <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {triggerVariant === "icon" ? (
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground">
            <Eye className="h-3.5 w-3.5" />
            Details
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="gap-1">
            <Eye className="h-3.5 w-3.5" />
            View Details
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={typeColors[insightType]}>
              {typeLabels[insightType]}
            </Badge>
            {confidence !== undefined && (
              <span className="text-xs text-muted-foreground">Confidence: {confidence}%</span>
            )}
            {impact && (
              <Badge variant="secondary" className="text-xs capitalize">
                {impact} impact
              </Badge>
            )}
          </div>
          <DialogTitle className="text-base leading-snug pt-1">{insightText}</DialogTitle>
          <DialogDescription>Detailed breakdown of this insight</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="ml-2 text-sm text-muted-foreground">Loading details…</span>
          </div>
        ) : data ? (
          <div className="space-y-5 pt-2">
            {/* Detailed Explanation */}
            <section>
              <h4 className="text-sm font-semibold flex items-center gap-2 mb-2">
                <Target className="h-4 w-4 text-primary" />
                Detailed Explanation
              </h4>
              <p className="text-sm text-muted-foreground leading-relaxed">{data.explanation}</p>
            </section>

            <Separator />

            {/* Supporting Data Points */}
            <section>
              <h4 className="text-sm font-semibold flex items-center gap-2 mb-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                Supporting Data Points
              </h4>
              {data.supportingDataPoints.length > 0 ? (
                <ul className="space-y-1.5">
                  {data.supportingDataPoints.map((dp, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-primary mt-0.5">•</span>
                      {dp}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground italic">No supporting data available yet.</p>
              )}
            </section>

            <Separator />

            {/* Sentiment Signals */}
            <section>
              <h4 className="text-sm font-semibold flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Related Sentiment Signals
              </h4>
              <div className="space-y-2">
                {data.sentimentSignals.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm p-2 rounded-md bg-muted/50">
                    {directionIcon(s.direction)}
                    <span className="text-muted-foreground">{s.signal}</span>
                    <Badge variant="outline" className="ml-auto text-xs capitalize">
                      {s.direction}
                    </Badge>
                  </div>
                ))}
              </div>
            </section>

            <Separator />

            {/* Competitor References */}
            <section>
              <h4 className="text-sm font-semibold flex items-center gap-2 mb-2">
                <Users className="h-4 w-4 text-primary" />
                Competitor References
              </h4>
              {data.competitorReferences.length > 0 ? (
                <div className="space-y-2">
                  {data.competitorReferences.map((c, i) => (
                    <div key={i} className="p-2 rounded-md border border-border/50 bg-muted/30">
                      <span className="text-sm font-medium">{c.name}</span>
                      <p className="text-xs text-muted-foreground mt-0.5">{c.detail}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">No competitor data available. Run competitor analysis first.</p>
              )}
            </section>

            <Separator />

            {/* Strategic Impact */}
            <section>
              <h4 className="text-sm font-semibold flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-primary" />
                Strategic Impact Summary
              </h4>
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                <p className="text-sm text-foreground leading-relaxed">{data.strategicImpact}</p>
              </div>
            </section>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};
