/**
 * Replaces all old, guessable peer links (md5(groupId-peerId) + ids)
 * with random links.
 *
 * Run once after deploying the new version:
 *   cd backend && node prisma/migrations/regenerate-peer-links.js
 *
 * Afterwards the old links stop working. For running campaigns send
 * reminder mails so that peers get their new link.
 */
const { PrismaClient } = require('@prisma/client');
const { randomBytes } = require('crypto');

const prisma = new PrismaClient();

// old links: 32 hex chars (md5) followed by digits (groupId + peerId)
const OLD_LINK = /^[0-9a-f]{32}\d+$/;

async function main() {
  const connections = await prisma.groupPeerConnection.findMany();
  let changed = 0;

  for (const c of connections) {
    if (!OLD_LINK.test(c.link)) continue;

    await prisma.groupPeerConnection.update({
      where: { groupId_peerId: { groupId: c.groupId, peerId: c.peerId } },
      data: { link: randomBytes(32).toString('base64url') },
    });
    changed++;
  }

  console.log(`${changed} of ${connections.length} links regenerated.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
