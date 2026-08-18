-- 001_init_ai_study_workspace.sql
-- AI Study Workspace / Lumi Clone - Supabase PostgreSQL + pgvector schema

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm; -- optional text-search helper

-- -----------------------------------------------------------------
-- ENUMERATIONS
-- -----------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
        CREATE TYPE app_role AS ENUM ('student', 'teacher');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_language') THEN
        CREATE TYPE app_language AS ENUM ('kz', 'ru', 'en');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'artifact_type') THEN
        CREATE TYPE artifact_type AS ENUM ('podcast', 'summary', 'quiz', 'roadmap');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'progress_status') THEN
        CREATE TYPE progress_status AS ENUM ('completed', 'failed');
    END IF;
END
$$;

-- -----------------------------------------------------------------
-- PROFILES (extends Supabase Auth users)
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role app_role NOT NULL DEFAULT 'student',
    lang app_language NOT NULL DEFAULT 'en',
    email TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.profiles IS 'Public user profile extending Supabase Auth';

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, role, lang, email)
    VALUES (NEW.id, COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'student'), 'en', NEW.email)
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- -----------------------------------------------------------------
-- WORKSPACES
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    subject TEXT,
    grade TEXT,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.workspaces IS 'Learning workspace owned by a teacher or student';

-- -----------------------------------------------------------------
-- SOURCES (uploaded PDFs)
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_hash TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.sources IS 'Uploaded learning materials (PDFs)';

-- -----------------------------------------------------------------
-- DOCUMENT CHUNKS (RAG source of truth)
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID NOT NULL REFERENCES public.sources(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    embedding VECTOR(1536) NOT NULL
);

COMMENT ON TABLE public.document_chunks IS 'Vectorized document chunks for RAG';

-- HNSW index for fast cosine similarity search
CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx
    ON public.document_chunks
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- -----------------------------------------------------------------
-- WORKSPACE ARTIFACTS (podcasts, summaries, quizzes, roadmaps)
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workspace_artifacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    source_hash TEXT,
    type artifact_type NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.workspace_artifacts IS 'Generated AI artifacts per workspace';

-- -----------------------------------------------------------------
-- STUDENT PROGRESS (error heatmap data)
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.student_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    node_id TEXT NOT NULL,
    status progress_status NOT NULL,
    error_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.student_progress IS 'Per-node student progress for teacher heatmaps';

CREATE INDEX IF NOT EXISTS student_progress_ws_idx
    ON public.student_progress (workspace_id, student_id);
CREATE INDEX IF NOT EXISTS student_progress_node_idx
    ON public.student_progress (node_id);

-- -----------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS)
-- -----------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_progress ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read/update their own profile; teachers can read all
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id OR EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'teacher'
    ));

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

-- Workspaces: owners have full access; teachers can read all workspaces
DROP POLICY IF EXISTS "Workspaces owner full access" ON public.workspaces;
CREATE POLICY "Workspaces owner full access"
    ON public.workspaces FOR ALL
    USING (user_id = auth.uid() OR EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'teacher'
    ));

-- Sources: accessible through workspace membership
DROP POLICY IF EXISTS "Sources workspace access" ON public.sources;
CREATE POLICY "Sources workspace access"
    ON public.sources FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.workspaces w
        JOIN public.profiles p ON p.id = auth.uid()
        WHERE w.id = sources.workspace_id
          AND (w.user_id = auth.uid() OR p.role = 'teacher')
    ));

-- Document chunks: accessible through source/workspace membership
DROP POLICY IF EXISTS "Chunks workspace access" ON public.document_chunks;
CREATE POLICY "Chunks workspace access"
    ON public.document_chunks FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.sources s
        JOIN public.workspaces w ON w.id = s.workspace_id
        JOIN public.profiles p ON p.id = auth.uid()
        WHERE s.id = document_chunks.source_id
          AND (w.user_id = auth.uid() OR p.role = 'teacher')
    ));

-- Workspace artifacts: accessible through workspace membership
DROP POLICY IF EXISTS "Artifacts workspace access" ON public.workspace_artifacts;
CREATE POLICY "Artifacts workspace access"
    ON public.workspace_artifacts FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.workspaces w
        JOIN public.profiles p ON p.id = auth.uid()
        WHERE w.id = workspace_artifacts.workspace_id
          AND (w.user_id = auth.uid() OR p.role = 'teacher')
    ));

-- Student progress: students own their progress; teachers read all
DROP POLICY IF EXISTS "Student progress access" ON public.student_progress;
CREATE POLICY "Student progress access"
    ON public.student_progress FOR ALL
    USING (student_id = auth.uid() OR EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'teacher'
    ));

-- -----------------------------------------------------------------
-- SERVICE ROLE BYPASS (for backend AI microservice using service_key)
-- -----------------------------------------------------------------
-- The backend connects with the service_role key and bypasses RLS by default.
-- The above policies govern frontend (anon/key) access.
