-- -----------------------------------------------------------------
-- LESSON HIGHLIGHTS
-- User-selected text highlights on whiteboard blocks.
-- Highlights are stored per (session, block_idx, selected_text)
-- and are associated with a color for visual distinction.
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lesson_highlights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.lesson_sessions(id) ON DELETE CASCADE,
    block_idx INTEGER NOT NULL,
    selected_text TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT 'yellow',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.lesson_highlights IS 'User text highlights saved on lesson whiteboard blocks';

CREATE INDEX IF NOT EXISTS lesson_highlights_session_idx ON public.lesson_highlights (session_id);
CREATE INDEX IF NOT EXISTS lesson_highlights_session_block_idx ON public.lesson_highlights (session_id, block_idx);

-- -----------------------------------------------------------------
-- ROW LEVEL SECURITY
-- -----------------------------------------------------------------
ALTER TABLE public.lesson_highlights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lesson highlights workspace access" ON public.lesson_highlights;
CREATE POLICY "Lesson highlights workspace access"
    ON public.lesson_highlights FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.lesson_sessions s
        JOIN public.workspaces w ON w.id = s.workspace_id
        WHERE s.id = lesson_highlights.session_id
          AND (
              w.user_id = auth.uid()
              OR auth.jwt() -> 'user_metadata' ->> 'role' = 'teacher'
              OR EXISTS (
                  SELECT 1 FROM public.class_memberships m
                  WHERE m.workspace_id = w.id AND m.student_id = auth.uid()
              )
          )
    ));
