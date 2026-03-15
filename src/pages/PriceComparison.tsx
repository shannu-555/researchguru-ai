import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, AreaChart, Area
} from "recharts";
import {
  DollarSign, Loader2, Download, TrendingDown, TrendingUp,
  ShoppingCart, Star, ArrowRight, CheckCircle, AlertTriangle
} from "lucide-react";

export default function PriceComparison() {
  const [productName, setProductName] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const { toast } = useToast();

  const handleCompare = async () => {
    if (!productName.trim()) {
      toast({ title: "Product name required", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    setResults(null);
    try {
      const { data, error } = await supabase.functions.invoke('price-comparison', {
        body: { productName, currency }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResults(data.data);
      toast({ title: "Price comparison complete" });
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
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
    a.download = `prices-${productName.replace(/\s+/g, '-')}.json`;
    a.click();
  };

  const analysis = results?.priceAnalysis;

  return (
    <div className="p-8 space-y-8 animate-fade-in">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold">Price Comparison Engine</h1>
        <p className="text-muted-foreground text-lg">
          Live price tracking and historical trends across retailers
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Input
          placeholder="e.g., Samsung Galaxy S24"
          value={productName}
          onChange={(e) => setProductName(e.target.value)}
          className="bg-background/50"
        />
        <Select value={currency} onValueChange={setCurrency}>
          <SelectTrigger className="bg-background/50">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="USD">USD ($)</SelectItem>
            <SelectItem value="EUR">EUR (€)</SelectItem>
            <SelectItem value="GBP">GBP (£)</SelectItem>
            <SelectItem value="INR">INR (₹)</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={handleCompare} disabled={isLoading} className="gradient-primary">
          {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Comparing...</> : <><DollarSign className="mr-2 h-4 w-4" />Compare Prices</>}
        </Button>
      </div>

      {results && (
        <>
          {/* Price Analysis Summary */}
          {analysis && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="glass-effect border-border/50">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Best Price</p>
                  <p className="text-2xl font-bold text-green-500">${analysis.currentBestPrice}</p>
                  <p className="text-xs text-muted-foreground">{analysis.bestRetailer}</p>
                </CardContent>
              </Card>
              <Card className="glass-effect border-border/50">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Average Price</p>
                  <p className="text-2xl font-bold text-primary">${analysis.averagePrice}</p>
                  <p className="text-xs text-muted-foreground">Across all retailers</p>
                </CardContent>
              </Card>
              <Card className="glass-effect border-border/50">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Price Range</p>
                  <p className="text-2xl font-bold text-primary">${analysis.priceRange?.min} - ${analysis.priceRange?.max}</p>
                  <p className="text-xs text-muted-foreground">Volatility: {analysis.priceVolatility}</p>
                </CardContent>
              </Card>
              <Card className="glass-effect border-border/50">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Savings Potential</p>
                  <p className="text-2xl font-bold text-green-500">{analysis.savingsOpportunity}%</p>
                  <Badge variant={analysis.recommendation?.includes('buy') ? 'default' : 'secondary'} className="text-xs mt-1">
                    {analysis.recommendation}
                  </Badge>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Retailer Price Table */}
          {results.retailers && (
            <Card className="glass-effect border-border/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5 text-primary" />
                    Retailer Prices
                  </CardTitle>
                  <Button variant="outline" size="sm" onClick={downloadResults}>
                    <Download className="mr-2 h-4 w-4" />Download
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Retailer</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Original</TableHead>
                      <TableHead>Discount</TableHead>
                      <TableHead>Shipping</TableHead>
                      <TableHead>Delivery</TableHead>
                      <TableHead>Stock</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.retailers.map((r: any, i: number) => (
                      <TableRow key={i}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{r.name}</span>
                            <div className="flex items-center gap-1">
                              <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                              <span className="text-xs">{r.sellerRating}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="font-bold text-primary">${r.price}</TableCell>
                        <TableCell className={r.originalPrice ? 'line-through text-muted-foreground' : ''}>
                          {r.originalPrice ? `$${r.originalPrice}` : '—'}
                        </TableCell>
                        <TableCell>
                          {r.discount ? (
                            <Badge className="bg-green-500/10 text-green-600 text-xs">{r.discount}% off</Badge>
                          ) : '—'}
                        </TableCell>
                        <TableCell>{r.shippingCost === 0 ? <Badge variant="secondary" className="text-xs">Free</Badge> : `$${r.shippingCost}`}</TableCell>
                        <TableCell className="text-sm">{r.deliveryDays} days</TableCell>
                        <TableCell>
                          {r.inStock ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Price History Chart */}
          {results.priceHistory?.last6Months && (
            <Card className="glass-effect border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingDown className="h-5 w-5 text-primary" />
                  6-Month Price History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={results.priceHistory.last6Months}>
                    <defs>
                      <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        color: 'hsl(var(--foreground))',
                      }}
                    />
                    <Legend />
                    <Area type="monotone" dataKey="avgPrice" name="Avg" stroke="hsl(var(--primary))" fill="url(#priceGrad)" />
                    <Line type="monotone" dataKey="minPrice" name="Min" stroke="hsl(142, 71%, 45%)" strokeDasharray="5 5" dot={false} />
                    <Line type="monotone" dataKey="maxPrice" name="Max" stroke="hsl(0, 84%, 60%)" strokeDasharray="5 5" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Similar Products */}
          {results.similarProducts && results.similarProducts.length > 0 && (
            <Card className="glass-effect border-border/50">
              <CardHeader>
                <CardTitle>Value Alternatives</CardTitle>
                <CardDescription>Similar products ranked by value score</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {results.similarProducts.map((p: any, i: number) => (
                    <div key={i} className="p-4 bg-secondary/50 rounded-lg border border-border/30">
                      <p className="font-medium mb-2">{p.name}</p>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-primary font-bold">${p.price}</span>
                        <div className="flex items-center gap-1">
                          <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                          <span>{p.rating}</span>
                        </div>
                      </div>
                      <div className="mt-2">
                        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                          <span>Value Score</span>
                          <span>{p.valuScore}/100</span>
                        </div>
                        <div className="w-full bg-secondary rounded-full h-2">
                          <div 
                            className="h-2 rounded-full bg-primary transition-all" 
                            style={{ width: `${p.valuScore}%` }} 
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
