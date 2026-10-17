import { describe, it } from "node:test";
import { expect } from "../helpers/expect";
import { blocking, findScheduleConflicts, overlaps, type ExistingSlot, type PlannedSlot } from "../../src/modules/lesson-schedule/schedule-conflicts";

const existing: ExistingSlot = {
  id: "s1",
  groupId: "g1",
  employeeId: "e1",
  roomId: "r1",
  weekday: "MONDAY",
  startTime: "09:00",
  endTime: "09:45",
  groupName: "Quyoshcha",
  employeeName: "Karimova Dilnoza",
  roomName: "1-xona",
};

const plan = (patch: Partial<PlannedSlot> = {}): PlannedSlot => ({
  groupId: "g2",
  employeeId: "e2",
  roomId: "r2",
  weekdays: ["MONDAY"],
  startTime: "09:30",
  endTime: "10:15",
  ...patch,
});

describe("schedule-conflicts", () => {
  it("yarim ochiq oraliq: tugagan daqiqada boshlansa to'qnashmaydi", () => {
    expect(overlaps(540, 585, 585, 630)).toBe(false);
    expect(overlaps(540, 585, 584, 630)).toBe(true);
    expect(overlaps(600, 620, 590, 630)).toBe(true);
  });

  it("boshqa xona, o'qituvchi va guruh — to'qnashuv yo'q", () => {
    expect(findScheduleConflicts(plan(), [existing])).toEqual([]);
  });

  it("bir xonada bir vaqtda — ROOM", () => {
    const conflicts = findScheduleConflicts(plan({ roomId: "r1" }), [existing]);
    expect(conflicts.map((c) => c.kind)).toEqual(["ROOM"]);
    expect(conflicts[0]).toMatchObject({ weekday: "MONDAY", scheduleId: "s1", startTime: "09:00", endTime: "09:45" });
  });

  it("xonasiz dars xona bo'yicha to'qnashmaydi", () => {
    expect(findScheduleConflicts(plan({ roomId: null }), [{ ...existing, roomId: null }])).toEqual([]);
  });

  it("bir o'qituvchi bir vaqtda — TEACHER, bir guruh — GROUP", () => {
    expect(findScheduleConflicts(plan({ employeeId: "e1" }), [existing]).map((c) => c.kind)).toEqual(["TEACHER"]);
    expect(findScheduleConflicts(plan({ groupId: "g1" }), [existing]).map((c) => c.kind)).toEqual(["GROUP"]);
  });

  it("hammasi bir xil — uch xil to'qnashuv", () => {
    const kinds = findScheduleConflicts(plan({ groupId: "g1", employeeId: "e1", roomId: "r1" }), [existing]).map((c) => c.kind);
    expect(kinds).toEqual(["ROOM", "TEACHER", "GROUP"]);
  });

  it("boshqa kunda yoki boshqa vaqtda — to'qnashmaydi", () => {
    expect(findScheduleConflicts(plan({ roomId: "r1", weekdays: ["TUESDAY"] }), [existing])).toEqual([]);
    expect(findScheduleConflicts(plan({ roomId: "r1", startTime: "09:45", endTime: "10:30" }), [existing])).toEqual([]);
  });

  it("bir nechta kun — faqat to'qnashgan kun qaytadi", () => {
    const conflicts = findScheduleConflicts(plan({ roomId: "r1", weekdays: ["MONDAY", "WEDNESDAY"] }), [existing]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].weekday).toBe("MONDAY");
  });

  it("sig'im oshsa — CAPACITY, lekin saqlashni to'xtatmaydi", () => {
    const conflicts = findScheduleConflicts(plan(), [], { roomName: "2-xona", roomCapacity: 10, groupName: "Yulduzcha", childCount: 14 });
    expect(conflicts.map((c) => c.kind)).toEqual(["CAPACITY"]);
    expect(blocking(conflicts)).toEqual([]);
    expect(findScheduleConflicts(plan(), [], { roomName: "2-xona", roomCapacity: null, groupName: "Yulduzcha", childCount: 40 })).toEqual([]);
  });
});
