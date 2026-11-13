-- Half grades (e.g. 4.5 on the Swiss grade scale):
-- Grading.points changes from INTEGER to REAL. Existing values are kept.

-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Grading" (
    "fromPeerId" INTEGER NOT NULL,
    "toPeerId" INTEGER NOT NULL,
    "groupId" INTEGER NOT NULL,
    "criteriaId" INTEGER NOT NULL,
    "points" REAL NOT NULL,
    CONSTRAINT "Grading_fromPeerId_fkey" FOREIGN KEY ("fromPeerId") REFERENCES "Peer" ("peerId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Grading_toPeerId_fkey" FOREIGN KEY ("toPeerId") REFERENCES "Peer" ("peerId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Grading_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "_Group" ("groupId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Grading_criteriaId_fkey" FOREIGN KEY ("criteriaId") REFERENCES "Criteria" ("criteriaId") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Grading" ("criteriaId", "fromPeerId", "groupId", "points", "toPeerId") SELECT "criteriaId", "fromPeerId", "groupId", "points", "toPeerId" FROM "Grading";
DROP TABLE "Grading";
ALTER TABLE "new_Grading" RENAME TO "Grading";
CREATE UNIQUE INDEX "Grading_fromPeerId_toPeerId_groupId_criteriaId_key" ON "Grading"("fromPeerId", "toPeerId", "groupId", "criteriaId");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
