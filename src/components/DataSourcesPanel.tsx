import { useState } from 'react';
import { Globe, FileText, Star, Newspaper, Brain, CheckCircle2, ChevronDown } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface DataSource {
  name: string;
  icon: React.ElementType;
  active: boolean;
  description: string;
  details: string[];
}

interface DataSourcesPanelProps {
  perplexityDone?: boolean;
  agentsDone?: boolean;
}

export const DataSourcesPanel = ({ perplexityDone, agentsDone }: DataSourcesPanelProps) => {
  const [expandedSource, setExpandedSource] = useState<string | null>(null);

  const sources: DataSource[] = [
    {
      name: 'Web Search',
      icon: Globe,
      active: !!perplexityDone,
      description: 'Real-time web results via Perplexity',
      details: perplexityDone
        ? ['Live web search queries executed', 'Multiple search result pages analyzed', 'Key findings extracted and summarized', 'Source URLs captured for reference']
        : ['Waiting for Perplexity research to complete'],
    },
    {
      name: 'Market Reports',
      icon: FileText,
      active: !!agentsDone,
      description: 'Competitor & trend analysis data',
      details: agentsDone
        ? ['Competitor landscape mapped', 'Market positioning data collected', 'Industry benchmarks compared', 'Market share estimates generated']
        : ['Waiting for competitor agent to complete'],
    },
    {
      name: 'Product Reviews',
      icon: Star,
      active: !!agentsDone,
      description: 'Sentiment from consumer reviews',
      details: agentsDone
        ? ['Consumer sentiment analyzed', 'Review themes categorized', 'Positive/negative ratio computed', 'Key complaints and praise identified']
        : ['Waiting for sentiment agent to complete'],
    },
    {
      name: 'Industry Articles',
      icon: Newspaper,
      active: !!perplexityDone,
      description: 'News and industry publications',
      details: perplexityDone
        ? ['Recent news articles scanned', 'Industry trends extracted', 'Press coverage analyzed', 'Publication credibility assessed']
        : ['Waiting for Perplexity research to complete'],
    },
    {
      name: 'AI Knowledge Base',
      icon: Brain,
      active: !!agentsDone,
      description: 'LLM-powered contextual reasoning',
      details: agentsDone
        ? ['Contextual analysis performed', 'Cross-reference with known data', 'Pattern recognition applied', 'Strategic recommendations generated']
        : ['Waiting for AI agents to complete'],
    },
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
        <CardDescription className="text-xs">Click a source to see collection details</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {sources.map((src) => {
          const Icon = src.icon;
          const isOpen = expandedSource === src.name;
          return (
            <Collapsible
              key={src.name}
              open={isOpen}
              onOpenChange={(open) => setExpandedSource(open ? src.name : null)}
            >
              <CollapsibleTrigger asChild>
                <button
                  className={`w-full flex items-center gap-3 p-2.5 rounded-md border transition-colors cursor-pointer text-left ${
                    src.active
                      ? 'border-primary/30 bg-primary/5 hover:bg-primary/10'
                      : 'border-border/50 bg-secondary/10 opacity-60 hover:opacity-80'
                  }`}
                >
                  <Icon className={`h-4 w-4 flex-shrink-0 ${src.active ? 'text-primary' : 'text-muted-foreground'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium">{src.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{src.description}</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {src.active && <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />}
                    <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </div>
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-1 ml-7 pl-3 border-l-2 border-border/50 space-y-1 py-2">
                  {src.details.map((detail, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${src.active ? 'bg-primary' : 'bg-muted-foreground/40'}`} />
                      <p className="text-[11px] text-muted-foreground">{detail}</p>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </CardContent>
    </Card>
  );
};
