import { useState, useEffect } from "react";
import { ShieldAlert, RefreshCw, Info, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { InsightDrillDown } from "@/components/InsightDrillDown";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CompetitiveThreatAlertsProps {
  projectId: string | undefined;
}

interface ThreatAlert {
  competitor: string;
  level: "high" | "medium" | "low";
  numericScore: number;
  explanation: string;
  signals: string[];
}

const LEVEL_CONFIG: Record<string, { color: string; bg: string; border: string; badge: "destructive" | "secondary" | "outline" }> = {
  high: { color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/30", border: "border-red-200 dark:border-red-900/50", badge: "destructive" },
  medium: { color: "text-yellow-600 dark:text-yellow-400", bg: "bg-yellow-50 dark:bg-yellow-950/30", border: "border-yellow-200 dark:border-yellow-900/50", badge: "secondary" },
  low: { color: "text-muted-foreground", bg: "bg-muted/30", border: "border-border/50", badge: "outline" },
};

export const CompetitiveThreatAlerts = ({ projectId }: CompetitiveThreatAlertsProps) => {
  const [isOpen, setIsOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [threats, setThreats] = useState<ThreatAlert[]>([]);

  const scan = async () => {
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
      const detected = detectThreats((agentsRes.data ?? []) as any[], (insightsRes.data ?? []) as any[]);
      setThreats(detected);

      if (detected.length === 0) {
        toast.info("No competitive threats detected. Run more research to generate data.");
      }
    } catch (err) {
      console.error("Threat detection error:", err);
      toast.error("Failed to scan for competitive threats.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { scan(); }, [projectId]);

  return (
    <Card className="border-border/50 shadow-lg">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" />
              <CardTitle className="text-xl font-semibold">Competitive Threat Alerts</CardTitle>
              <Tooltip>
                <TooltipTrigger><Info className="h-4 w-4 text-muted-foreground" /></TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>Detects competitors with rising sentiment, rapid trend growth, or closing feature gaps that may pose threats to your market position.</p>
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
            Automated threat detection from competitor sentiment, trends &amp; feature parity
            {projectId ? "" : " (aggregated across all projects)"}
          </CardDescription>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-2 text-muted-foreground">Scanning for competitive threats…</span>
              </div>
            ) : threats.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No competitive threats detected. Run competitor and trend analyses to generate data.
              </p>
            ) : (
              <ul className="space-y-4">
                {threats.map((t, idx) => {
                  const cfg = LEVEL_CONFIG[t.level];
                  return (
                    <li key={idx} className={`p-4 rounded-lg border ${cfg.border} ${cfg.bg} space-y-3`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <ShieldAlert className={`h-4 w-4 shrink-0 ${cfg.color}`} />
                          <span className="text-sm font-semibold">{t.competitor}</span>
                        </div>
                        <Badge variant={cfg.badge} className="capitalize shrink-0">{t.level} threat</Badge>
                      </div>

                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-muted-foreground w-20 shrink-0">Threat Level</span>
                        <Progress value={t.numericScore} className="h-2 flex-1" />
                        <span className="font-medium w-8 text-right">{Math.round(t.numericScore)}%</span>
                      </div>

                      <p className="text-sm text-muted-foreground">{t.explanation}</p>

                      <div className="space-y-1">
                        <span className="text-xs font-medium text-muted-foreground">Threat Signals</span>
                        <ul className="space-y-1">
                          {t.signals.map((s, i) => (
                            <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                              <span className="text-destructive mt-px">▸</span>{s}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="flex justify-end">
                        <InsightDrillDown
                          projectId={projectId}
                          insightText={`Competitive threat from ${t.competitor}`}
                          insightType="risk"
                          confidence={t.numericScore}
                          impact={t.level}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="flex justify-end pt-2">
              <Button onClick={scan} disabled={isLoading} variant="outline" size="sm">
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
                Re-scan Threats
              </Button>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};

/* ------------------------------------------------------------------ */
/*  Pure analysis — reads existing data only                           */
/* ------------------------------------------------------------------ */

function detectThreats(agents: any[], insights: any[]): ThreatAlert[] {
  const competitor = agents.find((a) => a.agent_type === "competitor")?.results as any;
  const sentiment = agents.find((a) => a.agent_type === "sentiment")?.results as any;
  const trend = agents.find((a) => a.agent_type === "trend")?.results as any;

  const featureGapInsight = insights.find((i) => i.insight_type === "feature_gap");
  const gapData = featureGapInsight?.data as any;
  const gapFeatures: any[] = Array.isArray(gapData) ? gapData : gapData?.features ?? gapData?.items ?? [];

  if (!competitor?.competitors?.length) return [];

  const alerts: ThreatAlert[] = [];

  competitor.competitors.forEach((comp: any) => {
    const name = comp.name ?? "Unknown";
    const signals: string[] = [];
    let score = 0;

    // Signal 1: High competitor rating (proxy for positive sentiment)
    const rating = comp.rating ?? 0;
    if (rating >= 4) {
      score += 25 + (rating - 4) * 15;
      signals.push(`High user rating of ${rating}/5 indicates strong positive sentiment`);
    } else if (rating >= 3.5) {
      score += 15;
      signals.push(`Moderate rating of ${rating}/5 with potential for growth`);
    }

    // Signal 2: Competitor has features you lack
    const compFeatureAdvantages = gapFeatures.filter(
      (f: any) => f.yourProduct === false && (f.competitor === true || f.competitor === "partial")
    );
    if (compFeatureAdvantages.length > 0) {
      score += Math.min(30, compFeatureAdvantages.length * 10);
      signals.push(`Competitor has ${compFeatureAdvantages.length} feature(s) your product lacks`);
    }

    // Signal 3: Market share / price competitiveness
    if (comp.marketShare && parseFloat(comp.marketShare) > 15) {
      score += 15;
      signals.push(`Holds ${comp.marketShare}% market share`);
    }
    if (comp.price && sentiment?.negative > 20) {
      score += 10;
      signals.push(`Price competition while your product faces ${sentiment.negative}% negative sentiment`);
    }

    // Signal 4: Trend growth benefiting competitor space
    if (trend?.growthRate && trend.growthRate > 10) {
      score += 10;
      signals.push(`Market growing at ${trend.growthRate}% — competitors positioned to capture share`);
    }

    if (signals.length === 0) return;

    score = Math.min(100, score);
    const level: ThreatAlert["level"] = score >= 65 ? "high" : score >= 35 ? "medium" : "low";

    alerts.push({
      competitor: name,
      level,
      numericScore: score,
      explanation:
        level === "high"
          ? `${name} poses a significant competitive threat with multiple strong signals across sentiment, features, and market positioning.`
          : level === "medium"
          ? `${name} shows moderate competitive pressure. Monitor closely for escalation.`
          : `${name} presents a low-level competitive signal. Keep on watch list.`,
      signals,
    });
  });

  alerts.sort((a, b) => b.numericScore - a.numericScore);
  return alerts;
}
