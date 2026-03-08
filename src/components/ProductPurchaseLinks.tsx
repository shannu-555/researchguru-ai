import { ExternalLink, ShoppingCart, Play, Search, Globe, Store } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Platform {
  name: string;
  icon: React.ReactNode;
  getUrl: (query: string) => string;
  color: string;
}

const platforms: Platform[] = [
  {
    name: "Amazon",
    icon: <ShoppingCart className="h-4 w-4" />,
    getUrl: (q) => `https://www.amazon.in/s?k=${q.replace(/ /g, "+")}`,
    color: "bg-orange-500/10 text-orange-500 hover:bg-orange-500/20 border-orange-500/30",
  },
  {
    name: "Flipkart",
    icon: <Store className="h-4 w-4" />,
    getUrl: (q) => `https://www.flipkart.com/search?q=${q.replace(/ /g, "+")}`,
    color: "bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 border-blue-500/30",
  },
  {
    name: "Croma",
    icon: <Store className="h-4 w-4" />,
    getUrl: (q) => `https://www.croma.com/search/?text=${encodeURIComponent(q)}`,
    color: "bg-green-500/10 text-green-500 hover:bg-green-500/20 border-green-500/30",
  },
  {
    name: "Reliance Digital",
    icon: <Store className="h-4 w-4" />,
    getUrl: (q) => `https://www.reliancedigital.in/search?q=${encodeURIComponent(q)}`,
    color: "bg-red-500/10 text-red-500 hover:bg-red-500/20 border-red-500/30",
  },
  {
    name: "Official Website",
    icon: <Globe className="h-4 w-4" />,
    getUrl: (q) => `https://www.google.com/search?q=${q.replace(/ /g, "+")}+official+site`,
    color: "bg-purple-500/10 text-purple-500 hover:bg-purple-500/20 border-purple-500/30",
  },
  {
    name: "YouTube Reviews",
    icon: <Play className="h-4 w-4" />,
    getUrl: (q) => `https://www.youtube.com/results?search_query=${q.replace(/ /g, "+")}+review`,
    color: "bg-red-600/10 text-red-600 hover:bg-red-600/20 border-red-600/30",
  },
  {
    name: "Google Search",
    icon: <Search className="h-4 w-4" />,
    getUrl: (q) => `https://www.google.com/search?q=${q.replace(/ /g, "+")}`,
    color: "bg-sky-500/10 text-sky-500 hover:bg-sky-500/20 border-sky-500/30",
  },
];

interface ProductPurchaseLinksProps {
  productName: string;
}

export function ProductPurchaseLinks({ productName }: ProductPurchaseLinksProps) {
  const trimmed = productName?.trim();

  if (!trimmed) {
    return (
      <Card className="glass-effect border-border/50">
        <CardContent className="p-6 text-center text-muted-foreground">
          Enter a product name to view purchase links.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-effect border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <ExternalLink className="h-5 w-5 text-primary" />
          View Product Online
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {platforms.map((platform) => (
            <a
              key={platform.name}
              href={platform.getUrl(trimmed)}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-2 px-4 py-3 rounded-lg border text-sm font-medium transition-all ${platform.color}`}
            >
              {platform.icon}
              {platform.name}
            </a>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
