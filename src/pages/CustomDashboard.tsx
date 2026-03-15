import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from "recharts";
import {
  LayoutDashboard, Plus, X, GripVertical, TrendingUp, Users,
  BarChart3, PieChart as PieIcon, Activity, Brain, Download, Save,
  Maximize2, Minimize2
} from "lucide-react";

const COLORS = [
  "hsl(263, 70%, 50%)", "hsl(220, 90%, 56%)", "hsl(189, 100%, 50%)",
  "hsl(142, 71%, 45%)", "hsl(38, 92%, 50%)", "hsl(0, 84%, 60%)",
];

type WidgetType = 'sentiment-pie' | 'competitor-bar' | 'trend-line' | 'kpi-cards' | 'radar-scores' | 'activity-timeline' | 'top-keywords' | 'price-comparison';

interface Widget {
  id: string;
  type: WidgetType;
  title: string;
  size: 'small' | 'medium' | 'large';
}

const WIDGET_CATALOG: { type: WidgetType; title: string; icon: any; description: string }[] = [
  { type: 'kpi-cards', title: 'KPI Overview', icon: Activity, description: 'Key performance indicators at a glance' },
  { type: 'sentiment-pie', title: 'Sentiment Distribution', icon: PieIcon, description: 'Pie chart of sentiment breakdown' },
  { type: 'competitor-bar', title: 'Competitor Comparison', icon: BarChart3, description: 'Bar chart comparing competitors' },
  { type: 'trend-line', title: 'Trend Over Time', icon: TrendingUp, description: 'Line chart of trend momentum' },
  { type: 'radar-scores', title: 'Multi-Metric Radar', icon: Brain, description: 'Radar chart of multiple metrics' },
  { type: 'activity-timeline', title: 'Research Activity', icon: Activity, description: 'Timeline of research activities' },
  { type: 'top-keywords', title: 'Top Keywords', icon: BarChart3, description: 'Most frequent keywords across research' },
  { type: 'price-comparison', title: 'Price Overview', icon: TrendingUp, description: 'Price comparison across products' },
];

export default function CustomDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [widgets, setWidgets] = useState<Widget[]>([
    { id: '1', type: 'kpi-cards', title: 'KPI Overview', size: 'large' },
    { id: '2', type: 'sentiment-pie', title: 'Sentiment Distribution', size: 'medium' },
    { id: '3', type: 'competitor-bar', title: 'Competitor Comparison', size: 'medium' },
    { id: '4', type: 'trend-line', title: 'Trend Over Time', size: 'large' },
  ]);
  const [showCatalog, setShowCatalog] = useState(false);
  const [agentData, setAgentData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('agent_results')
        .select('*')
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(200);
      setAgentData(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  const addWidget = (type: WidgetType) => {
    const catalog = WIDGET_CATALOG.find(w => w.type === type);
    if (!catalog) return;
    setWidgets(prev => [...prev, {
      id: Date.now().toString(),
      type,
      title: catalog.title,
      size: 'medium',
    }]);
    setShowCatalog(false);
    toast({ title: "Widget added" });
  };

  const removeWidget = (id: string) => {
    setWidgets(prev => prev.filter(w => w.id !== id));
  };

  const toggleSize = (id: string) => {
    setWidgets(prev => prev.map(w => 
      w.id === id ? { ...w, size: w.size === 'large' ? 'medium' : w.size === 'medium' ? 'small' : 'large' } : w
    ));
  };

  const saveLayout = async () => {
    if (!user) return;
    try {
      await supabase.from('user_settings').upsert({
        user_id: user.id,
        preferences: { dashboardLayout: widgets } as any,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
      toast({ title: "Dashboard saved" });
    } catch (err) {
      toast({ title: "Save failed", variant: "destructive" });
    }
  };

  // Compute aggregated data
  const sentimentData = (() => {
    const sentiments = agentData.filter(a => a.agent_type === 'sentiment' && a.results);
    if (sentiments.length === 0) return [{ name: 'No Data', value: 100 }];
    const latest = sentiments[0].results;
    return [
      { name: 'Positive', value: latest.positive || 0 },
      { name: 'Negative', value: latest.negative || 0 },
      { name: 'Neutral', value: latest.neutral || 0 },
    ];
  })();

  const competitorData = (() => {
    const comps = agentData.filter(a => a.agent_type === 'competitor' && a.results?.competitors);
    if (comps.length === 0) return [];
    return (comps[0].results.competitors || []).slice(0, 6).map((c: any) => ({
      name: c.name?.substring(0, 15) || 'Unknown',
      rating: c.rating || 0,
      price: parseFloat(String(c.price).replace(/[^0-9.]/g, '')) || 0,
    }));
  })();

  const trendData = (() => {
    const trends = agentData.filter(a => a.agent_type === 'trend' && a.results?.monthlyData);
    if (trends.length === 0) return [];
    return trends[0].results.monthlyData || [];
  })();

  const kpiData = (() => {
    const projects = new Set(agentData.map(a => a.project_id));
    const sentiments = agentData.filter(a => a.agent_type === 'sentiment' && a.results);
    const avgScore = sentiments.length > 0 
      ? Math.round(sentiments.reduce((s, a) => s + (a.results.overallScore || 0), 0) / sentiments.length)
      : 0;
    return {
      totalProjects: projects.size,
      totalAgents: agentData.length,
      avgSentiment: avgScore,
      completionRate: agentData.length > 0 ? Math.round((agentData.filter(a => a.status === 'completed').length / agentData.length) * 100) : 0,
    };
  })();

  const keywordData = (() => {
    const trends = agentData.filter(a => a.agent_type === 'trend' && a.results?.keywords);
    const freq: Record<string, number> = {};
    trends.forEach(t => {
      (t.results.keywords || []).forEach((k: string) => {
        freq[k] = (freq[k] || 0) + 1;
      });
    });
    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([keyword, count]) => ({ keyword: keyword.substring(0, 20), count }));
  })();

  const radarData = (() => {
    const latest: Record<string, number> = {};
    const sentiments = agentData.filter(a => a.agent_type === 'sentiment' && a.results);
    if (sentiments.length > 0) {
      latest['Sentiment'] = sentiments[0].results.overallScore || 0;
      latest['Confidence'] = sentiments[0].results.confidence || 0;
    }
    const trends = agentData.filter(a => a.agent_type === 'trend' && a.results);
    if (trends.length > 0) {
      latest['Trend Score'] = trends[0].results.trendScore || 0;
      latest['Growth'] = Math.min(trends[0].results.growthRate || 0, 100);
    }
    const comps = agentData.filter(a => a.agent_type === 'competitor' && a.results);
    if (comps.length > 0) {
      latest['Competition'] = comps[0].results.overallConfidence || 0;
    }
    latest['Data Quality'] = agentData.length > 5 ? 85 : agentData.length > 2 ? 60 : 30;
    return Object.entries(latest).map(([metric, value]) => ({ metric, value }));
  })();

  const renderWidget = (widget: Widget) => {
    switch (widget.type) {
      case 'kpi-cards':
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Projects', value: kpiData.totalProjects, color: 'text-primary' },
              { label: 'Agent Runs', value: kpiData.totalAgents, color: 'text-blue-500' },
              { label: 'Avg Sentiment', value: `${kpiData.avgSentiment}/100`, color: 'text-green-500' },
              { label: 'Completion', value: `${kpiData.completionRate}%`, color: 'text-amber-500' },
            ].map((kpi, i) => (
              <div key={i} className="p-3 bg-background/50 rounded-lg border border-border/30 text-center">
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
                <p className={`text-xl font-bold ${kpi.color}`}>{kpi.value}</p>
              </div>
            ))}
          </div>
        );
      case 'sentiment-pie':
        return (
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={sentimentData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
                {sentimentData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        );
      case 'competitor-bar':
        return competitorData.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={competitorData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis stroke="hsl(var(--muted-foreground))" />
              <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--foreground))' }} />
              <Bar dataKey="rating" fill={COLORS[0]} name="Rating" />
            </BarChart>
          </ResponsiveContainer>
        ) : <p className="text-center text-muted-foreground py-8 text-sm">No competitor data yet</p>;
      case 'trend-line':
        return trendData.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={trendData}>
              <defs>
                <linearGradient id="dashTrend" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS[0]} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={COLORS[0]} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis stroke="hsl(var(--muted-foreground))" />
              <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--foreground))' }} />
              <Area type="monotone" dataKey="value" stroke={COLORS[0]} fill="url(#dashTrend)" />
            </AreaChart>
          </ResponsiveContainer>
        ) : <p className="text-center text-muted-foreground py-8 text-sm">No trend data yet</p>;
      case 'radar-scores':
        return radarData.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="hsl(var(--border))" />
              <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9 }} />
              <Radar dataKey="value" stroke={COLORS[0]} fill={COLORS[0]} fillOpacity={0.3} />
            </RadarChart>
          </ResponsiveContainer>
        ) : <p className="text-center text-muted-foreground py-8 text-sm">No data yet</p>;
      case 'top-keywords':
        return keywordData.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={keywordData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" stroke="hsl(var(--muted-foreground))" />
              <YAxis dataKey="keyword" type="category" tick={{ fontSize: 10 }} width={120} stroke="hsl(var(--muted-foreground))" />
              <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--foreground))' }} />
              <Bar dataKey="count" fill={COLORS[1]} />
            </BarChart>
          </ResponsiveContainer>
        ) : <p className="text-center text-muted-foreground py-8 text-sm">No keyword data yet</p>;
      case 'activity-timeline':
        return (
          <div className="space-y-2 max-h-[200px] overflow-y-auto">
            {agentData.slice(0, 10).map((a, i) => (
              <div key={i} className="flex items-center gap-3 p-2 bg-background/50 rounded border border-border/30">
                <div className={`w-2 h-2 rounded-full ${a.status === 'completed' ? 'bg-green-500' : 'bg-red-500'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{a.agent_type} agent</p>
                  <p className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleDateString()}</p>
                </div>
                <Badge variant={a.status === 'completed' ? 'default' : 'destructive'} className="text-xs">{a.status}</Badge>
              </div>
            ))}
            {agentData.length === 0 && <p className="text-center text-muted-foreground py-8 text-sm">No activity yet</p>}
          </div>
        );
      case 'price-comparison':
        return (
          <div className="space-y-2">
            {competitorData.slice(0, 5).map((c: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-2 bg-background/50 rounded border border-border/30">
                <span className="text-sm font-medium">{c.name}</span>
                <span className="text-sm font-bold text-primary">${c.price || 'N/A'}</span>
              </div>
            ))}
            {competitorData.length === 0 && <p className="text-center text-muted-foreground py-8 text-sm">No price data yet</p>}
          </div>
        );
      default:
        return null;
    }
  };

  const getSizeClass = (size: string) => {
    switch (size) {
      case 'small': return 'col-span-1';
      case 'large': return 'col-span-1 md:col-span-2';
      default: return 'col-span-1';
    }
  };

  return (
    <div className="p-8 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-4xl font-bold">Custom Dashboard</h1>
          <p className="text-muted-foreground">Power BI-style analytics with customizable widgets</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowCatalog(!showCatalog)}>
            <Plus className="mr-2 h-4 w-4" />Add Widget
          </Button>
          <Button variant="outline" size="sm" onClick={saveLayout}>
            <Save className="mr-2 h-4 w-4" />Save Layout
          </Button>
        </div>
      </div>

      {/* Widget Catalog */}
      {showCatalog && (
        <Card className="glass-effect border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">Widget Catalog</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {WIDGET_CATALOG.map(w => (
                <button
                  key={w.type}
                  onClick={() => addWidget(w.type)}
                  className="p-4 bg-secondary/50 rounded-lg border border-border/30 hover:border-primary/50 transition-all text-left"
                >
                  <w.icon className="h-5 w-5 text-primary mb-2" />
                  <p className="text-sm font-medium">{w.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">{w.description}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dashboard Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {widgets.map(widget => (
          <Card key={widget.id} className={`glass-effect border-border/50 ${getSizeClass(widget.size)}`}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                  {widget.title}
                </CardTitle>
                <div className="flex items-center gap-1">
                  <Badge variant="outline" className="text-xs">{widget.size}</Badge>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggleSize(widget.id)}>
                    {widget.size === 'large' ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeWidget(widget.id)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {loading ? (
                <div className="h-[200px] flex items-center justify-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-primary" />
                </div>
              ) : (
                renderWidget(widget)
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
