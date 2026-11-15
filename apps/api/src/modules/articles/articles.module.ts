import { Module } from "@nestjs/common";
import { ArticlesController, ParentArticlesController } from "./articles.controller";
import { ArticlesService } from "./articles.service";

@Module({
  controllers: [ArticlesController, ParentArticlesController],
  providers: [ArticlesService],
})
export class ArticlesModule {}
