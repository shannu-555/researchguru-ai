import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Database, FileText, Clock, Layers } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export const KnowledgeBaseStatus = () => {
  const { user } = useAuth();
  const [embeddingCount, setEmbeddingCount] = useState<number | null>(null);
  const [projectCount, setProjectCount] = useState<number | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      setLoading(true);

      const [embRes, projRes, latestRes] = await Promise.all([
        supabase.from('research_embeddings').select('id', { count: 'exact', head: true }),
        supabase.from('research_projects').select('id', { count: 'exact', head: true }),
        supabase.from('research_embeddings').select('created_at').order('created_at', { ascending: false }).limit(1),
      ]);

      setEmbeddingCount(embRes.count ?? 0);
      setProjectCount(projRes.count ?? 0);
      setLastUpdated(latestRes.data?.[0]?.created_at ?? null);
      setLoading(false);
    };

    load();
  }, [user]);

  if (loading) return null;

  const stats = [
    {
      label: 'Embeddings Stored',
      value: embeddingCount ?? 0,
      icon: Layers,
    },
    {
      label: 'Indexed Projects',
      value: projectCount ?? 0,
      icon: FileText,
    },
    {
      label: 'Last Updated',
      value: lastUpdated ? new Date(lastUpdated).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A',
      icon: Clock,
    },
  ];

  return (
    <Card className="glass-effect border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Database className="h-5 w-5 text-primary" />
          Knowledge Base Status
        </CardTitle>
        <CardDescription>Vector database used for AI-powered retrieval</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="flex items-center gap-3 p-4 rounded-lg border border-border/50 bg-secondary/20">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className="text-lg font-semibold">{stat.value}</p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
