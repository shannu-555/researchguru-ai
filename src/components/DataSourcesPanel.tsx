import { Globe, FileText, Star, Newspaper, Brain, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface DataSource {
  name: string;
  icon: React.ElementType;
  active: boolean;
  description: string;
}

interface DataSourcesPanelProps {
  perplexityDone?: boolean;
  agentsDone?: boolean;
}

export const DataSourcesPanel = ({ perplexityDone, agentsDone }: DataSourcesPanelProps) => {
  const sources: DataSource[] = [
    { name: 'Web Search', icon: Globe, active: !!perplexityDone, description: 'Real-time web results via Perplexity' },
    { name: 'Market Reports', icon: FileText, active: !!agentsDone, description: 'Competitor & trend analysis data' },
    { name: 'Product Reviews', icon: Star, active: !!agentsDone, description: 'Sentiment from consumer reviews' },
    { name: 'Industry Articles', icon: Newspaper, active: !!perplexityDone, description: 'News and industry publications' },
    { name: 'AI Knowledge Base', icon: Brain, active: !!agentsDone, description: 'LLM-powered contextual reasoning' },
  ];

  const activeCount = sources.filter(s => s.active).length;

  return (
    <Card className="glass-effect border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary" />
            Data Sources
          </span>
          <span className="text-xs font-normal text-muted-foreground">
            {activeCount}/{sources.length} active
          </span>
        </CardTitle>
        <CardDescription className="text-xs">Sources used for research insights</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {sources.map((src) => {
          const Icon = src.icon;
          return (
            <div
              key={src.name}
              className={`flex items-center gap-3 p-2.5 rounded-md border transition-colors ${
                src.active
                  ? 'border-primary/30 bg-primary/5'
                  : 'border-border/50 bg-secondary/10 opacity-60'
              }`}
            >
              <Icon className={`h-4 w-4 flex-shrink-0 ${src.active ? 'text-primary' : 'text-muted-foreground'}`} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium">{src.name}</p>
                <p className="text-[10px] text-muted-foreground truncate">{src.description}</p>
              </div>
              {src.active && <CheckCircle2 className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
