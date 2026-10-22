/**
 * 将旧版 SQLite 数据导入 MySQL。
 *
 * 默认 dry-run，只读取并打印统计，不会连接 MySQL：
 *   node prisma/import-sqlite.js
 *
 * 导出为 JSON（便于无公网时在云端一次性任务中导入）：
 *   node prisma/import-sqlite.js --export prisma/data.sqlite.json
 *
 * 真正写入 MySQL（会清空同名目标表，需谨慎）：
 *   node prisma/import-sqlite.js --yes
 *   node prisma/import-sqlite.js --yes --reset-target
 *   node prisma/import-sqlite.js --from-json prisma/data.sqlite.json --yes --reset-target
 */
const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_SOURCE = path.join(__dirname, "dev.db");

/** 依赖顺序：父表在前，子表在后。 */
const TABLES = [
  {
    name: "User",
    model: "user",
    dateFields: ["createdAt"],
    boolFields: ["active"],
  },
  { name: "Teacher", model: "teacher" },
  { name: "SchoolClass", model: "schoolClass" },
  {
    name: "Student",
    model: "student",
    dateFields: ["birthDate", "enrollmentDate", "createdAt"],
  },
  {
    name: "Attendance",
    model: "attendance",
    dateFields: ["updatedAt"],
  },
  {
    name: "LeaveRequest",
    model: "leaveRequest",
    dateFields: ["reviewedAt", "createdAt"],
  },
  { name: "Schedule", model: "schedule" },
  { name: "FeeItem", model: "feeItem", dateFields: ["createdAt"] },
  { name: "Payment", model: "payment", dateFields: ["paidAt"] },
];

function parseArgs(argv) {
  const options = {
    dryRun: true,
    resetTarget: false,
    exportFile: null,
    fromJson: null,
    source: DEFAULT_SOURCE,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--yes") {
      options.dryRun = false;
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--reset-target") {
      options.resetTarget = true;
    } else if (arg === "--export") {
      options.exportFile = argv[(i += 1)];
      if (!options.exportFile) throw new Error("--export 需要文件路径");
    } else if (arg === "--from-json") {
      options.fromJson = argv[(i += 1)];
      if (!options.fromJson) throw new Error("--from-json 需要文件路径");
    } else if (arg === "--source") {
      options.source = argv[(i += 1)];
      if (!options.source) throw new Error("--source 需要文件路径");
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`未知参数：${arg}`);
    }
  }

  if (options.exportFile && options.fromJson) {
    throw new Error("--export 与 --from-json 不能同时使用");
  }
  if (options.resetTarget && options.dryRun) {
    throw new Error("--reset-target 只能与 --yes 一起使用");
  }
  return options;
}

function printHelp() {
  console.log(`用法：
  node prisma/import-sqlite.js [--source prisma/dev.db] [--dry-run]
  node prisma/import-sqlite.js --export <file.json>
  node prisma/import-sqlite.js --from-json <file.json> --yes [--reset-target]

默认 dry-run；--yes 才会写入 DATABASE_URL 指向的 MySQL。`);
}

function readSqlite(source) {
  if (!fs.existsSync(source)) {
    throw new Error(`SQLite 文件不存在：${source}`);
  }

  let DatabaseSync;
  try {
    ({ DatabaseSync } = require("node:sqlite"));
  } catch {
    throw new Error(
      "当前 Node 不支持 node:sqlite，请使用 Node 22.5+（推荐 Node 24）执行本脚本。",
    );
  }

  const db = new DatabaseSync(source, { readOnly: true });
  const tables = {};
  try {
    for (const table of TABLES) {
      const exists = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
        )
        .get(table.name);
      if (!exists) {
        throw new Error(`源库缺少表 ${table.name}`);
      }
      tables[table.name] = db
        .prepare(`SELECT * FROM "${table.name}" ORDER BY id ASC`)
        .all();
    }
  } finally {
    db.close();
  }
  return tables;
}

function toDate(value) {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  // SQLite 中 Prisma DateTime 默认是 epoch 毫秒；也兼容 ISO 字符串。
  if (typeof value === "number") return new Date(value);
  if (typeof value === "bigint") return new Date(Number(value));
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    throw new Error(`无法解析日期：${String(value)}`);
  }
  return date;
}

function toBoolean(value) {
  if (value === null || value === undefined) return null;
  return Boolean(Number(value) || value === true);
}

function convertTables(tables) {
  const result = {};
  for (const table of TABLES) {
    const rows = tables[table.name] || [];
    result[table.name] = rows.map((row) => {
      const next = { ...row };
      for (const field of table.dateFields || []) {
        next[field] = toDate(next[field]);
      }
      for (const field of table.boolFields || []) {
        next[field] = toBoolean(next[field]);
      }
      return next;
    });
  }
  return result;
}

function summarize(tables) {
  console.log("源数据统计：");
  for (const table of TABLES) {
    const rows = tables[table.name] || [];
    const sample = table.dateFields && rows[0]
      ? `，示例日期 ${table.dateFields[0]}=${
          rows[0][table.dateFields[0]] instanceof Date
            ? rows[0][table.dateFields[0]].toISOString()
            : String(rows[0][table.dateFields[0]])
        }`
      : "";
    console.log(`  ${table.name.padEnd(14)} ${rows.length} 行${sample}`);
  }
}

function writeExport(file, tables) {
  const payload = {
    exportedAt: new Date().toISOString(),
    source: "sqlite",
    tables,
  };
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(payload, null, 2));
  console.log(`已导出 JSON：${file}`);
}

function readExport(file) {
  if (!fs.existsSync(file)) throw new Error(`JSON 文件不存在：${file}`);
  const payload = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!payload.tables) throw new Error("JSON 缺少 tables 字段");
  for (const table of TABLES) {
    if (!Array.isArray(payload.tables[table.name])) {
      throw new Error(`JSON 缺少表 ${table.name}`);
    }
  }
  return payload.tables;
}

async function importToMysql(tables, options) {
  const databaseUrl = process.env.DATABASE_URL || "";
  if (!databaseUrl.startsWith("mysql://")) {
    throw new Error(
      "DATABASE_URL 不是 mysql:// 连接串，拒绝写入。请先配置 MySQL 连接。",
    );
  }
  if (!options.resetTarget) {
    throw new Error("目标库可能已有数据；确认清空请加 --reset-target");
  }

  const { PrismaClient } = require("@prisma/client");
  const prisma = new PrismaClient();

  try {
    console.log("\n清空目标表（逆依赖顺序）...");
    for (const table of [...TABLES].reverse()) {
      await prisma[table.model].deleteMany();
    }

    console.log("开始导入...");
    for (const table of TABLES) {
      const rows = tables[table.name] || [];
      if (!rows.length) {
        console.log(`  ${table.name} 跳过（0 行）`);
        continue;
      }
      const result = await prisma[table.model].createMany({ data: rows });
      console.log(`  ${table.name} 已导入 ${result.count} 行`);
    }

    console.log("\n校验行数与最大 ID...");
    let failed = false;
    for (const table of TABLES) {
      const rows = tables[table.name] || [];
      const expected = rows.length;
      const actual = await prisma[table.model].count();
      const expectedMax = rows.reduce((max, row) => Math.max(max, row.id || 0), 0);
      const aggregate = await prisma[table.model].aggregate({ _max: { id: true } });
      const actualMax = aggregate._max.id || 0;
      const ok = expected === actual && expectedMax === actualMax;
      if (!ok) failed = true;
      console.log(
        `  ${table.name.padEnd(14)} 行 ${expected}/${actual}，最大 ID ${expectedMax}/${actualMax} ${ok ? "OK" : "FAIL"}`,
      );
    }

    if (failed) throw new Error("导入后行数不一致");
    console.log("\n导入完成。");
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  const rawTables = options.fromJson
    ? readExport(options.fromJson)
    : readSqlite(options.source);
  const tables = convertTables(rawTables);

  summarize(tables);

  if (options.exportFile) {
    writeExport(options.exportFile, tables);
    return;
  }

  if (options.dryRun) {
    console.log("\n这是 dry-run，未写入 MySQL。");
    console.log("确认后执行：node prisma/import-sqlite.js --yes --reset-target");
    return;
  }

  await importToMysql(tables, options);
}

main().catch((error) => {
  console.error(`\n导入失败：${error.message}`);
  process.exit(1);
});
