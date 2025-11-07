import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

interface Product {
  id: string;
  name: string;
  company: string;
  rating: number;
  price: string;
}

interface ComparisonSelectorProps {
  onProductsSelected: (products: Product[]) => void;
}

export function ComparisonSelector({ onProductsSelected }: ComparisonSelectorProps) {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProducts();
  }, [user]);

  const loadProducts = async () => {
    if (!user) return;

    try {
      const { data: projects } = await supabase
        .from('research_projects')
        .select('id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (projects && projects.length > 0) {
        const { data: results } = await supabase
          .from('agent_results')
          .select('*')
          .eq('project_id', projects[0].id)
          .eq('agent_type', 'competitor')
          .eq('status', 'completed')
          .order('created_at', { ascending: false })
          .limit(1);

        if (results && results.length > 0) {
          const resultData = results[0].results as any;
          if (resultData?.competitors && Array.isArray(resultData.competitors)) {
            const productsWithIds = resultData.competitors.map((c: any, index: number) => ({
              ...c,
              id: `product-${index}`
            }));
            setProducts(productsWithIds);
          }
        }
      }
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (productId: string) => {
    setSelectedIds(prev => {
      const newIds = prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId];
      return newIds;
    });
  };

  const handleCompare = () => {
    const selected = products.filter(p => selectedIds.includes(p.id));
    onProductsSelected(selected);
  };

  if (loading) {
    return (
      <Card className="glass-effect border-border/50">
        <CardContent className="p-8 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-effect border-border/50">
      <CardHeader>
        <CardTitle>Select Products to Compare</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((product) => (
            <div
              key={product.id}
              className="flex items-start space-x-3 p-4 rounded-lg border border-border/50 hover:border-primary/50 transition-all cursor-pointer"
              onClick={() => handleToggle(product.id)}
            >
              <Checkbox
                checked={selectedIds.includes(product.id)}
                onCheckedChange={() => handleToggle(product.id)}
              />
              <div className="flex-1">
                <p className="font-medium">{product.name}</p>
                <p className="text-sm text-muted-foreground">{product.company}</p>
                <p className="text-sm text-muted-foreground">Rating: {product.rating}/5</p>
              </div>
            </div>
          ))}
        </div>
        <Button
          onClick={handleCompare}
          disabled={selectedIds.length < 2}
          className="w-full"
        >
          Compare Selected ({selectedIds.length})
        </Button>
      </CardContent>
    </Card>
  );
}
