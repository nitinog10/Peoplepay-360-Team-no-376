-- Phase 3 provisional payroll schema. See docs/phase-3-plan.md.

-- AlterEnum
ALTER TABLE `roles`
    MODIFY `role_name` ENUM('EMPLOYEE', 'HR_MANAGER', 'HR_PAYROLL_USER', 'HR_PAYROLL_MANAGER', 'ADMIN') NOT NULL;

-- CreateTable
CREATE TABLE `salary_structures` (
    `salary_structure_id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(120) NOT NULL,
    `description` TEXT NULL,
    `currency` CHAR(3) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `salary_structures_name_key`(`name`),
    PRIMARY KEY (`salary_structure_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `salary_rules` (
    `salary_rule_id` INTEGER NOT NULL AUTO_INCREMENT,
    `salary_structure_id` INTEGER NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `code` VARCHAR(50) NOT NULL,
    `category` ENUM('BASIC', 'ALLOWANCE', 'GROSS', 'DEDUCTION', 'NET') NOT NULL,
    `sequence` INTEGER NOT NULL,
    `method` ENUM('FIXED', 'PERCENTAGE', 'FORMULA') NOT NULL,
    `fixed_amount` DECIMAL(12, 2) NULL,
    `percentage` DECIMAL(7, 4) NULL,
    `percentage_base` ENUM('CONTRACT_WAGE', 'BASIC', 'GROSS') NULL,
    `formula` TEXT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `salary_rules_code_key`(`code`),
    UNIQUE INDEX `uq_salary_rules_structure_sequence`(`salary_structure_id`, `sequence`),
    INDEX `idx_salary_rules_structure_active`(`salary_structure_id`, `is_active`),
    INDEX `idx_salary_rules_category`(`category`),
    PRIMARY KEY (`salary_rule_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `employee_bank_details` (
    `employee_bank_detail_id` INTEGER NOT NULL AUTO_INCREMENT,
    `employee_id` INTEGER NOT NULL,
    `account_holder_name` VARCHAR(150) NOT NULL,
    `bank_name` VARCHAR(150) NOT NULL,
    `account_number` VARCHAR(64) NOT NULL,
    `routing_code` VARCHAR(64) NOT NULL,
    `branch_name` VARCHAR(150) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `employee_bank_details_employee_id_key`(`employee_id`),
    PRIMARY KEY (`employee_bank_detail_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payruns` (
    `payrun_id` INTEGER NOT NULL AUTO_INCREMENT,
    `salary_structure_id` INTEGER NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `period_start` DATE NOT NULL,
    `period_end` DATE NOT NULL,
    `currency` CHAR(3) NOT NULL,
    `status` ENUM('DRAFT', 'COMPUTED', 'VALIDATED', 'PAID', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `created_by` INTEGER NOT NULL,
    `computed_at` DATETIME(3) NULL,
    `validated_by` INTEGER NULL,
    `validated_at` DATETIME(3) NULL,
    `paid_by` INTEGER NULL,
    `paid_at` DATETIME(3) NULL,
    `cancelled_by` INTEGER NULL,
    `cancelled_at` DATETIME(3) NULL,
    `cancel_reason` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_payruns_status_period`(`status`, `period_start`, `period_end`),
    INDEX `idx_payruns_structure`(`salary_structure_id`),
    INDEX `idx_payruns_created_by`(`created_by`),
    INDEX `idx_payruns_validated_by`(`validated_by`),
    INDEX `idx_payruns_paid_by`(`paid_by`),
    INDEX `idx_payruns_cancelled_by`(`cancelled_by`),
    PRIMARY KEY (`payrun_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payslips` (
    `payslip_id` INTEGER NOT NULL AUTO_INCREMENT,
    `payrun_id` INTEGER NOT NULL,
    `employee_id` INTEGER NOT NULL,
    `contract_id` INTEGER NOT NULL,
    `contract_wage` DECIMAL(12, 2) NOT NULL,
    `currency` CHAR(3) NOT NULL,
    `expected_days` DECIMAL(7, 2) NOT NULL DEFAULT 0,
    `worked_days` DECIMAL(7, 2) NOT NULL DEFAULT 0,
    `unpaid_days` DECIMAL(7, 2) NOT NULL DEFAULT 0,
    `expected_hours` DECIMAL(9, 2) NOT NULL DEFAULT 0,
    `worked_hours` DECIMAL(9, 2) NOT NULL DEFAULT 0,
    `basic` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `allowances` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `gross` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `deductions` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `net` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `computed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `uq_payslips_payrun_employee`(`payrun_id`, `employee_id`),
    INDEX `idx_payslips_employee`(`employee_id`),
    INDEX `idx_payslips_contract`(`contract_id`),
    INDEX `idx_payslips_computed_at`(`computed_at`),
    PRIMARY KEY (`payslip_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payslip_lines` (
    `payslip_line_id` INTEGER NOT NULL AUTO_INCREMENT,
    `payslip_id` INTEGER NOT NULL,
    `salary_rule_id` INTEGER NOT NULL,
    `rule_name` VARCHAR(120) NOT NULL,
    `rule_code` VARCHAR(50) NOT NULL,
    `category` ENUM('BASIC', 'ALLOWANCE', 'GROSS', 'DEDUCTION', 'NET') NOT NULL,
    `sequence` INTEGER NOT NULL,
    `method` ENUM('FIXED', 'PERCENTAGE', 'FORMULA') NOT NULL,
    `fixed_amount` DECIMAL(12, 2) NULL,
    `percentage` DECIMAL(7, 4) NULL,
    `percentage_base` ENUM('CONTRACT_WAGE', 'BASIC', 'GROSS') NULL,
    `formula` TEXT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `uq_payslip_lines_payslip_sequence`(`payslip_id`, `sequence`),
    UNIQUE INDEX `uq_payslip_lines_payslip_rule`(`payslip_id`, `salary_rule_id`),
    INDEX `idx_payslip_lines_rule`(`salary_rule_id`),
    INDEX `idx_payslip_lines_payslip_category`(`payslip_id`, `category`),
    PRIMARY KEY (`payslip_line_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `salary_rules` ADD CONSTRAINT `salary_rules_salary_structure_id_fkey` FOREIGN KEY (`salary_structure_id`) REFERENCES `salary_structures`(`salary_structure_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_bank_details` ADD CONSTRAINT `employee_bank_details_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`employee_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payruns` ADD CONSTRAINT `payruns_salary_structure_id_fkey` FOREIGN KEY (`salary_structure_id`) REFERENCES `salary_structures`(`salary_structure_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payruns` ADD CONSTRAINT `payruns_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `employees`(`employee_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payruns` ADD CONSTRAINT `payruns_validated_by_fkey` FOREIGN KEY (`validated_by`) REFERENCES `employees`(`employee_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payruns` ADD CONSTRAINT `payruns_paid_by_fkey` FOREIGN KEY (`paid_by`) REFERENCES `employees`(`employee_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payruns` ADD CONSTRAINT `payruns_cancelled_by_fkey` FOREIGN KEY (`cancelled_by`) REFERENCES `employees`(`employee_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payslips` ADD CONSTRAINT `payslips_payrun_id_fkey` FOREIGN KEY (`payrun_id`) REFERENCES `payruns`(`payrun_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payslips` ADD CONSTRAINT `payslips_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`employee_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payslips` ADD CONSTRAINT `payslips_contract_id_fkey` FOREIGN KEY (`contract_id`) REFERENCES `contracts`(`contract_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payslip_lines` ADD CONSTRAINT `payslip_lines_payslip_id_fkey` FOREIGN KEY (`payslip_id`) REFERENCES `payslips`(`payslip_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payslip_lines` ADD CONSTRAINT `payslip_lines_salary_rule_id_fkey` FOREIGN KEY (`salary_rule_id`) REFERENCES `salary_rules`(`salary_rule_id`) ON DELETE RESTRICT ON UPDATE CASCADE;
