import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, CheckCircle, Play, Sparkles, FlaskConical } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface TimelineEntry {
  id: string;
  timestamp: string;
  description: string;
  type: 'agent_started' | 'agent_completed' | 'insight_generated' | 'simulation';
}

const typeConfig = {
  agent_started: { icon: Play, dotClass: 'bg-blue-500' },
  agent_completed: { icon: CheckCircle, dotClass: 'bg-green-500' },
  insight_generated: { icon: Sparkles, dotClass: 'bg-purple-500' },
  simulation: { icon: FlaskConical, dotClass: 'bg-amber-500' },
} as const;

function formatAgent(type: string) {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export const ResearchTimeline = () => {
  const { user } = useAuth();
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      setLoading(true);
      const timeline: TimelineEntry[] = [];

      // Fetch agent results (started + completed)
      const { data: agentResults } = await supabase
        .from('agent_results')
        .select('id, agent_type, status, created_at, updated_at')
        .order('created_at', { ascending: false })
        .limit(20);

      if (agentResults) {
        agentResults.forEach((r) => {
          timeline.push({
            id: `${r.id}-start`,
            timestamp: r.created_at,
            description: `${formatAgent(r.agent_type)} Agent started`,
            type: 'agent_started',
          });
          if (r.status === 'completed') {
            timeline.push({
              id: `${r.id}-end`,
              timestamp: r.updated_at,
              description: `${formatAgent(r.agent_type)} Agent completed`,
              type: 'agent_completed',
            });
          }
        });
      }

      // Fetch insights
      const { data: insights } = await supabase
        .from('insights')
        .select('id, insight_type, created_at')
        .order('created_at', { ascending: false })
        .limit(10);

      if (insights) {
        insights.forEach((i) => {
          timeline.push({
            id: i.id,
            timestamp: i.created_at,
            description: `${formatAgent(i.insight_type)} insight generated`,
            type: 'insight_generated',
          });
        });
      }

      // Fetch research runs as simulation/execution events
      const { data: runs } = await supabase
        .from('research_runs')
        .select('id, status, started_at, completed_at')
        .order('started_at', { ascending: false })
        .limit(10);

      if (runs) {
        runs.forEach((r) => {
          timeline.push({
            id: `run-${r.id}`,
            timestamp: r.completed_at || r.started_at,
            description: `Research run ${r.status === 'completed' ? 'completed' : r.status}`,
            type: 'simulation',
          });
        });
      }

      // Sort descending by timestamp, limit to 15
      timeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setEntries(timeline.slice(0, 15));
      setLoading(false);
    };

    load();
  }, [user]);

  if (loading) return null;

  return (
    <Card className="glass-effect border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          Research Timeline
        </CardTitle>
        <CardDescription>Chronological research activity across projects</CardDescription>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No research activity yet. Start a research project to see timeline events.
          </p>
        ) : (
          <div className="relative space-y-0">
            {/* Vertical line */}
            <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" />

            {entries.map((entry, idx) => {
              const cfg = typeConfig[entry.type];
              const Icon = cfg.icon;
              return (
                <div key={entry.id} className="relative flex items-start gap-4 py-2.5">
                  <div className={`relative z-10 h-[30px] w-[30px] rounded-full flex items-center justify-center border-2 border-background ${cfg.dotClass}`}>
                    <Icon className="h-3.5 w-3.5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <p className="text-sm font-medium line-clamp-1">{entry.description}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(entry.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
