import { Module } from "@nestjs/common";
import { ArticleFeedbackService } from "./article-feedback.service";
import { ArticlesController, ParentArticlesController } from "./articles.controller";
import { ArticlesService } from "./articles.service";

@Module({
  controllers: [ArticlesController, ParentArticlesController],
  providers: [ArticlesService, ArticleFeedbackService],
})
export class ArticlesModule {}
