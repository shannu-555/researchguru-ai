-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Create research_embeddings table for storing vector embeddings
CREATE TABLE public.research_embeddings (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES public.research_projects(id) ON DELETE CASCADE,
    agent_result_id UUID REFERENCES public.agent_results(id) ON DELETE CASCADE,
    content_type TEXT NOT NULL, -- 'sentiment', 'competitor', 'trend', 'insight'
    content_text TEXT NOT NULL, -- The original text that was embedded
    content_chunk TEXT NOT NULL, -- The chunk of text
    embedding VECTOR(768), -- Embedding vector (768 dimensions for Gemini embeddings)
    metadata JSONB DEFAULT '{}', -- Additional metadata
    run_id UUID, -- For traceability
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for vector similarity search
CREATE INDEX research_embeddings_embedding_idx ON public.research_embeddings 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Create index for project lookup
CREATE INDEX research_embeddings_project_id_idx ON public.research_embeddings(project_id);
CREATE INDEX research_embeddings_content_type_idx ON public.research_embeddings(content_type);
CREATE INDEX research_embeddings_run_id_idx ON public.research_embeddings(run_id);

-- Enable Row Level Security
ALTER TABLE public.research_embeddings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view embeddings for their projects"
ON public.research_embeddings
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.research_projects rp
        WHERE rp.id = research_embeddings.project_id
        AND rp.user_id = auth.uid()
    )
);

CREATE POLICY "Users can insert embeddings for their projects"
ON public.research_embeddings
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.research_projects rp
        WHERE rp.id = research_embeddings.project_id
        AND rp.user_id = auth.uid()
    )
);

CREATE POLICY "Users can delete embeddings for their projects"
ON public.research_embeddings
FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM public.research_projects rp
        WHERE rp.id = research_embeddings.project_id
        AND rp.user_id = auth.uid()
    )
);

-- Create research_runs table for traceability
CREATE TABLE public.research_runs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES public.research_projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed', 'insufficient_data'
    agents_triggered JSONB DEFAULT '[]', -- Array of agent types triggered
    embeddings_count INTEGER DEFAULT 0,
    feedback_loop_triggered BOOLEAN DEFAULT false,
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    completed_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'
);

-- Enable RLS for research_runs
ALTER TABLE public.research_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own runs"
ON public.research_runs FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own runs"
ON public.research_runs FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own runs"
ON public.research_runs FOR UPDATE
USING (user_id = auth.uid());

-- Create function for vector similarity search
CREATE OR REPLACE FUNCTION public.match_embeddings(
    query_embedding VECTOR(768),
    match_threshold FLOAT DEFAULT 0.7,
    match_count INT DEFAULT 10,
    filter_project_id UUID DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    project_id UUID,
    content_type TEXT,
    content_text TEXT,
    content_chunk TEXT,
    metadata JSONB,
    similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        re.id,
        re.project_id,
        re.content_type,
        re.content_text,
        re.content_chunk,
        re.metadata,
        1 - (re.embedding <=> query_embedding) AS similarity
    FROM public.research_embeddings re
    WHERE 
        (filter_project_id IS NULL OR re.project_id = filter_project_id)
        AND 1 - (re.embedding <=> query_embedding) > match_threshold
    ORDER BY re.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Create function to check data sufficiency
CREATE OR REPLACE FUNCTION public.check_data_sufficiency(
    p_project_id UUID,
    p_min_embeddings INT DEFAULT 5
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    embedding_count INT;
    agent_count INT;
    result JSONB;
BEGIN
    -- Count embeddings for project
    SELECT COUNT(*) INTO embedding_count
    FROM public.research_embeddings
    WHERE project_id = p_project_id;
    
    -- Count completed agent results
    SELECT COUNT(*) INTO agent_count
    FROM public.agent_results
    WHERE project_id = p_project_id AND status = 'completed';
    
    result := jsonb_build_object(
        'is_sufficient', embedding_count >= p_min_embeddings AND agent_count >= 2,
        'embedding_count', embedding_count,
        'agent_count', agent_count,
        'needs_feedback_loop', embedding_count < p_min_embeddings
    );
    
    RETURN result;
END;
$$;