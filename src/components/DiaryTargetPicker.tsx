"use client";

import { useState } from "react";

export type DiaryTargetType = "CHILD" | "CLASS";

type StudentOption = { id: number; name: string; className: string | null };
type ClassOption = { id: number; name: string };

export function DiaryTargetPicker({
  students,
  classes,
  defaultType = "CHILD",
  defaultStudentId,
  defaultClassId,
}: {
  students: StudentOption[];
  classes: ClassOption[];
  defaultType?: DiaryTargetType;
  defaultStudentId?: number;
  defaultClassId?: number;
}) {
  const hasStudents = students.length > 0;
  const hasClasses = classes.length > 0;

  const [type, setType] = useState<DiaryTargetType>(() => {
    if (defaultType === "CHILD" && hasStudents) return "CHILD";
    if (defaultType === "CLASS" && hasClasses) return "CLASS";
    return hasStudents ? "CHILD" : "CLASS";
  });
  const [studentId, setStudentId] = useState<number | undefined>(
    defaultStudentId ?? students[0]?.id,
  );
  const [classId, setClassId] = useState<number | undefined>(
    defaultClassId ?? classes[0]?.id,
  );

  return (
    <div className="target-picker span-2">
      <div className="target-tabs">
        <button
          type="button"
          className={`btn btn-sm ${type === "CHILD" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setType("CHILD")}
          disabled={!hasStudents}
        >
          某个幼儿
        </button>
        <button
          type="button"
          className={`btn btn-sm ${type === "CLASS" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setType("CLASS")}
          disabled={!hasClasses}
        >
          整个班级
        </button>
      </div>

      {type === "CHILD" ? (
        <label className="field">
          <span>幼儿 *</span>
          <select
            name="studentId"
            required
            value={studentId ?? ""}
            onChange={(event) => setStudentId(Number(event.target.value))}
          >
            {students.map((student) => (
              <option key={student.id} value={student.id}>
                {student.name}
                {student.className ? ` · ${student.className}` : ""}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <label className="field">
          <span>班级 *</span>
          <select
            name="classId"
            required
            value={classId ?? ""}
            onChange={(event) => setClassId(Number(event.target.value))}
          >
            {classes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
