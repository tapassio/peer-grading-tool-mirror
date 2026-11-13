import { Campaign, PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

const prisma = new PrismaClient();

const critNames = [
  {
    de: 'Teamfähigkeit',
    en: 'Teamworking skills',
  },
  {
    de: 'Qualität',
    en: 'Quality',
  },
  {
    de: 'Quantität',
    en: 'Quantity',
  },
  {
    de: 'Zuverlässigkeit',
    en: 'Reliability',
  },
];

// generating random words for comments
const words = [
  'Lorem',
  'ipsum',
  'dolor',
  'sit',
  'amet',
  'consetetur',
  'sadipscing',
  'elitr',
  'sed',
  'diam',
  'nonumy',
  'eirmod',
  'tempor',
  'invidunt',
  'ut',
  'labore',
  'et',
  'dolore',
  'magna',
  'aliquyam',
  'erat',
  'sed',
  'diam',
  'voluptua',
];

function generateDate(
  daysAdded: number,
  hours: number = 0,
  minutes: number = 0,
  seconds: number = 0,
  milliseconds: number = 0,
): Date {
  let resDate = new Date();
  resDate.setDate(resDate.getDate() + daysAdded);
  resDate.setHours(hours, minutes, seconds, milliseconds);
  return resDate;
}

async function createCampaign(
  name: string,
  creationDate: Date,
  openingDate?: Date,
  closingDate?: Date,
  language: 'de' | 'en' = 'de',
  allowCommentsForPeers: boolean = true,
  maxPoints: number = 6, // Swiss school grade scale 1-6
) {
  return await prisma.campaign.create({
    data: {
      name,
      maxPoints,
      creationDate,
      openingDate,
      closingDate,
      allowCommentsForPeers,
      language,
    },
  });
}

function generateRandomComment(): string {
  // randomize words
  const randomWords = words.sort((a: string, b: string) => Math.random() - 0.5);

  return randomWords.join(' ') + '.';
}

async function createCriteria(
  index: number,
  campaign: Campaign,
  weight: number = 1,
) {
  let name = critNames[index][campaign.language];

  if (name)
    await prisma.criteria.create({
      data: {
        name: name,
        weight: weight,
        campaignId: campaign.campaignId,
      },
    });
}

async function createGroup(
  number: number,
  campaignId: number,
  completed: boolean = true,
) {
  await prisma.group.create({
    data: {
      number: number,
      completed: completed,
      campaign: {
        connect: {
          campaignId: campaignId,
        },
      },
    },
  });
}

async function createUser(
  firstName: string,
  lastName: string,
  email: string,
  roleIds: number[],
  campaignIds: number[],
  company?: string,
  password: string = 'p',
) {
  const passwordEncrypted = bcrypt.hashSync(password, 12);

  return await prisma.user.create({
    data: {
      lastName: lastName,
      firstName: firstName,
      email: email,
      company: company,
      password: passwordEncrypted,
      roles: {
        connect: roleIds.map((id) => {
          return {
            roleId: id,
          };
        }),
      },
      campaigns: {
        connect: campaignIds.map((id) => {
          return {
            campaignId: id,
          };
        }),
      },
    },
  });
}

async function generateCommentsForGroup(peers: any[], admin: any) {
  // getting users for group1 and admin
  const groupUsersAndAdmin = await prisma.user.findMany({
    where: {
      OR: [
        {
          userId: admin.userId,
        },
        {
          peer: {
            peerId: {
              in: peers.map((peer) => peer.peerId),
            },
          },
        },
      ],
    },
    include: {
      peer: true,
    },
  });

  // adding comments for group 1
  for (const fromPeer of peers) {
    for (const toUser of groupUsersAndAdmin) {
      // skip if it's a comment to the peer himself
      if (fromPeer.peerId === toUser.peer?.peerId) {
        continue;
      }

      await prisma.comment.create({
        data: {
          groupId: fromPeer.groups[0].groupId,
          fromPeerId: fromPeer.peerId,
          text: generateRandomComment(),
          toUserId: toUser.userId,
        },
      });
    }
  }
}

function generateUserArrayData(
  firstName: string,
  lastName: string,
  email: string,
  group: number,
  matriculationNumber?: string,
) {
  return {
    firstName: firstName,
    lastName: lastName,
    matriculationNumber: matriculationNumber,
    email: email,
    group: group,
  };
}

async function createPeerUser(
  user: {
    firstName: string;
    lastName: string;
    email: string;
    group: number;
    matriculationNumber?: string;
  },
  roleId: number,
  password: string = 'p',
) {
  const passwordEncrypted = bcrypt.hashSync(password, 12);

  await prisma.user.upsert({
    where: {
      email: user.email,
    },
    update: {
      lastName: user.lastName,
      firstName: user.firstName,
      password: passwordEncrypted,
      roles: {
        connect: {
          roleId: roleId,
        },
      },
      peer: {
        create: {
          lastName: user.lastName,
          firstName: user.firstName,
          email: user.email,
          matriculationNumber: user.matriculationNumber,
        },
      },
    },
    create: {
      lastName: user.lastName,
      firstName: user.firstName,
      email: user.email,
      password: passwordEncrypted,
      roles: {
        connect: {
          roleId: roleId,
        },
      },
      peer: {
        create: {
          lastName: user.lastName,
          firstName: user.firstName,
          email: user.email,
          matriculationNumber: user.matriculationNumber,
        },
      },
    },
  });
}

function generateLink(_groupId, _peerId) {
  // random, not guessable (same as AppService.generateLink)
  return randomBytes(32).toString('base64url');
}

// generating gradings for groups
async function generateGradings(
  peers,
  criteria,
  maxPoints,
  leaveOutFirst = false,
) {
  const groupId = peers[0].groups[0].groupId;

  for (let [index, fromPeer] of peers.entries()) {
    if (index != 0 || !leaveOutFirst) {
      for (let toPeer of peers) {
        for (let crit of criteria) {
          await prisma.grading.create({
            data: {
              fromPeerId: fromPeer.peerId,
              toPeerId: toPeer.peerId,
              criteriaId: crit.criteriaId,
              groupId: groupId,
              points: Math.floor(Math.random() * maxPoints + 1),
            },
          });
        }
      }
    }
  }
}

async function main() {
  // deleting all existing data
  await prisma.peer.deleteMany({});
  await prisma.comment.deleteMany({});
  await prisma.group.deleteMany({});
  await prisma.criteria.deleteMany({});
  await prisma.campaign.deleteMany({});
  await prisma.grading.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.role.deleteMany({});
  await prisma.groupPeerConnection.deleteMany({});

  // preparing dates
  const openingDateOver = generateDate(-6);
  const closingDateOver = generateDate(-2, 23, 59, 59);

  const openingDateRunning = generateDate(-2);

  const openingDateNotStarted = generateDate(4);

  // initializing the campaigns
  const campaignOver = await createCampaign(
    'Fertig',
    openingDateOver,
    openingDateOver,
    closingDateOver,
    'en',
  );
  const campaignRunning = await createCampaign(
    'Laufend',
    openingDateRunning,
    openingDateRunning,
    undefined,
    'en',
  );
  const campaignNotStarted = await createCampaign(
    'Noch nicht gestartet',
    openingDateNotStarted,
    undefined,
    undefined,
    'en',
    false,
  );

  const peterDummyCampaign = await createCampaign(
    'Peters Dummy Campaign',
    openingDateNotStarted,
    undefined,
    undefined,
  );

  const eduardDummyCampaign = await createCampaign(
    'Edis Dummy Campaign',
    openingDateNotStarted,
    undefined,
    undefined,
  );

  // initializing criteria
  await createCriteria(0, campaignOver);
  await createCriteria(1, campaignOver);
  await createCriteria(2, campaignOver);
  await createCriteria(3, campaignOver);

  await createCriteria(0, campaignRunning);
  await createCriteria(1, campaignRunning);
  await createCriteria(2, campaignRunning);
  await createCriteria(3, campaignRunning);

  await createCriteria(0, campaignNotStarted);
  await createCriteria(1, campaignNotStarted);
  await createCriteria(2, campaignNotStarted);
  await createCriteria(3, campaignNotStarted);

  // initializing all groups
  await createGroup(1, campaignOver.campaignId);
  await createGroup(2, campaignOver.campaignId);
  await createGroup(3, campaignOver.campaignId);

  await createGroup(1, campaignRunning.campaignId);
  await createGroup(2, campaignRunning.campaignId);
  await createGroup(3, campaignRunning.campaignId);

  await createGroup(1, campaignNotStarted.campaignId);
  await createGroup(2, campaignNotStarted.campaignId);
  await createGroup(3, campaignNotStarted.campaignId);

  // initializing the admin role
  const adminRole = await prisma.role.create({
    data: {
      role: 'ADMIN',
    },
  });

  // initializing the peer role
  const peerRole = await prisma.role.create({
    data: {
      role: 'PEER',
    },
  });

  // initializing the super role --> can edit admins
  const superRole = await prisma.role.create({
    data: {
      role: 'SUPER',
    },
  });

  // initializing the admin users and giving them their campaigns and roles
  const adminUser = await createUser(
    'LastName',
    'FirstName',
    'your.mail@example.com',
    [adminRole.roleId, superRole.roleId],
    [
      campaignOver.campaignId,
      campaignRunning.campaignId,
      campaignNotStarted.campaignId,
    ],
    'Company', // optional company
  );
  await createUser(
    'Testman',
    'Peter',
    'testp1@example.com',
    [adminRole.roleId],
    [peterDummyCampaign.campaignId, campaignOver.campaignId],
  );

  // initializing an array of peer user data for later
  const peerUserArray = [
    generateUserArrayData(
      'Peter',
      'Testmann',
      'testp1@exmaple.ch',
      1,
      // '27-561-564',
    ),
    generateUserArrayData(
      'Betina',
      'Musterfrau',
      'mustb1@exmaple.ch',
      1,
      '27-123-564',
    ),
    generateUserArrayData(
      'Ladina',
      'Ladidadi',
      'ladil2@exmaple.ch',
      1,
      // '52-561-123',
    ),
    generateUserArrayData(
      'Timothy',
      'Testing',
      'testt4@exmaple.ch',
      1,
      // '24-123-123',
    ),
    generateUserArrayData(
      'Daniela',
      'Delphin',
      'danid2@exmaple.ch',
      2,
      // '24-321-123',
    ),
    generateUserArrayData(
      'Hämpu',
      'Hamster',
      'haemh1@exmaple.ch',
      2,
      '24-456-456',
    ),
    generateUserArrayData(
      'Alissa',
      'Alligator',
      'alisa2@exmaple.ch',
      2,
      // '24-456-123',
    ),
    generateUserArrayData(
      'Sabrina',
      'Spinne',
      'spins4@example.com',
      3,
      '24-780-115',
    ),
    generateUserArrayData(
      'Helmuth',
      'Hecht',
      'helmh2@example.ch',
      3,
      '89-891-505',
    ),
  ];

  // looping through the peer user array to initialize the peer users, their corresponding peers and give them the correct role
  for (let user of peerUserArray) {
    await createPeerUser(user, peerRole.roleId);
  }

  // getting all peers
  let peers = await prisma.peer.findMany({});

  // getting all groups

  let groups = await prisma.group.findMany({});

  // connecting peers to groups
  for (let peer of peers) {
    let foundUser = peerUserArray.find((p) => p.email == peer.email);
    for (let group of groups.filter((gr) => gr.number === foundUser.group)) {
      if (foundUser) {
        await prisma.groupPeerConnection.create({
          data: {
            groupId: group.groupId,
            peerId: peer.peerId,
            link: generateLink(group.groupId, peer.peerId),
          },
        });
      }
    }
  }

  // filter peers for group 1
  const group1Peers = await prisma.peer.findMany({
    where: {
      groups: {
        some: {
          groupId: 1,
        },
      },
    },
    include: {
      groups: {
        where: {
          groupId: 1,
        },
      },
    },
  });

  // generating comments for group 1
  generateCommentsForGroup(group1Peers, adminUser);

  // generating array of peers from group 2
  const group2Peers = await prisma.peer.findMany({
    where: {
      groups: {
        some: {
          groupId: 2,
        },
      },
    },
    include: {
      groups: {
        where: {
          groupId: 2,
        },
      },
    },
  });

  // generating array of peers from group 4
  const group4Peers = await prisma.peer.findMany({
    where: {
      groups: {
        some: {
          groupId: 4,
        },
      },
    },
    include: {
      groups: {
        where: {
          groupId: 4,
        },
      },
    },
  });

  // generating comments for group 4
  generateCommentsForGroup(group4Peers, adminUser);

  // generating array of peers from group 4
  const group5Peers = await prisma.peer.findMany({
    where: {
      groups: {
        some: {
          groupId: 5,
        },
      },
    },
    include: {
      groups: {
        where: {
          groupId: 5,
        },
      },
    },
  });

  // getting array of criteria from closed campaign
  const criteriaCampaign1 = await prisma.criteria.findMany({
    where: {
      campaignId: campaignOver.campaignId,
    },
  });

  // getting array of criteria from running campaign
  const criteriaCampaign2 = await prisma.criteria.findMany({
    where: {
      campaignId: campaignRunning.campaignId,
    },
  });

  // generating gradings for the groups
  await generateGradings(
    group1Peers,
    criteriaCampaign1,
    campaignOver.maxPoints,
  );
  await generateGradings(
    group2Peers,
    criteriaCampaign1,
    campaignOver.maxPoints,
    true,
  );
  await generateGradings(
    group4Peers,
    criteriaCampaign2,
    campaignRunning.maxPoints,
  );
  await generateGradings(
    group5Peers,
    criteriaCampaign2,
    campaignRunning.maxPoints,
    true,
  );

  // logging peers on groups with their links
  const groupPeerConnections = await prisma.groupPeerConnection.findMany({
    include: {
      peer: true,
      group: true,
    },
  });

  for (const gpc of groupPeerConnections) {
    console.log(
      gpc.link,
      gpc.peer.lastName,
      gpc.peer.firstName,
      'campaignId',
      gpc.group.campaignId,
      'group number',
      gpc.group.number,
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
