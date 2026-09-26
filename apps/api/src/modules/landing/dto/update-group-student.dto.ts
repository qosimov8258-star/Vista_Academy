import { PartialType } from "@nestjs/swagger";
import { CreateGroupStudentDto } from "./create-group-student.dto";

export class UpdateGroupStudentDto extends PartialType(CreateGroupStudentDto) {}
