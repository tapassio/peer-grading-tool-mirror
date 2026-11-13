-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "userId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "lastName" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "docPouchId" TEXT,
    "authSource" TEXT NOT NULL DEFAULT 'local',
    "company" TEXT,
    "refreshToken" TEXT,
    "registerToken" TEXT
);
INSERT INTO "new_User" ("company", "email", "firstName", "lastName", "password", "refreshToken", "registerToken", "userId") SELECT "company", "email", "firstName", "lastName", "password", "refreshToken", "registerToken", "userId" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_docPouchId_key" ON "User"("docPouchId");
CREATE UNIQUE INDEX "User_registerToken_key" ON "User"("registerToken");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
