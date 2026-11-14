import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { User, Prisma } from '@prisma/client';
import { hashPassword } from '../auth/password.util';
import { SendgridService } from '../sendgrid/sendgrid.service';
import type { DocPouchIdentity } from '../auth/oidc.service';
/**
 * this service handles requests regarding users
 */
@Injectable()
export class UserService {
  constructor(
    private prisma: PrismaService,
    private sendGridService: SendgridService,
  ) {}

  private readonly logger = new Logger(UserService.name);

  /**
   * Maps a DocPouch identity to the PGT role model.
   *
   * Role source of truth is DocPouch (decision: "DocPouch-Rollen direkt
   * übernehmen"). PGT only knows ADMIN and SUPER, therefore:
   *
   *   superadmin (isAdmin = true) -> SUPER + ADMIN
   *   admin                       -> ADMIN
   *   manager / member            -> no PGT access
   */
  private mapDocPouchRoles(identity: DocPouchIdentity): string[] {
    if (identity.isAdmin || identity.role === 'superadmin') {
      return ['SUPER', 'ADMIN'];
    }
    if (identity.role === 'admin') {
      return ['ADMIN'];
    }
    return [];
  }

  private async ensureRoles(roleNames: string[]): Promise<number[]> {
    const roleIds: number[] = [];

    for (const roleName of roleNames) {
      let role = await this.prisma.role.findFirst({
        where: { role: roleName },
      });

      if (!role) {
        role = await this.prisma.role.create({
          data: { role: roleName },
        });
      }

      roleIds.push(role.roleId);
    }

    return roleIds;
  }

  /**
   * Finds the local user for a DocPouch identity:
   * 1. by DocPouch id (the account was linked before)
   * 2. by e-mail, but ONLY a lecturer account (ADMIN/SUPER) that is not yet
   *    linked to another DocPouch account. This links existing local
   *    lecturers on their first DocPouch login.
   *
   * Never linked by e-mail: accounts already linked to another DocPouch id
   * and pure peer accounts (students). Otherwise a DocPouch account with the
   * same e-mail address could take them over.
   */
  async findUserForDocPouchIdentity(identity: DocPouchIdentity) {
    const byId = await this.prisma.user.findUnique({
      where: { docPouchId: identity._id },
      include: { roles: true },
    });
    if (byId) return byId;

    return this.prisma.user.findFirst({
      where: {
        email: identity.email,
        docPouchId: null,
        roles: { some: { role: { in: ['ADMIN', 'SUPER'] } } },
      },
      include: { roles: true },
    });
  }

  /**
   * Creates or updates the local PGT user for an authenticated DocPouch
   * identity. Existing campaigns are preserved. The roles come from DocPouch;
   * a PEER role of the account (the person is also a student) is kept.
   */
  async upsertOidcUser(identity: DocPouchIdentity): Promise<any> {
    const roleNames = this.mapDocPouchRoles(identity);

    if (roleNames.length === 0) {
      throw new ForbiddenException('PGT_ACCESS_DENIED');
    }

    if (!identity.email) {
      throw new ForbiddenException('DOCPOUCH_EMAIL_REQUIRED');
    }

    const nameParts = (identity.name || identity.email).trim().split(/\s+/);
    const firstName = nameParts.shift() || '';
    const lastName = nameParts.join(' ') || '';

    const user = await this.findUserForDocPouchIdentity(identity);

    // keep the PEER role, it is not managed by DocPouch
    const keepPeer = !!user?.roles.some((r) => r.role === 'PEER');
    const roleIds = await this.ensureRoles(
      keepPeer ? [...roleNames, 'PEER'] : roleNames,
    );
    const roleConnections = roleIds.map((roleId) => ({ roleId }));

    // the e-mail address may already belong to another local account that
    // must not be taken over (see findUserForDocPouchIdentity)
    const emailOwner = await this.prisma.user.findUnique({
      where: { email: identity.email },
    });
    const emailTakenByOther =
      !!emailOwner && emailOwner.userId !== user?.userId;

    if (!user) {
      if (emailTakenByOther) {
        this.logger.warn(
          `DocPouch login refused: e-mail ${identity.email} belongs to another local account`,
        );
        throw new ForbiddenException('DOCPOUCH_EMAIL_IN_USE');
      }
      await this.prisma.user.create({
        data: {
          email: identity.email,
          firstName,
          lastName,
          docPouchId: identity._id,
          authSource: 'oidc',
          roles: { connect: roleConnections },
        },
      });
      return this.getUser(identity.email);
    }

    // A DocPouch account may change its e-mail. Only take over the new
    // address when it is not used by another local account.
    const effectiveEmail = emailTakenByOther ? user.email : identity.email;

    await this.prisma.user.update({
      where: { userId: user.userId },
      data: {
        email: effectiveEmail,
        firstName,
        lastName,
        docPouchId: identity._id,
        authSource: 'oidc',
        roles: { set: roleConnections },
      },
    });

    return this.getUser(effectiveEmail);
  }

  async getUser(email: string): Promise<any | undefined> {
    const query = await this.prisma.user.findUnique({
      where: {
        email: email,
      },
      include: {
        roles: true,
        campaigns: true,
      },
    });
    if (query) {
      const { roles, ...rest } = query;
      const newRoles = roles.map((role) => role.role);
      return {
        roles: newRoles,
        ...rest,
      };
    }
    return undefined;
  }

  async updateUser(params: {
    where: Prisma.UserWhereUniqueInput;
    data: Prisma.UserUpdateInput;
  }): Promise<User> {
    const { where, data } = params;
    return this.prisma.user.update({
      data,
      where,
      include: {
        roles: true,
      },
    });
  }

  /**
   * this function is called when a user tries to register and he didn't already exist
   * @param email
   * @param firstName
   * @param lastName
   * @param company
   * @returns the newly created user
   */
  async registerUser(
    email: string,
    firstName: string,
    lastName: string,
    company: string | undefined,
  ) {
    // no password yet: it is only set after the e-mail was confirmed
    const user = await this.prisma.user.create({
      data: {
        email,
        firstName,
        lastName,
        company,
      },
      select: {
        email: true,
      },
    });

    return this.getUser(user.email);
  }

  async setRegisterTokenOnUser(userId: number, registerToken: string) {
    return await this.prisma.user.update({
      where: {
        userId,
      },
      data: {
        registerToken: registerToken,
      },
      select: {
        email: true,
        firstName: true,
        lastName: true,
        company: true,
      },
    });
  }

  async getUserByRegisterToken(registerToken: string) {
    return this.prisma.user.findUnique({
      where: {
        registerToken,
      },
    });
  }

  /**
   * This function completes the registration process
   * by setting the user registerToken to null and giving him the ADMIN-role
   * @param userId
   * @returns the users email and names
   */
  async completeRegistration(
    userId: number,
    confirmedData: {
      password: string; // already hashed
      firstName: string;
      lastName: string;
      company: string | null;
    },
  ) {
    return this.prisma.user.update({
      where: {
        userId,
      },
      data: {
        password: confirmedData.password,
        firstName: confirmedData.firstName,
        lastName: confirmedData.lastName,
        company: confirmedData.company,
        registerToken: null,
        roles: {
          connect: {
            roleId: 1,
          },
        },
      },
      select: {
        email: true,
        firstName: true,
        lastName: true,
      },
    });
  }

  /**
   * this function is called in the frontend by super users
   * @param where
   * @returns
   */
  async deleteUser(where: Prisma.UserWhereUniqueInput): Promise<User> {
    const existingUser = await this.prisma.user.findUnique({
      where,
      include: {
        peer: true,
        campaigns: {
          include: {
            users: true,
          },
        },
      },
    });

    // if a peer exists for the user, only disconnect their campaigns and admin roles
    if (existingUser.peer) {
      // getting peer role
      const peerRole = await this.prisma.role.findFirst({
        where: {
          role: 'PEER',
        },
      });

      // disconnecting from all roles
      await this.prisma.user.update({
        where,
        data: {
          roles: {
            set: [],
          },
          campaigns: {
            set: [],
          },
        },
      });

      // reconnecting to peer role
      await this.prisma.user.update({
        where,
        data: {
          roles: {
            connect: {
              roleId: peerRole.roleId,
            },
          },
        },
      });

      this.logger.log(
        `tried to delete user ${where.email} that was also a peer. removed roles and campaigns instead.`,
      );
    } else {
      // else delete
      await this.prisma.user.delete({
        where,
      });

      this.logger.log(`user ${where.email} deleted`);
    }

    // lastly check if there are any campaigns that do no longer have a user and delete them
    const deletedCampaigns = await this.prisma.campaign.deleteMany({
      where: {
        users: {
          none: {},
        },
      },
    });

    this.logger.log(
      `number of deleted campaign because of user deletion: ${deletedCampaigns.count}`,
    );

    return existingUser;
  }

  /**
   * this function is called in the frontend by super users
   * @returns
   */
  async getAdmins() {
    const admins = (
      await this.prisma.role.findUnique({
        where: { roleId: 1 },
        select: {
          users: {
            select: {
              userId: true,
              lastName: true,
              firstName: true,
              email: true,
              company: true,
              roles: true,
              campaigns: {
                select: {
                  name: true,
                  creationDate: true,
                  openingDate: true,
                  closingDate: true,
                  language: true,
                  maxPoints: true,
                  allowCommentsForPeers: true,
                  groups: {
                    select: {
                      peers: true,
                      gradings: true,
                    },
                  },
                  criteria: true,
                },
              },
            },
          },
        },
      })
    ).users;
    return admins;
  }

  /**
   * this function is called in the frontend by super users
   * @param data
   * @returns
   */
  async createAdmin(input: Prisma.UserCreateInput): Promise<any> {
    // only take over the allowed fields (protection against mass assignment)
    const data: Prisma.UserCreateInput = {
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      company: input.company,
    };
    // OIDC users have no local password; only hash it when one was provided.
    if (input.password) data.password = await hashPassword(input.password);

    let admin: any = await this.prisma.user.findFirst({
      where: {
        email: data.email,
      },
      include: {
        roles: true,
      },
    });

    // if the user is already an admin, throw an exception
    if (
      admin &&
      admin.roles &&
      admin.roles.find((role) => role.role == 'ADMIN')
    ) {
      throw new InternalServerErrorException('User already exists.');
    }

    // if the user didn't exist, create him
    if (!admin) {
      await this.prisma.user.create({
        data: { ...data },
      });
    }

    // now the user exists but doesn't have the admin role
    // connect the user to the admin role
    admin = await this.prisma.user.update({
      where: {
        email: data.email,
      },
      data: {
        roles: {
          connect: {
            roleId: 1,
          },
        },
        ...data,
      },
      select: {
        userId: true,
        email: true,
        firstName: true,
        lastName: true,
        roles: true,
      },
    });

    await this.sendGridService.adminCreated(admin);

    this.logger.log('admin user ' + data.email + ' created');

    return admin;
  }

  /**
   * this function is called in the frontend by super users
   * @param data
   * @returns
   */
  async updateAdmin(data: User): Promise<any> {
    // only these fields may be changed (protection against mass assignment)
    const changes: Prisma.UserUpdateInput = {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      company: data.company,
    };
    if (data.password) changes.password = await hashPassword(data.password);
    let admin;
    try {
      admin = await this.prisma.user.update({
        where: { userId: data.userId },
        data: changes,
        select: {
          userId: true,
          password: false,
          email: true,
          firstName: true,
          lastName: true,
          roles: true,
        },
      });
    } catch (error) {
      // before, this error was silently ignored
      this.logger.error(
        `updating admin ${data.userId} failed: ${error.message}`,
      );
      throw new InternalServerErrorException('UPDATE_FAILED');
    }
    this.logger.log('admin user ' + data.email + ' updated');
    return admin;
  }

  async updateAdminPW(data: any): Promise<any> {
    this.logger.log('user ' + data.email + ' changed password');
    const admin = await this.prisma.user.update({
      where: { email: data.email },
      // only the password may be changed here
      data: { password: await hashPassword(data.password) },
      select: {
        userId: true,
        password: false,
        email: true,
        firstName: true,
        lastName: true,
        roles: true,
      },
    });

    return admin;
  }

  async getUserById(id: number) {
    return this.prisma.user.findUnique({
      where: {
        userId: id,
      },
      select: {
        firstName: true,
        lastName: true,
        email: true,
        userId: true,
        roles: true,
        company: true,
      },
    });
  }
}
