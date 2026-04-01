import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, TrendingUp, Users, Activity, Search, Brain, Sparkles, Target, CheckCircle2, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { KnowledgeBaseStatus } from "@/components/KnowledgeBaseStatus";

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState({ projects: 0, insights: 0, agents: 0 });
  const [recentProjects, setRecentProjects] = useState<any[]>([]);
  
  const [agentStatuses, setAgentStatuses] = useState({
    sentiment: 'Ready',
    competitor: 'Ready',
    trend: 'Ready',
    insights: 'Ready',
  });

  useEffect(() => {
    if (user) {
      loadStats();
      checkAgentStatuses();
      loadRecentProjects();
    }
  }, [user]);

  const loadStats = async () => {
    try {
      const [projectsData, insightsData, agentsData] = await Promise.all([
        supabase.from('research_projects').select('id', { count: 'exact' }),
        supabase.from('insights').select('id', { count: 'exact' }),
        supabase.from('agent_results').select('id', { count: 'exact' }),
      ]);
      setStats({
        projects: projectsData.count || 0,
        insights: insightsData.count || 0,
        agents: agentsData.count || 0,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const loadRecentProjects = async () => {
    const { data } = await supabase
      .from('research_projects')
      .select('id, product_name, company_name, status, created_at')
      .order('created_at', { ascending: false })
      .limit(5);
    setRecentProjects(data || []);
  };

  const checkAgentStatuses = async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('agent_results')
        .select('agent_type, status')
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(10);

      if (data && data.length > 0) {
        const newStatuses = { ...agentStatuses };
        data.forEach(result => {
          const t = result.agent_type as keyof typeof agentStatuses;
          if (newStatuses[t] !== undefined) newStatuses[t] = 'Active';
        });
        setAgentStatuses(newStatuses);
      }
    } catch (error) {
      console.error('Error checking agent statuses:', error);
    }
  };

  const statCards = [
    { title: "Projects", value: stats.projects, icon: BarChart3, accent: "from-blue-500/20 to-blue-600/5" },
    { title: "Insights", value: stats.insights, icon: TrendingUp, accent: "from-purple-500/20 to-purple-600/5" },
    { title: "Agent Runs", value: stats.agents, icon: Activity, accent: "from-emerald-500/20 to-emerald-600/5" },
    { title: "Team", value: 1, icon: Users, accent: "from-cyan-500/20 to-cyan-600/5" },
  ];

  const agents = [
    { key: "sentiment", name: "Sentiment", icon: TrendingUp },
    { key: "competitor", name: "Competitor", icon: Target },
    { key: "trend", name: "Trend", icon: Activity },
    { key: "insights", name: "Insights", icon: Brain },
  ];

  const quickActions = [
    { label: "New Research", desc: "Analyze products with AI agents", icon: Search, path: "/research" },
    { label: "AI Assistant", desc: "Get instant AI-powered answers", icon: Brain, path: "/ai-assistant" },
    { label: "Compare Products", desc: "Side-by-side analysis", icon: Sparkles, path: "/comparison" },
  ];

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-[1400px] mx-auto animate-fade-in">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Your market research at a glance</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <Card key={s.title} className="border-border/40 overflow-hidden relative group hover:border-primary/30 transition-colors">
            <div className={`absolute inset-0 bg-gradient-to-br ${s.accent} opacity-60`} />
            <CardContent className="relative p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="h-9 w-9 rounded-lg bg-background/80 backdrop-blur flex items-center justify-center border border-border/50">
                  <s.icon className="h-4 w-4 text-foreground/70" />
                </div>
              </div>
              <p className="text-2xl font-bold tracking-tight">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.title}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Quick Actions</h2>
          <div className="grid gap-3">
            {quickActions.map((a) => (
              <Card
                key={a.label}
                className="border-border/40 hover:border-primary/40 transition-all cursor-pointer group"
                onClick={() => navigate(a.path)}
              >
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                    <a.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{a.label}</p>
                    <p className="text-xs text-muted-foreground">{a.desc}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Agent Status */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">AI Agents</h2>
          <Card className="border-border/40">
            <CardContent className="p-4 space-y-3">
              {agents.map((a) => {
                const status = agentStatuses[a.key as keyof typeof agentStatuses];
                const isActive = status === 'Active';
                return (
                  <div key={a.key} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${isActive ? 'bg-emerald-500/10' : 'bg-muted/50'}`}>
                      <a.icon className={`h-4 w-4 ${isActive ? 'text-emerald-500' : 'text-muted-foreground'}`} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{a.name}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {isActive ? (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                          <span className="text-xs text-emerald-500 font-medium">Active</span>
                        </>
                      ) : (
                        <>
                          <div className="h-2 w-2 rounded-full bg-muted-foreground/40" />
                          <span className="text-xs text-muted-foreground">Ready</span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recent Projects */}
      {recentProjects.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Recent Projects</h2>
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate('/research')}>
              View All <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </div>
          <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {recentProjects.slice(0, 3).map((p) => (
              <Card key={p.id} className="border-border/40 hover:border-primary/30 transition-colors">
                <CardContent className="p-4">
                  <p className="font-medium text-sm truncate">{p.product_name}</p>
                  {p.company_name && <p className="text-xs text-muted-foreground mt-0.5">{p.company_name}</p>}
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-[11px] text-muted-foreground">
                      {new Date(p.created_at).toLocaleDateString()}
                    </span>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                      p.status === 'completed' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground'
                    }`}>
                      {p.status || 'active'}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Knowledge Base */}
      <KnowledgeBaseStatus />
    </div>
  );
}
