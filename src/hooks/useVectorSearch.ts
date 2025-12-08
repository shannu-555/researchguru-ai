import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface VectorMatch {
  id: string;
  project_id: string;
  content_type: string;
  content_text: string;
  content_chunk: string;
  metadata: Record<string, any>;
  similarity: number;
}

interface UseVectorSearchResult {
  search: (query: string, projectId?: string) => Promise<VectorMatch[]>;
  isSearching: boolean;
  matches: VectorMatch[];
  error: string | null;
}

export function useVectorSearch(): UseVectorSearchResult {
  const [isSearching, setIsSearching] = useState(false);
  const [matches, setMatches] = useState<VectorMatch[]>([]);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (query: string, projectId?: string): Promise<VectorMatch[]> => {
    setIsSearching(true);
    setError(null);

    try {
      const { data, error: searchError } = await supabase.functions.invoke('vector-search', {
        body: {
          query,
          projectId,
          matchThreshold: 0.4,
          matchCount: 10
        }
      });

      if (searchError) {
        throw searchError;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      const results = data?.matches || [];
      setMatches(results);
      return results;
    } catch (err: any) {
      const errorMessage = err.message || 'Vector search failed';
      setError(errorMessage);
      console.error('Vector search error:', err);
      return [];
    } finally {
      setIsSearching(false);
    }
  }, []);

  return {
    search,
    isSearching,
    matches,
    error
  };
}
