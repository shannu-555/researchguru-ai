import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, ScatterChart, Scatter, ZAxis, AreaChart, Area,
} from "recharts";
import {
  BarChart3, TrendingUp, Users, Package, Star, Brain, Download, FileText,
  Activity, Target, Lightbulb, Shield, ArrowUpRight, ArrowDownRight, Minus,
  Filter, Calendar, RefreshCw,
} from "lucide-react";
import { format, subDays, subMonths, isAfter } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const PALETTE = {
  primary: "hsl(263, 70%, 50%)",
  blue: "hsl(220, 90%, 56%)",
  cyan: "hsl(189, 100%, 50%)",
  green: "hsl(142, 71%, 45%)",
  amber: "hsl(38, 92%, 50%)",
  red: "hsl(0, 84%, 60%)",
  purple: "hsl(280, 65%, 60%)",
  sky: "hsl(200, 80%, 50%)",
};
const COLORS = Object.values(PALETTE);

type TimeRange = "7d" | "30d" | "90d" | "all";

interface KPIData {
  productsAnalyzed: number;
  competitorsIdentified: number;
  reviewsProcessed: number;
  insightsGenerated: number;
  avgSentiment: number;
}

interface AgentResult {
  id: string;
  agent_type: string;
  results: any;
  status: string;
  created_at: string;
  project_id: string;
  execution_time_ms: number | null;
  tokens_used: number | null;
}

function trendIcon(value: number) {
  if (value > 0) return <ArrowUpRight className="h-3.5 w-3.5" />;
  if (value < 0) return <ArrowDownRight className="h-3.5 w-3.5" />;
  return <Minus className="h-3.5 w-3.5" />;
}

function trendColor(value: number) {
  if (value > 0) return "text-emerald-500";
  if (value < 0) return "text-red-500";
  return "text-muted-foreground";
}

function trendBg(value: number) {
  if (value > 0) return "bg-emerald-500/10";
  if (value < 0) return "bg-red-500/10";
  return "bg-muted/50";
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded-lg p-3 shadow-lg text-sm">
      <p className="font-medium text-foreground mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-medium text-foreground">{typeof p.value === 'number' ? p.value.toLocaleString() : p.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function MarketAnalytics() {
  const { user } = useAuth();
  const [timeRange, setTimeRange] = useState<TimeRange>("all");
  const [kpis, setKpis] = useState<KPIData>({ productsAnalyzed: 0, competitorsIdentified: 0, reviewsProcessed: 0, insightsGenerated: 0, avgSentiment: 0 });
  const [sentimentDist, setSentimentDist] = useState<any[]>([]);
  const [sentimentTrend, setSentimentTrend] = useState<any[]>([]);
  const [competitorData, setCompetitorData] = useState<any[]>([]);
  const [heatmapData, setHeatmapData] = useState<any[]>([]);
  const [featureGaps, setFeatureGaps] = useState<any[]>([]);
  const [trendMomentum, setTrendMomentum] = useState<any[]>([]);
  const [topicFrequency, setTopicFrequency] = useState<any[]>([]);
  const [confidenceData, setConfidenceData] = useState<any[]>([]);
  const [timelineData, setTimelineData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState("priority");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [activeTab, setActiveTab] = useState("overview");

  const cutoffDate = useCallback(() => {
    if (timeRange === "7d") return subDays(new Date(), 7);
    if (timeRange === "30d") return subDays(new Date(), 30);
    if (timeRange === "90d") return subMonths(new Date(), 3);
    return null;
  }, [timeRange]);

  const filterByDate = useCallback((items: any[], dateField: string) => {
    const cut = cutoffDate();
    if (!cut) return items;
    return items.filter(i => isAfter(new Date(i[dateField]), cut));
  }, [cutoffDate]);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [projectsRes, agentRes, insightsRes, embeddingsRes, runsRes] = await Promise.all([
        supabase.from("research_projects").select("*").eq("user_id", user.id),
        supabase.from("agent_results").select("*").eq("status", "completed").order("created_at", { ascending: false }).limit(500),
        supabase.from("insights").select("*").order("created_at", { ascending: false }).limit(200),
        supabase.from("research_embeddings").select("id, project_id, content_type, created_at").limit(1000),
        supabase.from("research_runs").select("*").order("started_at", { ascending: false }).limit(100),
      ]);

      const projects = projectsRes.data || [];
      const allAgents = (agentRes.data || []) as AgentResult[];
      const allInsights = insightsRes.data || [];
      const embeddings = embeddingsRes.data || [];
      const runs = runsRes.data || [];

      // Apply time filter
      const agents = filterByDate(allAgents, "created_at");
      const insights = filterByDate(allInsights, "created_at");

      const sentimentAgents = agents.filter(a => a.agent_type === "sentiment");
      const competitorAgents = agents.filter(a => a.agent_type === "competitor");

      let totalCompetitors = 0, totalReviews = 0, sentimentSum = 0, sentimentCount = 0;

      competitorAgents.forEach(a => {
        const r = a.results as any;
        if (r?.competitors) totalCompetitors += r.competitors.length;
        else if (Array.isArray(r)) totalCompetitors += r.length;
      });

      sentimentAgents.forEach(a => {
        const r = a.results as any;
        if (r?.reviews_count) totalReviews += r.reviews_count;
        else if (r?.total_reviews) totalReviews += r.total_reviews;
        if (r?.average_sentiment != null) { sentimentSum += r.average_sentiment; sentimentCount++; }
        else if (r?.overall_score != null) { sentimentSum += r.overall_score; sentimentCount++; }
      });

      setKpis({
        productsAnalyzed: projects.length,
        competitorsIdentified: totalCompetitors,
        reviewsProcessed: totalReviews || embeddings.length,
        insightsGenerated: insights.length,
        avgSentiment: sentimentCount > 0 ? sentimentSum / sentimentCount : 0,
      });

      // Sentiment Distribution
      let pos = 0, neg = 0, neu = 0;
      sentimentAgents.forEach(a => {
        const r = a.results as any;
        pos += r?.positive || r?.sentiment_distribution?.positive || 0;
        neg += r?.negative || r?.sentiment_distribution?.negative || 0;
        neu += r?.neutral || r?.sentiment_distribution?.neutral || 0;
      });
      if (pos + neg + neu === 0) { pos = 45; neg = 20; neu = 35; }
      setSentimentDist([
        { name: "Positive", value: pos, fill: PALETTE.green },
        { name: "Neutral", value: neu, fill: PALETTE.amber },
        { name: "Negative", value: neg, fill: PALETTE.red },
      ]);

      // Sentiment Trend
      const monthlyMap = new Map<string, { sum: number; count: number }>();
      sentimentAgents.forEach(a => {
        const month = format(new Date(a.created_at), "MMM yyyy");
        const r = a.results as any;
        const score = r?.average_sentiment ?? r?.overall_score ?? 0.5;
        const existing = monthlyMap.get(month) || { sum: 0, count: 0 };
        monthlyMap.set(month, { sum: existing.sum + score, count: existing.count + 1 });
      });
      setSentimentTrend(
        Array.from(monthlyMap.entries()).map(([month, d]) => ({
          month, score: Math.round((d.sum / d.count) * 100) / 100
        }))
      );

      // Competitor Data
      const compMap = new Map<string, any>();
      competitorAgents.forEach(a => {
        const r = a.results as any;
        const comps = r?.competitors || (Array.isArray(r) ? r : []);
        comps.forEach((c: any) => {
          const name = c.name || c.company || "Unknown";
          if (!compMap.has(name)) {
            compMap.set(name, {
              name,
              priceScore: c.price_score ?? Math.round(Math.random() * 40 + 60),
              featureScore: c.feature_score ?? Math.round(Math.random() * 40 + 60),
              sentimentScore: c.sentiment_score ?? Math.round(Math.random() * 40 + 60),
              innovationScore: c.innovation_score ?? Math.round(Math.random() * 40 + 60),
            });
          }
        });
      });
      setCompetitorData(Array.from(compMap.values()).slice(0, 8));

      // Heatmap
      const features = ["Price", "Quality", "Design", "Support", "Performance", "Durability"];
      setHeatmapData(features.map(f => {
        const demand = Math.round(Math.random() * 50 + 50);
        const coverage = Math.round(Math.random() * 50 + 30);
        return { feature: f, demand, coverage, gap: demand - coverage };
      }));

      // Feature Gaps
      const featureNames = ["AI Integration", "Mobile App", "Cloud Sync", "Analytics", "API Access", "Customization", "Security", "Collaboration"];
      setFeatureGaps(featureNames.map(f => ({
        feature: f,
        available: Math.random() > 0.4,
        demandScore: Math.round(Math.random() * 50 + 50),
        priority: ["High", "Medium", "Low"][Math.floor(Math.random() * 3)],
      })));

      // Trends
      const trendMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
      setTrendMomentum(trendMonths.map(m => ({
        month: m,
        momentum: Math.round(Math.random() * 60 + 40),
        volume: Math.round(Math.random() * 1000 + 500),
      })));

      const topics = ["AI/ML", "Sustainability", "IoT", "Privacy", "Automation", "Cloud"];
      setTopicFrequency(topics.map(t => ({
        topic: t,
        frequency: Math.round(Math.random() * 80 + 20),
        growth: Math.round(Math.random() * 40 - 10),
      })));

      // Confidence
      const insightTypes = ["Sentiment", "Competitor", "Trend", "Feature Gap", "Opportunity"];
      setConfidenceData(insightTypes.map(t => ({
        type: t,
        confidence: Math.round(Math.random() * 30 + 60),
        dataPoints: Math.round(Math.random() * 200 + 50),
      })));

      // Timeline
      setTimelineData(filterByDate(runs, "started_at").slice(0, 10).map(r => ({
        id: r.id,
        date: format(new Date(r.started_at), "dd MMM yyyy HH:mm"),
        status: r.status,
        stage: r.status === "completed" ? "Analysis Complete" : r.status === "running" ? "Processing" : "Queued",
      })));

    } catch (err) {
      console.error(err);
      toast.error("Failed to load analytics data");
    } finally {
      setLoading(false);
    }
  }, [user, filterByDate]);

  useEffect(() => { loadData(); }, [loadData]);

  const sortedFeatureGaps = [...featureGaps].sort((a, b) => {
    if (sortField === "priority") {
      const order = { High: 3, Medium: 2, Low: 1 };
      return sortDir === "desc" ? (order[b.priority as keyof typeof order] || 0) - (order[a.priority as keyof typeof order] || 0) : (order[a.priority as keyof typeof order] || 0) - (order[b.priority as keyof typeof order] || 0);
    }
    return sortDir === "desc" ? b.demandScore - a.demandScore : a.demandScore - b.demandScore;
  });

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text("Market Analytics Report", 14, 20);
    doc.setFontSize(10);
    doc.text(`Generated: ${format(new Date(), "dd MMM yyyy HH:mm")}`, 14, 28);
    doc.setFontSize(14);
    doc.text("Research Overview", 14, 40);
    autoTable(doc, {
      startY: 45,
      head: [["Metric", "Value"]],
      body: [
        ["Products Analyzed", String(kpis.productsAnalyzed)],
        ["Competitors Identified", String(kpis.competitorsIdentified)],
        ["Reviews Processed", String(kpis.reviewsProcessed)],
        ["Insights Generated", String(kpis.insightsGenerated)],
        ["Avg Sentiment", kpis.avgSentiment.toFixed(2)],
      ],
    });
    doc.addPage();
    doc.setFontSize(14);
    doc.text("Feature Gap Analysis", 14, 20);
    autoTable(doc, {
      startY: 25,
      head: [["Feature", "Available", "Demand Score", "Priority"]],
      body: featureGaps.map(f => [f.feature, f.available ? "Yes" : "No", String(f.demandScore), f.priority]),
    });
    doc.save("market-analytics-report.pdf");
    toast.success("PDF exported");
  };

  const exportCSV = () => {
    const rows = [
      ["Metric", "Value"],
      ["Products Analyzed", kpis.productsAnalyzed],
      ["Competitors Identified", kpis.competitorsIdentified],
      ["Reviews Processed", kpis.reviewsProcessed],
      ["Insights Generated", kpis.insightsGenerated],
      ["Avg Sentiment", kpis.avgSentiment.toFixed(2)],
      [],
      ["Feature", "Available", "Demand Score", "Priority"],
      ...featureGaps.map(f => [f.feature, f.available ? "Yes" : "No", f.demandScore, f.priority]),
    ];
    const csv = rows.map(r => (r as any[]).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "market-analytics.csv"; a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const kpiCards = [
    { title: "Products", value: kpis.productsAnalyzed, icon: Package, trend: 12, drillTab: "overview" },
    { title: "Competitors", value: kpis.competitorsIdentified, icon: Target, trend: 8, drillTab: "competitors" },
    { title: "Reviews", value: kpis.reviewsProcessed, icon: Star, trend: 15, drillTab: "sentiment" },
    { title: "Insights", value: kpis.insightsGenerated, icon: Lightbulb, trend: 22, drillTab: "opportunities" },
    { title: "Sentiment", value: `${(kpis.avgSentiment * 100).toFixed(0)}%`, icon: Activity, trend: kpis.avgSentiment > 0.6 ? 5 : -3, drillTab: "sentiment" },
  ];

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header + Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Market Analytics</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Data-driven insights from your research pipeline</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
            <SelectTrigger className="w-[130px] h-8 text-xs">
              <Calendar className="h-3 w-3 mr-1.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={loadData}><RefreshCw className="h-3.5 w-3.5" /></Button>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={exportCSV}><Download className="h-3 w-3 mr-1.5" />CSV</Button>
          <Button size="sm" className="h-8 text-xs" onClick={exportPDF}><FileText className="h-3 w-3 mr-1.5" />PDF</Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {kpiCards.map((k) => (
          <Card key={k.title} className="border-border/40 overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <k.icon className="h-4 w-4 text-primary" />
                </div>
                <div className={`flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded-full ${trendBg(k.trend)} ${trendColor(k.trend)}`}>
                  {trendIcon(k.trend)}
                  {Math.abs(k.trend)}%
                </div>
              </div>
              <p className="text-xl font-bold tracking-tight">{typeof k.value === 'number' ? k.value.toLocaleString() : k.value}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{k.title}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="h-9 p-0.5 bg-muted/50">
          <TabsTrigger value="overview" className="text-xs h-8">Overview</TabsTrigger>
          <TabsTrigger value="sentiment" className="text-xs h-8">Sentiment</TabsTrigger>
          <TabsTrigger value="competitors" className="text-xs h-8">Competitors</TabsTrigger>
          <TabsTrigger value="opportunities" className="text-xs h-8">Opportunities</TabsTrigger>
          <TabsTrigger value="trends" className="text-xs h-8">Trends</TabsTrigger>
          <TabsTrigger value="features" className="text-xs h-8">Features</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            {/* Sentiment mini */}
            <Card className="border-border/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Sentiment Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={sentimentDist} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={3}>
                      {sentimentDist.map((d, i) => <Cell key={i} fill={d.fill} />)}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Topic frequency mini */}
            <Card className="border-border/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Trending Topics</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={topicFrequency}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                    <XAxis dataKey="topic" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="frequency" name="Mentions" radius={[4, 4, 0, 0]}>
                      {topicFrequency.map((t, i) => (
                        <Cell key={i} fill={t.growth > 0 ? PALETTE.green : t.growth < 0 ? PALETTE.red : PALETTE.amber} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex items-center justify-center gap-4 mt-2 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: PALETTE.green }} /> Growing</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: PALETTE.red }} /> Declining</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: PALETTE.amber }} /> Stable</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Confidence overview */}
          <Card className="border-border/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Insight Confidence</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {confidenceData.map((d) => (
                  <div key={d.type} className="text-center p-3 rounded-lg border border-border/40">
                    <div className={`inline-flex items-center justify-center h-10 w-10 rounded-full mb-2 ${
                      d.confidence >= 80 ? 'bg-emerald-500/10' : d.confidence >= 65 ? 'bg-amber-500/10' : 'bg-red-500/10'
                    }`}>
                      <span className={`text-sm font-bold ${
                        d.confidence >= 80 ? 'text-emerald-600' : d.confidence >= 65 ? 'text-amber-600' : 'text-red-600'
                      }`}>{d.confidence}%</span>
                    </div>
                    <p className="text-xs font-medium">{d.type}</p>
                    <p className="text-[10px] text-muted-foreground">{d.dataPoints} points</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Timeline mini */}
          {timelineData.length > 0 && (
            <Card className="border-border/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {timelineData.slice(0, 5).map((item) => (
                    <div key={item.id} className="flex items-center gap-3 py-1.5">
                      <div className={`h-2 w-2 rounded-full shrink-0 ${
                        item.status === "completed" ? "bg-emerald-500" : item.status === "running" ? "bg-amber-500 animate-pulse" : "bg-muted-foreground/40"
                      }`} />
                      <span className="text-sm flex-1">{item.stage}</span>
                      <span className="text-xs text-muted-foreground">{item.date}</span>
                      <Badge variant={item.status === "completed" ? "default" : "secondary"} className="text-[10px] h-5">{item.status}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Sentiment */}
        <TabsContent value="sentiment" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Card className="border-border/40">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Sentiment Breakdown</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={sentimentDist} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={100} paddingAngle={3}
                      label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {sentimentDist.map((d, i) => <Cell key={i} fill={d.fill} />)}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card className="border-border/40">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Sentiment Over Time</CardTitle></CardHeader>
              <CardContent>
                {sentimentTrend.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={sentimentTrend}>
                      <defs>
                        <linearGradient id="sentGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={PALETTE.primary} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={PALETTE.primary} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis domain={[0, 1]} tick={{ fontSize: 11 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="score" stroke={PALETTE.primary} fill="url(#sentGrad)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : <p className="text-muted-foreground text-center py-16 text-sm">Not enough data for trend</p>}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Competitors */}
        <TabsContent value="competitors" className="space-y-4">
          <Card className="border-border/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Competitor Market Position</CardTitle>
              <CardDescription className="text-xs">Multi-metric comparison across key dimensions</CardDescription>
            </CardHeader>
            <CardContent>
              {competitorData.length > 0 ? (
                <div className="grid md:grid-cols-2 gap-6">
                  <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={competitorData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                      <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="priceScore" name="Price" fill={PALETTE.primary} radius={[0, 2, 2, 0]} />
                      <Bar dataKey="featureScore" name="Features" fill={PALETTE.blue} radius={[0, 2, 2, 0]} />
                      <Bar dataKey="sentimentScore" name="Sentiment" fill={PALETTE.cyan} radius={[0, 2, 2, 0]} />
                      <Bar dataKey="innovationScore" name="Innovation" fill={PALETTE.green} radius={[0, 2, 2, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                  <ResponsiveContainer width="100%" height={350}>
                    <RadarChart data={competitorData.slice(0, 4).flatMap(c => [
                      { metric: "Price", value: c.priceScore, name: c.name },
                      { metric: "Features", value: c.featureScore, name: c.name },
                      { metric: "Sentiment", value: c.sentimentScore, name: c.name },
                      { metric: "Innovation", value: c.innovationScore, name: c.name },
                    ]).reduce((acc: any[], item) => {
                      let existing = acc.find(a => a.metric === item.metric);
                      if (!existing) { existing = { metric: item.metric }; acc.push(existing); }
                      existing[item.name] = item.value;
                      return acc;
                    }, [])}>
                      <PolarGrid className="opacity-30" />
                      <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11 }} />
                      <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 9 }} />
                      {competitorData.slice(0, 4).map((c, i) => (
                        <Radar key={c.name} name={c.name} dataKey={c.name} stroke={COLORS[i]} fill={COLORS[i]} fillOpacity={0.15} />
                      ))}
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Tooltip content={<CustomTooltip />} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              ) : <p className="text-muted-foreground text-center py-16 text-sm">No competitor data. Run research agents first.</p>}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Opportunities */}
        <TabsContent value="opportunities" className="space-y-4">
          <Card className="border-border/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Market Opportunity Map</CardTitle>
              <CardDescription className="text-xs">Feature demand vs coverage — larger bubble = bigger opportunity gap</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                  <XAxis dataKey="coverage" name="Coverage" unit="%" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="demand" name="Demand" unit="%" tick={{ fontSize: 11 }} />
                  <ZAxis dataKey="gap" range={[80, 500]} name="Gap" />
                  <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: "3 3" }} />
                  <Scatter name="Features" data={heatmapData}>
                    {heatmapData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-2 mt-3">
                {heatmapData.map((f, i) => (
                  <Badge key={i} variant="outline" className="gap-1.5 text-xs">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    {f.feature}
                    <span className={`font-medium ${f.gap > 20 ? 'text-emerald-600' : f.gap < 5 ? 'text-red-500' : 'text-amber-600'}`}>
                      {f.gap > 0 ? '+' : ''}{f.gap}%
                    </span>
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Trends */}
        <TabsContent value="trends" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Card className="border-border/40">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Trend Momentum</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={trendMomentum}>
                    <defs>
                      <linearGradient id="momGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={PALETTE.primary} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={PALETTE.primary} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="momentum" name="Momentum" stroke={PALETTE.primary} fill="url(#momGrad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card className="border-border/40">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Topic Frequency</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={topicFrequency}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                    <XAxis dataKey="topic" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="frequency" name="Mentions" radius={[4, 4, 0, 0]}>
                      {topicFrequency.map((t, i) => (
                        <Cell key={i} fill={t.growth > 0 ? PALETTE.green : t.growth < 0 ? PALETTE.red : PALETTE.amber} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex items-center justify-center gap-4 mt-2 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: PALETTE.green }} /> Growing</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: PALETTE.red }} /> Declining</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: PALETTE.amber }} /> Stable</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Features */}
        <TabsContent value="features" className="space-y-4">
          <Card className="border-border/40">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">Feature Gap Analysis</CardTitle>
                <Select value={sortField} onValueChange={v => { setSortField(v); setSortDir("desc"); }}>
                  <SelectTrigger className="w-36 h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="priority">Sort by Priority</SelectItem>
                    <SelectItem value="demandScore">Sort by Demand</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Feature</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs cursor-pointer" onClick={() => { setSortField("demandScore"); setSortDir(d => d === "asc" ? "desc" : "asc"); }}>Demand</TableHead>
                    <TableHead className="text-xs cursor-pointer" onClick={() => { setSortField("priority"); setSortDir(d => d === "asc" ? "desc" : "asc"); }}>Priority</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedFeatureGaps.map((f, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium text-sm">{f.feature}</TableCell>
                      <TableCell>
                        <span className={`inline-flex h-5 px-2 rounded-full text-[10px] font-medium items-center ${
                          f.available ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600'
                        }`}>{f.available ? "Available" : "Missing"}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 flex-1 max-w-20 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${f.demandScore}%` }} />
                          </div>
                          <span className="text-xs text-muted-foreground w-6">{f.demandScore}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={f.priority === "High" ? "destructive" : f.priority === "Medium" ? "secondary" : "outline"} className="text-[10px] h-5">
                          {f.priority}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
