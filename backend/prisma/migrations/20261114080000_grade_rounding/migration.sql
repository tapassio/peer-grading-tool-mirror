-- Rounding of the final grade per campaign (step):
-- 0.5 = half grades (Swiss default), 0.25 = quarter, 0.1 = tenth,
-- 1 = whole grades, 0 = no rounding. Existing campaigns get half grades.
ALTER TABLE "Campaign" ADD COLUMN "gradeRounding" REAL NOT NULL DEFAULT 0.5;
