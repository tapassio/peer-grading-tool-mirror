/**
 * Test data: two classes as complete campaigns, including gradings.
 *
 *   Klasse A: 47 students, 12 groups (11 x 4, 1 x 3), campaign RUNNING,
 *             some students have not graded yet
 *   Klasse B: 34 students,  8 groups ( 6 x 4, 2 x 5), campaign CLOSED,
 *             everybody has graded
 *
 * The students come from ../testdata/*.csv (the same files can be imported
 * in the UI). Swiss grade scale 1-6 with half grades.
 *
 * The script only ADDS data, nothing is deleted. The campaigns are assigned
 * to an existing lecturer:
 *
 *   cd backend
 *   TESTDATA_ADMIN_EMAIL=your.mail@example.com npx ts-node prisma/seed-testdata.ts
 *
 * Without TESTDATA_ADMIN_EMAIL the first user with the ADMIN role is used.
 *
 * Dry run (no database, prints a summary and writes the data in the shape of
 * GET /api/campaign/user):
 *
 *   npx ts-node prisma/seed-testdata.ts --dry-run [--json out.json]
 *
 * Built-in patterns, so that the statistics page has something to show:
 * - a few students rate themselves much higher than the others rate them
 * - two students give everybody the same points
 * - in one group one rater is much stricter than the others
 */
import { randomBytes } from 'crypto';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

// ---------- deterministic random numbers (same data on every run) ----------

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** normal distribution (Box-Muller) */
function gauss(rand: () => number, mean = 0, sd = 1): number {
  const u = 1 - rand();
  const v = rand();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const toHalf = (x: number) => Math.round(x * 2) / 2;
const clamp = (x: number, min: number, max: number) =>
  Math.min(max, Math.max(min, x));

// ---------- reading the CSV files ----------

interface Student {
  lastName: string;
  firstName: string;
  email: string;
  group: number;
  matriculationNumber: string;
}

function readClass(file: string): Student[] {
  const lines = readFileSync(
    join(__dirname, '..', '..', 'testdata', file),
    'utf-8',
  )
    .split(/\r?\n/)
    .filter((l) => l.trim() !== '');
  return lines.slice(1).map((line) => {
    const [lastName, firstName, email, group, matriculationNumber] =
      line.split(';');
    return {
      lastName,
      firstName,
      email,
      group: Number(group),
      matriculationNumber,
    };
  });
}

// ---------- generating the gradings ----------

interface ClassConfig {
  name: string;
  file: string;
  seed: number;
  running: boolean;
  /** share of students who have not graded yet (only running campaigns) */
  missingRate: number;
}

const CLASSES: ClassConfig[] = [
  {
    name: 'Testklasse A (47 Studierende) – laufend',
    file: 'klasse-a-47-studierende.csv',
    seed: 47,
    running: true,
    missingRate: 0.2,
  },
  {
    name: 'Testklasse B (34 Studierende) – abgeschlossen',
    file: 'klasse-b-34-studierende.csv',
    seed: 34,
    running: false,
    missingRate: 0,
  },
];

const MAX_POINTS = 6; // Swiss grade scale
const CRITERIA = [
  { name: 'Teamfähigkeit', weight: 2 },
  { name: 'Qualität der Beiträge', weight: 1 },
  { name: 'Zuverlässigkeit', weight: 1 },
];

interface PlannedGrading {
  from: string; // email
  to: string; // email
  criteria: number; // index in CRITERIA
  points: number;
}

interface PlannedGroup {
  number: number;
  students: Student[];
  gradings: PlannedGrading[];
  completed: boolean;
}

function planClass(cfg: ClassConfig): PlannedGroup[] {
  const rand = mulberry32(cfg.seed);
  const students = readClass(cfg.file);
  const numbers = [...new Set(students.map((s) => s.group))].sort(
    (a, b) => a - b,
  );

  // "true" performance of every student and the strictness of every rater
  const quality = new Map(
    students.map((s) => [s.email, clamp(gauss(rand, 4.6, 0.55), 2.5, 6)]),
  );
  const strictness = new Map(
    students.map((s) => [s.email, gauss(rand, 0, 0.25)]),
  );

  // patterns for the statistics page
  const shuffled = [...students].sort(() => rand() - 0.5);
  const overestimate = new Set(shuffled.slice(0, 3).map((s) => s.email));
  const sameForAll = new Set(shuffled.slice(3, 5).map((s) => s.email));
  const harshRater = shuffled[5].email;
  const notYetGraded = new Set(
    shuffled
      .slice(6)
      .filter(() => rand() < cfg.missingRate)
      .map((s) => s.email),
  );

  return numbers.map((number) => {
    const members = students.filter((s) => s.group === number);
    const gradings: PlannedGrading[] = [];

    for (const rater of members) {
      if (notYetGraded.has(rater.email)) continue;
      for (const target of members) {
        CRITERIA.forEach((_, ci) => {
          let p: number;
          if (sameForAll.has(rater.email)) {
            p = 5;
          } else {
            p =
              quality.get(target.email)! +
              strictness.get(rater.email)! +
              gauss(rand, 0, 0.35);
            if (rater.email === harshRater && target !== rater) p -= 2;
            if (rater === target && overestimate.has(rater.email)) p += 1.5;
          }
          gradings.push({
            from: rater.email,
            to: target.email,
            criteria: ci,
            points: clamp(toHalf(p), 1, MAX_POINTS),
          });
        });
      }
    }

    const completed = members.every((m) => !notYetGraded.has(m.email));
    return { number, students: members, gradings, completed };
  });
}

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(8, 0, 0, 0);
  return d;
}

// ---------- dry run: summary + JSON in API shape ----------

function dryRun(jsonFile?: string) {
  let peerId = 1;
  const ids = new Map<string, number>();
  const campaigns = CLASSES.map((cfg, i) => {
    const groups = planClass(cfg);
    const sizes = groups.map((g) => g.students.length);
    const graded = groups.reduce(
      (n, g) => n + new Set(g.gradings.map((x) => x.from)).size,
      0,
    );
    console.log(
      `${cfg.name}: ${sizes.reduce((a, b) => a + b, 0)} students, ` +
        `${groups.length} groups (sizes ${sizes.join(',')}), ` +
        `${graded} have graded, ${groups.reduce((n, g) => n + g.gradings.length, 0)} gradings`,
    );
    for (const g of groups)
      for (const s of g.students)
        if (!ids.has(s.email)) ids.set(s.email, peerId++);
    return {
      campaignId: i + 1,
      name: cfg.name,
      maxPoints: MAX_POINTS,
      language: 'de',
      allowCommentsForPeers: true,
      creationDate: daysFromNow(cfg.running ? -10 : -70),
      openingDate: daysFromNow(cfg.running ? -5 : -60),
      closingDate: cfg.running ? null : daysFromNow(-30),
      criteria: CRITERIA.map((c, ci) => ({
        criteriaId: (i + 1) * 10 + ci,
        ...c,
      })),
      groups: groups.map((g, gi) => ({
        groupId: (i + 1) * 100 + gi,
        number: g.number,
        completed: g.completed,
        peers: g.students.map((s) => ({
          peerId: ids.get(s.email),
          peer: {
            peerId: ids.get(s.email),
            firstName: s.firstName,
            lastName: s.lastName,
            email: s.email,
          },
        })),
        gradings: g.gradings.map((x) => ({
          fromPeerId: ids.get(x.from),
          toPeerId: ids.get(x.to),
          criteriaId: (i + 1) * 10 + x.criteria,
          points: x.points,
        })),
        comments: [],
      })),
    };
  });
  if (jsonFile) {
    writeFileSync(jsonFile, JSON.stringify(campaigns, null, 2));
    console.log(`written: ${jsonFile}`);
  }
}

// ---------- writing to the database ----------

async function seed() {
  // loaded only here, so that --dry-run works without a database
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createPrismaClient } = require('../src/prisma-client');
  const prisma = createPrismaClient();

  try {
    const roleId = async (role: string) =>
      (
        (await prisma.role.findFirst({ where: { role } })) ??
        (await prisma.role.create({ data: { role } }))
      ).roleId;
    const peerRoleId = await roleId('PEER');
    const adminRoleId = await roleId('ADMIN');

    const adminEmail = process.env.TESTDATA_ADMIN_EMAIL;
    const admin = adminEmail
      ? await prisma.user.findUnique({ where: { email: adminEmail } })
      : await prisma.user.findFirst({
          where: { roles: { some: { roleId: adminRoleId } } },
          orderBy: { userId: 'asc' },
        });
    if (!admin) {
      throw new Error(
        adminEmail
          ? `No user with e-mail ${adminEmail}`
          : 'No lecturer (ADMIN) found. Register one first or set TESTDATA_ADMIN_EMAIL.',
      );
    }

    for (const cfg of CLASSES) {
      const groups = planClass(cfg);

      const campaign = await prisma.campaign.create({
        data: {
          name: cfg.name,
          maxPoints: MAX_POINTS,
          language: 'de',
          allowCommentsForPeers: true,
          creationDate: daysFromNow(cfg.running ? -10 : -70),
          openingDate: daysFromNow(cfg.running ? -5 : -60),
          closingDate: cfg.running ? null : daysFromNow(-30),
          users: { connect: { userId: admin.userId } },
          criteria: { create: CRITERIA },
        },
        include: { criteria: true },
      });
      // criteria in the same order as CRITERIA
      const criteriaIds: number[] = CRITERIA.map(
        (c) =>
          campaign.criteria.find((x: { name: string }) => x.name === c.name)
            .criteriaId,
      );

      for (const g of groups) {
        const group = await prisma.group.create({
          data: {
            number: g.number,
            completed: g.completed,
            campaignId: campaign.campaignId,
          },
        });

        const peerIds = new Map<string, number>();
        for (const s of g.students) {
          // peers are users without password (they use their personal link)
          const user = await prisma.user.upsert({
            where: { email: s.email },
            update: {},
            create: {
              email: s.email,
              firstName: s.firstName,
              lastName: s.lastName,
              roles: { connect: { roleId: peerRoleId } },
            },
          });
          const peer = await prisma.peer.upsert({
            where: { email: s.email },
            update: {},
            create: {
              email: s.email,
              firstName: s.firstName,
              lastName: s.lastName,
              matriculationNumber: s.matriculationNumber,
              userId: user.userId,
            },
          });
          peerIds.set(s.email, peer.peerId);
          await prisma.groupPeerConnection.create({
            data: {
              groupId: group.groupId,
              peerId: peer.peerId,
              link: randomBytes(32).toString('base64url'),
            },
          });
        }

        // createMany is not available for SQLite in Prisma 4
        await prisma.$transaction(
          g.gradings.map((x) =>
            prisma.grading.create({
              data: {
                groupId: group.groupId,
                fromPeerId: peerIds.get(x.from)!,
                toPeerId: peerIds.get(x.to)!,
                criteriaId: criteriaIds[x.criteria],
                points: x.points,
              },
            }),
          ),
        );
      }

      console.log(
        `created: ${cfg.name} (campaignId ${campaign.campaignId}) for ${admin.email}`,
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

const args = process.argv.slice(2);
if (args.includes('--dry-run')) {
  const i = args.indexOf('--json');
  dryRun(i >= 0 ? args[i + 1] : undefined);
} else {
  seed().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
