import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, TrendingUp, Users, Activity } from "lucide-react";

export default function Dashboard() {
  const stats = [
    {
      title: "Total Projects",
      value: "0",
      description: "Research projects created",
      icon: BarChart3,
      color: "text-blue-400",
    },
    {
      title: "Insights Generated",
      value: "0",
      description: "AI-powered insights",
      icon: TrendingUp,
      color: "text-purple-400",
    },
    {
      title: "Competitors Analyzed",
      value: "0",
      description: "Market competitors",
      icon: Users,
      color: "text-cyan-400",
    },
    {
      title: "Active Agents",
      value: "3",
      description: "AI agents running",
      icon: Activity,
      color: "text-green-400",
    },
  ];

  return (
    <div className="p-8 space-y-8">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">
          Market Research Dashboard
        </h1>
        <p className="text-muted-foreground text-lg">
          AI-powered insights for your business intelligence
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <Card key={stat.title} className="glass-effect border-border/50 hover:border-primary/50 transition-all">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="glass-effect border-border/50">
        <CardHeader>
          <CardTitle>Quick Start</CardTitle>
          <CardDescription>
            Begin your market research journey
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
            <h3 className="font-semibold mb-2">🔍 Start a New Research</h3>
            <p className="text-sm text-muted-foreground">
              Navigate to the Research section to analyze products and companies
            </p>
          </div>
          <div className="p-4 rounded-lg bg-accent/10 border border-accent/20">
            <h3 className="font-semibold mb-2">💬 Chat with AI Assistant</h3>
            <p className="text-sm text-muted-foreground">
              Get instant insights and answers from our Groq-powered AI assistant
            </p>
          </div>
          <div className="p-4 rounded-lg bg-secondary/50 border border-border/50">
            <h3 className="font-semibold mb-2">⚙️ Configure Settings</h3>
            <p className="text-sm text-muted-foreground">
              Set up your preferences and manage API keys
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
