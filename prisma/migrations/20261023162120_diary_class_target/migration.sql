-- AlterTable
ALTER TABLE `DiaryEntry` ADD COLUMN `classId` INTEGER NULL,
    MODIFY `studentId` INTEGER NULL;

-- CreateIndex
CREATE INDEX `DiaryEntry_classId_date_idx` ON `DiaryEntry`(`classId`, `date`);

-- AddForeignKey
ALTER TABLE `DiaryEntry` ADD CONSTRAINT `DiaryEntry_classId_fkey` FOREIGN KEY (`classId`) REFERENCES `SchoolClass`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
