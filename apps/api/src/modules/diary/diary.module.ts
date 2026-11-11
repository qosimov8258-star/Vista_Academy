import { Module } from "@nestjs/common";
import { DiaryController } from "./diary.controller";
import { DiaryDayService } from "./diary-day.service";
import { DiaryService } from "./diary.service";
import { TimetableService } from "./timetable.service";

@Module({
  controllers: [DiaryController],
  providers: [DiaryService, DiaryDayService, TimetableService],
  // Ota-ona kabineti aynan shu kun ko'rinishi va fayl uzatishdan foydalanadi
  exports: [DiaryDayService, TimetableService],
})
export class DiaryModule {}
