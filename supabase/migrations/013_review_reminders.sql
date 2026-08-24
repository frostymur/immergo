-- -----------------------------------------------------------------
-- 013: spaced-repetition review reminders.
-- Every failed practice node schedules a review: 1st fail -> +1 day,
-- 2nd -> +3 days, 3rd -> +7 days, 4th+ -> +14 days. A completed
-- attempt clears the node from the review queue. The dashboard shows
-- everything due (or coming due within 48h) as a reminder with a
-- "review now" CTA that starts a fresh lesson on that topic.
-- -----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.review_schedule (
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    node_id TEXT NOT NULL,
    fail_count INTEGER NOT NULL DEFAULT 1,
    next_review_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, node_id)
);

COMMENT ON TABLE public.review_schedule IS 'Spaced-repetition queue: failed nodes awaiting a review attempt';

CREATE INDEX IF NOT EXISTS review_schedule_due_idx
    ON public.review_schedule (user_id, next_review_at);

ALTER TABLE public.review_schedule ENABLE ROW LEVEL SECURITY;

-- Students see their own queue; teachers see the queues of their students.
DROP POLICY IF EXISTS "Review schedule access" ON public.review_schedule;
CREATE POLICY "Review schedule access"
    ON public.review_schedule FOR ALL
    USING (
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.class_memberships m
            WHERE m.student_id = review_schedule.user_id AND m.teacher_id = auth.uid()
        )
    );

CREATE OR REPLACE FUNCTION public.schedule_review()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'failed' THEN
        UPDATE public.review_schedule r
        SET fail_count = r.fail_count + 1,
            next_review_at = NOW() + CASE
                WHEN r.fail_count + 1 = 1 THEN INTERVAL '1 day'
                WHEN r.fail_count + 1 = 2 THEN INTERVAL '3 days'
                WHEN r.fail_count + 1 = 3 THEN INTERVAL '7 days'
                ELSE INTERVAL '14 days'
            END,
            updated_at = NOW()
        WHERE r.user_id = NEW.student_id AND r.node_id = NEW.node_id;

        IF NOT FOUND THEN
            INSERT INTO public.review_schedule (user_id, node_id, fail_count, next_review_at)
            VALUES (NEW.student_id, NEW.node_id, 1, NOW() + INTERVAL '1 day')
            ON CONFLICT (user_id, node_id) DO UPDATE
                SET fail_count = review_schedule.fail_count + 1,
                    next_review_at = NOW() + CASE
                        WHEN review_schedule.fail_count + 1 = 2 THEN INTERVAL '3 days'
                        WHEN review_schedule.fail_count + 1 = 3 THEN INTERVAL '7 days'
                        ELSE INTERVAL '14 days'
                    END,
                    updated_at = NOW();
        END IF;
    ELSE
        -- Node mastered again: drop it from the review queue.
        DELETE FROM public.review_schedule
        WHERE user_id = NEW.student_id AND node_id = NEW.node_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS student_progress_review_trigger ON public.student_progress;
CREATE TRIGGER student_progress_review_trigger
AFTER INSERT ON public.student_progress
FOR EACH ROW EXECUTE FUNCTION public.schedule_review();
