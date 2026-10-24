-- CreateTable
CREATE TABLE `DiaryEntry` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `studentId` INTEGER NOT NULL,
    `date` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NULL,
    `content` TEXT NOT NULL,
    `mood` ENUM('HAPPY', 'FOCUSED', 'ENERGETIC', 'CALM', 'NEEDS_ATTENTION') NULL,
    `authorId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `DiaryEntry_studentId_date_idx`(`studentId`, `date`),
    INDEX `DiaryEntry_date_idx`(`date`),
    INDEX `DiaryEntry_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DiaryPhoto` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `entryId` INTEGER NOT NULL,
    `data` MEDIUMBLOB NOT NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `size` INTEGER NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `DiaryPhoto_entryId_sortOrder_idx`(`entryId`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `DiaryEntry` ADD CONSTRAINT `DiaryEntry_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `Student`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DiaryEntry` ADD CONSTRAINT `DiaryEntry_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DiaryPhoto` ADD CONSTRAINT `DiaryPhoto_entryId_fkey` FOREIGN KEY (`entryId`) REFERENCES `DiaryEntry`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
