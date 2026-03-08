import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Database, FileText, Clock, Layers, Cpu, BarChart3, SplitSquareHorizontal } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface KBMetrics {
  documentsIndexed: number;
  textChunks: number;
  embeddingsStored: number;
  embeddingModel: string;
  avgRetrievalScore: number | null;
  lastUpdated: string | null;
}

export const KnowledgeBaseStatus = () => {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<KBMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      setLoading(true);

      const [embRes, latestRes, agentRes] = await Promise.all([
        supabase.from('research_embeddings').select('id, content_type, metadata, created_at', { count: 'exact' }),
        supabase.from('research_embeddings').select('created_at').order('created_at', { ascending: false }).limit(1),
        supabase.from('agent_results').select('id', { count: 'exact' }).eq('status', 'completed'),
      ]);

      const embeddingsStored = embRes.count ?? 0;
      const textChunks = embeddingsStored; // each embedding row is one chunk
      const documentsIndexed = agentRes.count ?? 0;

      // Extract embedding model from metadata if available
      let embeddingModel = 'text-embedding-3-small';
      if (embRes.data && embRes.data.length > 0) {
        const meta = embRes.data[0].metadata as Record<string, any> | null;
        if (meta?.embedding_model) {
          embeddingModel = meta.embedding_model;
        }
      }

      // Calculate average retrieval score from metadata
      let avgRetrievalScore: number | null = null;
      if (embRes.data && embRes.data.length > 0) {
        const scores = embRes.data
          .map((e) => {
            const meta = e.metadata as Record<string, any> | null;
            return meta?.similarity_score ?? meta?.retrieval_score ?? null;
          })
          .filter((s): s is number => typeof s === 'number');
        if (scores.length > 0) {
          avgRetrievalScore = scores.reduce((a, b) => a + b, 0) / scores.length;
        }
      }

      const lastUpdated = latestRes.data?.[0]?.created_at ?? null;

      setMetrics({
        documentsIndexed,
        textChunks,
        embeddingsStored,
        embeddingModel,
        avgRetrievalScore,
        lastUpdated,
      });
      setLoading(false);
    };

    load();
  }, [user]);

  if (loading || !metrics) return null;

  const stats = [
    {
      label: 'Documents Indexed',
      value: metrics.documentsIndexed,
      icon: FileText,
    },
    {
      label: 'Text Chunks Created',
      value: metrics.textChunks,
      icon: SplitSquareHorizontal,
    },
    {
      label: 'Embeddings Stored',
      value: metrics.embeddingsStored,
      icon: Layers,
    },
    {
      label: 'Embedding Model',
      value: metrics.embeddingModel,
      icon: Cpu,
    },
    {
      label: 'Avg Similarity Score',
      value: metrics.avgRetrievalScore !== null ? metrics.avgRetrievalScore.toFixed(2) : 'N/A',
      icon: BarChart3,
    },
    {
      label: 'Last Updated',
      value: metrics.lastUpdated
        ? new Date(metrics.lastUpdated).toLocaleDateString(undefined, {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })
        : 'N/A',
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
        <CardDescription>RAG pipeline metrics — vector database used for AI-powered retrieval</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="flex items-center gap-3 p-4 rounded-lg border border-border/50 bg-secondary/20">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className="text-lg font-semibold truncate">{stat.value}</p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
