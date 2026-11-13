import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
/**
 * the campaign guard checks if a campaign belongs to the user requesting it
 * most of the false campaign claims are already caught in the frontend tough
 */
@Injectable()
export class CampaignGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const { user, params, method, body } = context.switchToHttp().getRequest();

    // the campaign id comes from the URL (GET/DELETE) or the body (POST)
    const rawId =
      method === 'GET' || method === 'DELETE' ? params?.id : body?.campaignId;
    const campaignId = Number(rawId);

    if (!user?.email || !Number.isInteger(campaignId) || campaignId <= 0) {
      return false;
    }

    // only allowed if the campaign belongs to the logged in user
    const campaign = await this.prisma.campaign.findFirst({
      where: {
        campaignId,
        users: { some: { email: user.email } },
      },
      select: { campaignId: true },
    });

    // default: deny (every other method or unknown campaign)
    return campaign !== null;
  }
}
