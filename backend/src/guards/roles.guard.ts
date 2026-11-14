import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserService } from '../user/user.service';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private userService: UserService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.get<string[]>(
      ROLES_KEY,
      context.getHandler(),
    );
    if (!requiredRoles) {
      return true;
    }
    const user = await this.userService.getUser(
      context.switchToHttp().getRequest().user.email,
    );
    return requiredRoles.some((role) => user.roles?.includes(role));
  }
}
