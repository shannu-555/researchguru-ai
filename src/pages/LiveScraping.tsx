import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { 
  Globe, Loader2, Download, CheckCircle, XCircle, Clock, 
  Star, MessageSquare, ShoppingCart, TrendingUp, RefreshCw 
} from "lucide-react";

const AVAILABLE_SOURCES = [
  { id: 'amazon', label: 'Amazon', icon: ShoppingCart },
  { id: 'flipkart', label: 'Flipkart', icon: ShoppingCart },
  { id: 'reddit', label: 'Reddit', icon: MessageSquare },
  { id: 'twitter', label: 'Twitter/X', icon: MessageSquare },
  { id: 'youtube', label: 'YouTube', icon: Globe },
  { id: 'bestbuy', label: 'Best Buy', icon: ShoppingCart },
];

export default function LiveScraping() {
  const [productName, setProductName] = useState("");
  const [selectedSources, setSelectedSources] = useState<string[]>(['amazon', 'reddit', 'twitter']);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const { toast } = useToast();

  const toggleSource = (id: string) => {
    setSelectedSources(prev => 
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const handleScrape = async () => {
    if (!productName.trim()) {
      toast({ title: "Product name required", variant: "destructive" });
      return;
    }
    if (selectedSources.length === 0) {
      toast({ title: "Select at least one source", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    setResults(null);
    try {
      const { data, error } = await supabase.functions.invoke('live-scrape', {
        body: { productName, sources: selectedSources }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResults(data.data);
      toast({ title: "Scraping complete", description: `Scraped ${data.data?.totalResults || 0} results from ${selectedSources.length} sources` });
    } catch (err: any) {
      toast({ title: "Scraping failed", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const downloadResults = () => {
    if (!results) return;
    const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scrape-${productName.replace(/\s+/g, '-')}.json`;
    a.click();
  };

  return (
    <div className="p-8 space-y-8 animate-fade-in">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold">Real-Time Data Scraping</h1>
        <p className="text-muted-foreground text-lg">
          Live scraping from e-commerce sites, review platforms, and social media
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 glass-effect border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-primary" />
              Scrape Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Product Name *</label>
              <Input
                placeholder="e.g., Sony WH-1000XM5"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                className="bg-background/50"
              />
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium">Data Sources</label>
              {AVAILABLE_SOURCES.map(source => (
                <div key={source.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50 transition-colors">
                  <Checkbox
                    checked={selectedSources.includes(source.id)}
                    onCheckedChange={() => toggleSource(source.id)}
                  />
                  <source.icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{source.label}</span>
                </div>
              ))}
            </div>

            <Button
              onClick={handleScrape}
              disabled={isLoading}
              className="w-full gradient-primary"
              size="lg"
            >
              {isLoading ? (
                <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Scraping...</>
              ) : (
                <><RefreshCw className="mr-2 h-5 w-5" />Start Live Scrape</>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 glass-effect border-border/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Scrape Results</CardTitle>
                <CardDescription>
                  {results ? `${results.totalResults || 0} results scraped at ${new Date(results.scrapedAt).toLocaleString()}` : 'Configure and start scraping'}
                </CardDescription>
              </div>
              {results && (
                <Button variant="outline" size="sm" onClick={downloadResults}>
                  <Download className="mr-2 h-4 w-4" />Download JSON
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!results && !isLoading && (
              <div className="text-center py-12 text-muted-foreground">
                <Globe className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p>No results yet. Configure sources and start scraping.</p>
              </div>
            )}
            {isLoading && (
              <div className="space-y-4">
                {selectedSources.map(src => (
                  <div key={src} className="flex items-center gap-3 p-3 bg-secondary/30 rounded-lg animate-pulse">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span className="text-sm">Scraping {src}...</span>
                  </div>
                ))}
              </div>
            )}
            {results?.sources && (
              <Tabs defaultValue="overview" className="space-y-4">
                <TabsList>
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="listings">Listings</TabsTrigger>
                  <TabsTrigger value="reviews">Reviews</TabsTrigger>
                  <TabsTrigger value="social">Social</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                  {results.aggregatedInsights && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-3 bg-secondary/50 rounded-lg border border-border/30">
                        <p className="text-xs text-muted-foreground">Avg Price</p>
                        <p className="text-xl font-bold text-primary">{results.aggregatedInsights.averagePrice}</p>
                      </div>
                      <div className="p-3 bg-secondary/50 rounded-lg border border-border/30">
                        <p className="text-xs text-muted-foreground">Avg Rating</p>
                        <p className="text-xl font-bold text-primary">{results.aggregatedInsights.averageRating?.toFixed(1)}</p>
                      </div>
                      <div className="p-3 bg-secondary/50 rounded-lg border border-border/30">
                        <p className="text-xs text-muted-foreground">Total Reviews</p>
                        <p className="text-xl font-bold text-primary">{results.aggregatedInsights.totalReviews}</p>
                      </div>
                      <div className="p-3 bg-secondary/50 rounded-lg border border-border/30">
                        <p className="text-xs text-muted-foreground">Availability</p>
                        <p className="text-xl font-bold text-primary">{results.aggregatedInsights.availabilityScore}%</p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <p className="text-sm font-medium">Source Status</p>
                    {results.sources.map((src: any, i: number) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                        <div className="flex items-center gap-3">
                          {src.status === 'success' ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500" />
                          )}
                          <span className="font-medium text-sm">{src.platform}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="text-xs">{src.resultsCount} results</Badge>
                          <span className="text-xs text-muted-foreground">{src.scrapeDuration}ms</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {results.aggregatedInsights?.topPraises && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 bg-green-500/5 rounded-lg border border-green-500/20">
                        <p className="text-xs font-medium text-green-600 mb-2">Top Praises</p>
                        <ul className="space-y-1 text-xs text-muted-foreground">
                          {results.aggregatedInsights.topPraises.map((p: string, i: number) => (
                            <li key={i}>• {p}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="p-3 bg-red-500/5 rounded-lg border border-red-500/20">
                        <p className="text-xs font-medium text-red-600 mb-2">Top Complaints</p>
                        <ul className="space-y-1 text-xs text-muted-foreground">
                          {results.aggregatedInsights.topComplaints?.map((c: string, i: number) => (
                            <li key={i}>• {c}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="listings">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Rating</TableHead>
                        <TableHead>Reviews</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {results.sources.flatMap((src: any) => 
                        (src.data?.listings || []).map((listing: any, i: number) => (
                          <TableRow key={`${src.platform}-${i}`}>
                            <TableCell>
                              <div>
                                <p className="font-medium text-sm">{listing.title}</p>
                                <p className="text-xs text-muted-foreground">{src.platform} — {listing.seller}</p>
                              </div>
                            </TableCell>
                            <TableCell className="font-semibold">{listing.price}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                                <span className="text-sm">{listing.rating}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">{listing.reviewCount}</TableCell>
                            <TableCell>
                              <Badge variant={listing.availability === 'In Stock' ? 'default' : 'destructive'} className="text-xs">
                                {listing.availability}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TabsContent>

                <TabsContent value="reviews" className="space-y-3">
                  {results.sources.flatMap((src: any) => 
                    (src.data?.reviews || []).map((review: any, i: number) => (
                      <div key={`${src.platform}-rev-${i}`} className="p-3 bg-secondary/30 rounded-lg border border-border/30">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {[1,2,3,4,5].map(s => (
                              <Star key={s} className={`h-3 w-3 ${s <= review.rating ? 'text-yellow-500 fill-yellow-500' : 'text-muted-foreground'}`} />
                            ))}
                            <Badge variant="outline" className="text-xs ml-2">{src.platform}</Badge>
                          </div>
                          <span className="text-xs text-muted-foreground">{review.date}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{review.text}</p>
                        {review.verified && (
                          <Badge variant="secondary" className="text-xs mt-2">Verified Purchase</Badge>
                        )}
                      </div>
                    ))
                  )}
                </TabsContent>

                <TabsContent value="social" className="space-y-3">
                  {results.sources.flatMap((src: any) => 
                    (src.data?.mentions || []).map((mention: any, i: number) => (
                      <div key={`${src.platform}-mention-${i}`} className="p-3 bg-secondary/30 rounded-lg border border-border/30">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">{src.platform}</Badge>
                            <span className="text-xs text-muted-foreground">@{mention.author}</span>
                          </div>
                          <Badge 
                            variant={mention.sentiment === 'positive' ? 'default' : mention.sentiment === 'negative' ? 'destructive' : 'secondary'}
                            className="text-xs"
                          >
                            {mention.sentiment}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{mention.text}</p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <span>❤️ {mention.engagement}</span>
                          <span>{mention.date}</span>
                        </div>
                      </div>
                    ))
                  )}
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
