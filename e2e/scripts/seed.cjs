// Fills the fresh test database. Uses the backend's own Prisma client
// (backend/dist/prisma-client.js), so the data always matches the schema.
const path = require('path');
const backend = path.resolve(__dirname, '../../backend');
const bcrypt = require(path.join(backend, 'node_modules/bcryptjs'));
const { createPrismaClient } = require(path.join(backend, 'dist/prisma-client.js'));
const data = require('./data.cjs');

async function main() {
  const prisma = createPrismaClient();
  try {
    const admin = await prisma.role.create({ data: { role: 'ADMIN' } });
    const peerRole = await prisma.role.create({ data: { role: 'PEER' } });

    const user = await prisma.user.create({
      data: {
        email: data.admin.email,
        firstName: data.admin.firstName,
        lastName: data.admin.lastName,
        password: await bcrypt.hash(data.admin.password, 10),
        roles: { connect: [{ roleId: admin.roleId }] },
      },
    });

    const campaign = await prisma.campaign.create({
      data: {
        name: data.campaign.name,
        maxPoints: data.campaign.maxPoints,
        language: 'de',
        openingDate: new Date(), // running: peers can grade
        users: { connect: [{ userId: user.userId }] },
        criteria: { create: data.campaign.criteria.map((name) => ({ name, weight: 1 })) },
      },
    });

    const group = await prisma.group.create({
      data: { number: 1, campaignId: campaign.campaignId },
    });

    for (const p of data.peers) {
      const peer = await prisma.peer.create({
        data: {
          firstName: p.firstName,
          lastName: p.lastName,
          email: p.email,
          user: {
            create: {
              email: p.email,
              firstName: p.firstName,
              lastName: p.lastName,
              roles: { connect: [{ roleId: peerRole.roleId }] },
            },
          },
        },
      });
      await prisma.groupPeerConnection.create({
        data: { groupId: group.groupId, peerId: peer.peerId, link: p.link },
      });
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
