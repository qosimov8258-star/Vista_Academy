import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";
import { ParentJwtAuthGuard } from "./guards/parent-jwt-auth.guard";
import { CurrentParent } from "./decorators/current-parent.decorator";
import { AuthenticatedParent } from "./parent-auth.types";
import { ParentUsefulService } from "./parent-useful.service";

/**
 * Ota-ona kabinetidagi "Foydali" bo'limi (she'r/maqol/ertak) — faqat o'qish.
 * Tarbiyachi tomoni: `UsefulController` (`/app/useful/*`).
 */
@ApiTags("Parent Useful Content")
@Public()
@UseGuards(ParentJwtAuthGuard)
@Controller("app/parent/useful")
export class ParentUsefulController {
  constructor(private readonly parentUsefulService: ParentUsefulService) {}

  @Get("poems")
  poems(@CurrentParent() parent: AuthenticatedParent) {
    return this.parentUsefulService.poems(parent);
  }

  @Get("poems/:id")
  poem(@CurrentParent() parent: AuthenticatedParent, @Param("id") id: string) {
    return this.parentUsefulService.poem(parent, id);
  }

  @Get("proverbs")
  proverbs(@CurrentParent() parent: AuthenticatedParent) {
    return this.parentUsefulService.proverbs(parent);
  }

  @Get("tales")
  tales(@CurrentParent() parent: AuthenticatedParent) {
    return this.parentUsefulService.tales(parent);
  }

  @Get("tales/:id")
  tale(@CurrentParent() parent: AuthenticatedParent, @Param("id") id: string) {
    return this.parentUsefulService.tale(parent, id);
  }
}
