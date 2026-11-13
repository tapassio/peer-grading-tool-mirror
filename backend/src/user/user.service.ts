import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { User, Prisma } from '@prisma/client';
import { Md5 } from 'ts-md5';
import { SendgridService } from '../sendgrid/sendgrid.service';
import { throwError } from 'rxjs';
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
   * Creates or updates the local PGT user for an authenticated DocPouch
   * identity. Existing users are matched by DocPouch id first and by e-mail
   * second, so existing campaigns/roles are preserved.
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

    let user = await this.prisma.user.findFirst({
      where: {
        OR: [{ docPouchId: identity._id }, { email: identity.email }],
      },
      include: { roles: true },
    });

    const roleIds = await this.ensureRoles(roleNames);
    const roleConnections = roleIds.map((roleId) => ({ roleId }));

    // Effective e-mail after the upsert. Normally the DocPouch address.
    let effectiveEmail = identity.email;

    if (!user) {
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
    } else {
      // A DocPouch account may change its e-mail. Only update it when the
      // new address is not already used by another local user.
      if (user.email !== identity.email) {
        const conflict = await this.prisma.user.findUnique({
          where: { email: identity.email },
        });
        if (conflict) {
          effectiveEmail = user.email;
        }
      }

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
    }

    return this.getUser(effectiveEmail);
  }

  async getUser(email: string): Promise<any | undefined> {
    let query = await this.prisma.user.findUnique({
      where: {
        email: email,
      },
      include: {
        roles: true,
        campaigns: true,
      },
    });
    if (query) {
      let { roles, ...rest } = query;
      let newRoles = roles.map((role) => role.role);
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
    password: string,
    firstName: string,
    lastName: string,
    company: string | undefined,
  ) {
    const user = await this.prisma.user.create({
      data: {
        email,
        firstName,
        lastName,
        company,
        password: Md5.hashStr(password),
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
  async completeRegistration(userId: number) {
    return this.prisma.user.update({
      where: {
        userId,
      },
      data: {
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
  async createAdmin(data: Prisma.UserCreateInput): Promise<any> {
    // OIDC users have no local password; only hash it when one was provided.
    if (data.password) data.password = Md5.hashStr(data.password);

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
      admin = await this.prisma.user.create({
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
    if (data.password) data.password = Md5.hashStr(data.password);
    let admin;
    try {
      admin = await this.prisma.user.update({
        where: { userId: data.userId },
        data: { ...data },
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
      throwError(() => new Error('error'));
    }
    this.logger.log('admin user ' + data.email + ' updated');
    return admin;
  }

  async updateAdminPW(data: any): Promise<any> {
    this.logger.log('user ' + data.email + ' changed password');
    data.password = Md5.hashStr(data.password);
    const admin = await this.prisma.user.update({
      where: { email: data.email },
      data: { ...data },
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
