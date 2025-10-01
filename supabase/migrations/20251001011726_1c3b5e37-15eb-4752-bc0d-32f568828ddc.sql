-- Create research projects table
CREATE TABLE public.research_projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  product_name TEXT NOT NULL,
  company_name TEXT,
  description TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create agent results table
CREATE TABLE public.agent_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.research_projects(id) ON DELETE CASCADE NOT NULL,
  agent_type TEXT NOT NULL CHECK (agent_type IN ('sentiment', 'competitor', 'trends')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
  results JSONB,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create insights table
CREATE TABLE public.insights (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.research_projects(id) ON DELETE CASCADE NOT NULL,
  insight_type TEXT NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user settings table
CREATE TABLE public.user_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL UNIQUE,
  preferences JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.research_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for research_projects
CREATE POLICY "Users can view their own projects" 
ON public.research_projects FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own projects" 
ON public.research_projects FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own projects" 
ON public.research_projects FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own projects" 
ON public.research_projects FOR DELETE 
USING (auth.uid() = user_id);

-- Create RLS policies for agent_results
CREATE POLICY "Users can view agent results for their projects" 
ON public.agent_results FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.research_projects 
  WHERE id = agent_results.project_id AND user_id = auth.uid()
));

CREATE POLICY "Users can create agent results for their projects" 
ON public.agent_results FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.research_projects 
  WHERE id = agent_results.project_id AND user_id = auth.uid()
));

CREATE POLICY "Users can update agent results for their projects" 
ON public.agent_results FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM public.research_projects 
  WHERE id = agent_results.project_id AND user_id = auth.uid()
));

-- Create RLS policies for insights
CREATE POLICY "Users can view insights for their projects" 
ON public.insights FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.research_projects 
  WHERE id = insights.project_id AND user_id = auth.uid()
));

CREATE POLICY "Users can create insights for their projects" 
ON public.insights FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.research_projects 
  WHERE id = insights.project_id AND user_id = auth.uid()
));

-- Create RLS policies for user_settings
CREATE POLICY "Users can view their own settings" 
ON public.user_settings FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own settings" 
ON public.user_settings FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings" 
ON public.user_settings FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own settings" 
ON public.user_settings FOR DELETE 
USING (auth.uid() = user_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_research_projects_updated_at
BEFORE UPDATE ON public.research_projects
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_agent_results_updated_at
BEFORE UPDATE ON public.agent_results
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_user_settings_updated_at
BEFORE UPDATE ON public.user_settings
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();