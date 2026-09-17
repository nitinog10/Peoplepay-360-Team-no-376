import re
import sys

def convert_to_sqlite(schema_path):
    with open(schema_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Change provider
    content = re.sub(r'provider\s*=\s*"mysql"', 'provider = "sqlite"', content)

    # 2. Remove Enums Definitions
    content = re.sub(r'enum\s+\w+\s*\{[^}]*\}\s*', '', content)

    # 3. Strip @db.* directives
    content = re.sub(r'@db\.\w+(?:\([^)]*\))?', '', content)

    # 4. Replace enum usages with String (or specific enums manually)
    enums = [
        "RoleName", "EmployeeStatus", "ContractType", "ContractStatus",
        "AttendanceStatus", "AttendanceEntryType", "AttendanceSource",
        "TimeOffStatus", "ApprovalDecision", "SalaryRuleCategory",
        "SalaryRuleMethod", "SalaryRuleBase", "PayrunStatus"
    ]
    for enum in enums:
        content = re.sub(rf'\b{enum}\b', 'String', content)

    # 5. Fix default enum values: @default(ACTIVE) -> @default("ACTIVE")
    # Find all @default(SOMETHING) where SOMETHING is ALL_CAPS
    content = re.sub(r'@default\(([A-Z0-9_]+)\)', r'@default("\1")', content)

    # 6. Change Json to String
    content = re.sub(r'\bJson\b', 'String', content)

    # 7. SQLite doesn't support @db.Decimal, wait, we stripped @db.* but we need to ensure Decimal stays Decimal or becomes Float.
    # Prisma SQLite supports Decimal. So we can leave it as Decimal.
    
    with open(schema_path, 'w', encoding='utf-8') as f:
        f.write(content)

    print("Schema successfully converted to SQLite.")

if __name__ == '__main__':
    convert_to_sqlite('prisma/schema.prisma')
