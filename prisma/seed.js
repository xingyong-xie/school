const { PrismaClient } = require("@prisma/client");
const crypto = require("node:crypto");

const prisma = new PrismaClient();

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function dateStr(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function addDays(base, days) {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
}

async function main() {
  await prisma.diaryPhoto.deleteMany();
  await prisma.diaryEntry.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.feeItem.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.leaveRequest.deleteMany();
  await prisma.schedule.deleteMany();
  await prisma.student.deleteMany();
  await prisma.schoolClass.deleteMany();
  await prisma.teacher.deleteMany();
  await prisma.user.deleteMany();

  const admin = await prisma.user.create({
    data: {
      username: "admin",
      name: "园务管理员",
      role: "ADMIN",
      phone: "13900000000",
      passwordHash: hashPassword("admin123"),
    },
  });

  const teacherAccounts = await Promise.all(
    [
      { username: "t001", name: "王雅琴", phone: "13900000001" },
      { username: "t002", name: "李思远", phone: "13900000002" },
      { username: "t003", name: "陈晓萌", phone: "13900000003" },
    ].map((item) =>
      prisma.user.create({
        data: {
          ...item,
          role: "TEACHER",
          passwordHash: hashPassword("teacher123"),
        },
      }),
    ),
  );

  const parentAccounts = await Promise.all(
    [
      { username: "p001", name: "张明", phone: "13800000001" },
      { username: "p002", name: "刘芳", phone: "13800000002" },
      { username: "p003", name: "周静", phone: "13800000003" },
      { username: "p004", name: "吴强", phone: "13800000004" },
      { username: "p005", name: "孙丽", phone: "13800000005" },
      { username: "p006", name: "郑磊", phone: "13800000006" },
    ].map((item) =>
      prisma.user.create({
        data: {
          ...item,
          role: "PARENT",
          passwordHash: hashPassword("parent123"),
        },
      }),
    ),
  );

  const teachers = await Promise.all([
    prisma.teacher.create({
      data: {
        employeeNo: "T001",
        specialty: "学前教育",
        phone: "13900000001",
        userId: teacherAccounts[0].id,
      },
    }),
    prisma.teacher.create({
      data: {
        employeeNo: "T002",
        specialty: "音乐律动",
        phone: "13900000002",
        userId: teacherAccounts[1].id,
      },
    }),
    prisma.teacher.create({
      data: {
        employeeNo: "T003",
        specialty: "美术手工",
        phone: "13900000003",
        userId: teacherAccounts[2].id,
      },
    }),
  ]);

  const classes = await Promise.all([
    prisma.schoolClass.create({
      data: {
        name: "小班·向日葵班",
        ageGroup: "小班（3-4岁）",
        capacity: 20,
        room: "A101",
        teacherId: teachers[0].id,
      },
    }),
    prisma.schoolClass.create({
      data: {
        name: "中班·彩虹班",
        ageGroup: "中班（4-5岁）",
        capacity: 24,
        room: "A201",
        teacherId: teachers[1].id,
      },
    }),
    prisma.schoolClass.create({
      data: {
        name: "大班·星辰班",
        ageGroup: "大班（5-6岁）",
        capacity: 24,
        room: "A301",
        teacherId: teachers[2].id,
      },
    }),
  ]);

  const studentSpecs = [
    ["2026001", "张一诺", "FEMALE", "2022-03-12", 0, 0],
    ["2026002", "李沐阳", "MALE", "2022-06-08", 0, 1],
    ["2026003", "王可心", "FEMALE", "2022-01-20", 0, 2],
    ["2026004", "周子墨", "MALE", "2022-09-03", 0, 3],
    ["2026005", "刘安然", "FEMALE", "2021-05-18", 1, 1],
    ["2026006", "陈嘉树", "MALE", "2021-08-22", 1, 3],
    ["2026007", "吴念", "FEMALE", "2021-02-14", 1, 4],
    ["2026008", "郑小满", "MALE", "2021-11-30", 1, 5],
    ["2026009", "孙乐天", "MALE", "2020-04-09", 2, 4],
    ["2026010", "赵一诺", "FEMALE", "2020-07-16", 2, 0],
    ["2026011", "钱多多", "MALE", "2020-10-25", 2, 2],
    ["2026012", "冯知夏", "FEMALE", "2020-12-05", 2, 5],
  ];

  const students = [];
  for (const [studentNo, name, gender, birthDate, classIndex, parentIndex] of studentSpecs) {
    students.push(
      await prisma.student.create({
        data: {
          studentNo,
          name,
          gender,
          birthDate: new Date(`${birthDate}T00:00:00.000Z`),
          enrollmentDate: new Date("2026-09-01T00:00:00.000Z"),
          classId: classes[classIndex].id,
          parentId: parentAccounts[parentIndex].id,
          phone: parentAccounts[parentIndex].phone,
          address: "阳光路 88 号",
          notes: gender === "FEMALE" ? "对花粉轻微过敏" : null,
        },
      }),
    );
  }

  // 最近 10 个上课日（含今天，便于工作台展示）
  const today = new Date();
  const attendanceDates = [];
  for (let i = 0; i < 14 && attendanceDates.length < 10; i += 1) {
    const day = addDays(today, -i);
    if (i === 0 || (day.getDay() !== 0 && day.getDay() !== 6)) {
      attendanceDates.push(dateStr(day));
    }
  }

  const pattern = [
    "PRESENT",
    "PRESENT",
    "PRESENT",
    "LATE",
    "PRESENT",
    "SICK",
    "PRESENT",
    "PRESENT",
    "PERSONAL",
    "PRESENT",
    "ABSENT",
  ];

  for (let s = 0; s < students.length; s += 1) {
    const student = students[s];
    const classIndex = studentSpecs[s][4];
    for (let d = 0; d < attendanceDates.length; d += 1) {
      const status = d === 0 ? "PRESENT" : pattern[(s * 3 + d) % pattern.length];
      const note =
        status === "SICK"
          ? "家长已请假"
          : status === "PERSONAL"
            ? "家庭事务"
            : status === "LATE"
              ? "迟到 10 分钟"
              : null;
      await prisma.attendance.create({
        data: {
          studentId: student.id,
          date: attendanceDates[d],
          status,
          note,
          recordedById: teacherAccounts[classIndex].id,
        },
      });
    }
  }

  const subjects = [
    ["语言表达", "户外活动", "区域游戏", "绘本阅读"],
    ["趣味数学", "音乐律动", "创意手工", "分享会"],
    ["科学探索", "体能游戏", "建构游戏", "舞蹈"],
    ["社会交往", "美术创作", "角色扮演", "健康课堂"],
    ["艺术畅想", "阅读时光", "科学小实验", "音乐欣赏"],
  ];
  const times = [
    ["08:30", "09:10"],
    ["09:30", "10:10"],
    ["10:30", "11:10"],
    ["14:30", "15:10"],
  ];
  const classTeacherNames = ["王雅琴", "李思远", "陈晓萌"];

  for (let c = 0; c < classes.length; c += 1) {
    for (let weekday = 1; weekday <= 5; weekday += 1) {
      for (let p = 0; p < times.length; p += 1) {
        await prisma.schedule.create({
          data: {
            classId: classes[c].id,
            weekday,
            startTime: times[p][0],
            endTime: times[p][1],
            subject: subjects[weekday - 1][p],
            teacherName:
              p === 1 && weekday === 2 ? "李思远" : classTeacherNames[c],
          },
        });
      }
    }
  }

  const feeItems = await Promise.all([
    prisma.feeItem.create({
      data: {
        name: "2026 秋季保教费",
        term: "2026 秋季学期",
        amountCents: 480000,
        dueDate: "2026-09-10",
        description: "本学期保育教育费，按学期收取。",
      },
    }),
    prisma.feeItem.create({
      data: {
        name: "2026 秋季伙食费",
        term: "2026 秋季学期",
        amountCents: 150000,
        dueDate: "2026-09-10",
        description: "含每日两餐两点。",
      },
    }),
    prisma.feeItem.create({
      data: {
        name: "秋季园服费",
        term: "2026 秋季学期",
        amountCents: 32000,
        dueDate: "2026-09-30",
        description: "运动服一套、礼服一套。",
      },
    }),
    prisma.feeItem.create({
      data: {
        name: "秋游活动费",
        term: "2026 秋季学期",
        amountCents: 18000,
        dueDate: dateStr(addDays(today, 10)),
        description: "包含交通、门票与保险。",
      },
    }),
  ]);

  const payMonth = addDays(today, -21);
  for (let s = 0; s < students.length; s += 1) {
    const student = students[s];
    const payments = [];

    payments.push({
      feeItemId: feeItems[0].id,
      amountCents: s % 5 === 0 ? 300000 : 480000,
      method: s % 2 === 0 ? "TRANSFER" : "WECHAT",
    });
    if (s % 4 !== 0) {
      payments.push({
        feeItemId: feeItems[1].id,
        amountCents: 150000,
        method: "WECHAT",
      });
    }
    if (s % 3 !== 0) {
      payments.push({
        feeItemId: feeItems[2].id,
        amountCents: 32000,
        method: "ALIPAY",
      });
    }
    if (s < 3) {
      payments.push({
        feeItemId: feeItems[3].id,
        amountCents: 18000,
        method: "CASH",
      });
    }

    for (let p = 0; p < payments.length; p += 1) {
      await prisma.payment.create({
        data: {
          studentId: student.id,
          feeItemId: payments[p].feeItemId,
          amountCents: payments[p].amountCents,
          method: payments[p].method,
          paidAt: addDays(payMonth, p * 3 + (s % 4)),
          note: s % 5 === 0 ? "分期支付首款" : null,
          recordedById: admin.id,
        },
      });
    }
  }

  await prisma.leaveRequest.createMany({
    data: [
      {
        studentId: students[1].id,
        type: "SICK",
        startDate: dateStr(addDays(today, 2)),
        endDate: dateStr(addDays(today, 3)),
        reason: "孩子发烧咳嗽，需居家休息观察。",
        status: "PENDING",
        requestedById: parentAccounts[1].id,
      },
      {
        studentId: students[3].id,
        type: "PERSONAL",
        startDate: dateStr(addDays(today, 5)),
        endDate: dateStr(addDays(today, 5)),
        reason: "需陪同孩子参加家庭活动。",
        status: "PENDING",
        requestedById: parentAccounts[3].id,
      },
      {
        studentId: students[5].id,
        type: "PERSONAL",
        startDate: dateStr(addDays(today, -2)),
        endDate: dateStr(addDays(today, -2)),
        reason: "家中有事，请假一天。",
        status: "APPROVED",
        requestedById: parentAccounts[3].id,
        reviewedById: teacherAccounts[1].id,
        reviewedAt: addDays(today, -3),
        reviewNote: "已批准，请留意班级群通知。",
      },
      {
        studentId: students[9].id,
        type: "SICK",
        startDate: dateStr(addDays(today, -6)),
        endDate: dateStr(addDays(today, -5)),
        reason: "肠胃不适，医生建议休息两天。",
        status: "APPROVED",
        requestedById: parentAccounts[0].id,
        reviewedById: teacherAccounts[2].id,
        reviewedAt: addDays(today, -7),
      },
    ],
  });

  const diarySpecs = [
    {
      studentIndex: 0,
      daysAgo: 1,
      title: "第一次独立完成拼图",
      content:
        "今天区域活动时，一诺自己完成了 24 块拼图，过程中很专注，遇到困难也没有放弃，完成后开心地和同伴分享。",
      mood: "FOCUSED",
    },
    {
      studentIndex: 0,
      daysAgo: 4,
      title: "户外游戏的小帮手",
      content:
        "户外活动结束后，主动帮老师把小球一个个送回筐里，还提醒同伴排队，是老师的小帮手。",
      mood: "HAPPY",
    },
    {
      studentIndex: 1,
      daysAgo: 2,
      title: "午餐进步啦",
      content:
        "沐阳今天把蔬菜全部吃完了，虽然一开始有点犹豫，在老师的鼓励下尝试后说“还挺好吃的”。",
      mood: "ENERGETIC",
    },
    {
      studentIndex: 4,
      daysAgo: 3,
      title: "绘本分享时间",
      content:
        "安然在绘本分享环节给小朋友讲了《好饿的毛毛虫》，声音响亮，还能准确说出毛毛虫每天吃的食物。",
      mood: "HAPPY",
    },
    {
      studentIndex: 8,
      daysAgo: 5,
      title: "需要多一点耐心",
      content:
        "今天和同伴因为积木发生了小争执，情绪有点激动。老师单独沟通后，乐天已经愿意尝试用语言表达自己的想法。",
      mood: "NEEDS_ATTENTION",
    },
    {
      studentIndex: 8,
      daysAgo: 8,
      title: "午睡后的安静时光",
      content: "午睡起床后自己整理好被褥，安静地看了一会儿绘本，情绪平稳。",
      mood: null,
    },
    {
      classIndex: 0,
      daysAgo: 2,
      title: "秋日自然探索",
      content:
        "全班一起到后花园寻找秋天的颜色，孩子们收集了落叶和果实，回到教室后做成了拼贴画，每个人都介绍了自己的作品。",
      mood: "ENERGETIC",
    },
    {
      classIndex: 1,
      daysAgo: 6,
      title: "亲子运动会报名",
      content:
        "本周六上午将举行秋季亲子运动会，项目包括接力跑、袋鼠跳和亲子运球，请家长提前在班级群报名并准备运动鞋。",
      mood: null,
    },
  ];

  await prisma.diaryEntry.createMany({
    data: diarySpecs.map((item) => {
      const isClassEntry = item.classIndex !== undefined;
      const classIndex = isClassEntry
        ? item.classIndex
        : studentSpecs[item.studentIndex][4];
      return {
        studentId: isClassEntry ? null : students[item.studentIndex].id,
        classId: isClassEntry ? classes[classIndex].id : null,
        date: dateStr(addDays(today, -item.daysAgo)),
        title: item.title,
        content: item.content,
        mood: item.mood,
        authorId: teacherAccounts[classIndex].id,
      };
    }),
  });

  console.log("演示数据已写入。");
  console.log("管理员：admin / admin123");
  console.log("教师：t001、t002、t003 / teacher123");
  console.log("家长：p001～p006 / parent123");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
