import { describe, expect, it } from 'vitest';
import { Prisma } from '../../generated/prisma/client';
import { executePayroll, PayrollEngineError, type PayrollRuleInput } from './engine';

const inputs = {
  contractWage: new Prisma.Decimal('10000'),
  expectedDays: new Prisma.Decimal('20'),
  workedDays: new Prisma.Decimal('19'),
  expectedHours: new Prisma.Decimal('160'),
  workedHours: new Prisma.Decimal('152'),
  unpaidDays: new Prisma.Decimal('1'),
};

function rule(overrides: Partial<PayrollRuleInput> = {}): PayrollRuleInput {
  return {
    salaryRuleId: 1,
    name: 'Standard Allowance',
    code: 'STANDARD_ALLOWANCE',
    category: 'ALLOWANCE',
    sequence: 10,
    method: 'FIXED',
    fixedAmount: new Prisma.Decimal('2000'),
    percentage: null,
    percentageBase: null,
    formula: null,
    isActive: true,
    ...overrides,
  };
}

const amount = (value: Prisma.Decimal) => value.toFixed(2);

describe('executePayroll', () => {
  it('executes a fixed rule', () => {
    const result = executePayroll([rule()], inputs);
    expect(result.lines).toHaveLength(1);
    expect(amount(result.lines[0].amount)).toBe('2000.00');
    expect(amount(result.allowances)).toBe('2000.00');
  });

  it('computes a percentage from an earlier BASIC category', () => {
    const result = executePayroll(
      [
        rule({ salaryRuleId: 1, name: 'Basic', code: 'BASIC', category: 'BASIC', fixedAmount: '5000', sequence: 10 }),
        rule({
          salaryRuleId: 2,
          name: 'HRA',
          code: 'HRA',
          sequence: 20,
          method: 'PERCENTAGE',
          fixedAmount: null,
          percentage: '40',
          percentageBase: 'BASIC',
        }),
      ],
      inputs,
    );
    expect(amount(result.lines[1].amount)).toBe('2000.00');
    expect(amount(result.basic)).toBe('5000.00');
    expect(amount(result.allowances)).toBe('2000.00');
  });

  it('evaluates formulas over inputs, an earlier category, and an earlier rule', () => {
    const result = executePayroll(
      [
        rule({
          salaryRuleId: 1,
          name: 'Basic',
          code: 'BASIC',
          category: 'BASIC',
          sequence: 10,
          method: 'FORMULA',
          fixedAmount: null,
          formula: "round(contractWage * max(0, expectedDays - unpaidDays) / expectedDays, 2)",
        }),
        rule({ salaryRuleId: 2, name: 'Allowance', code: 'ALLOWANCE', sequence: 20, fixedAmount: '100' }),
        rule({
          salaryRuleId: 3,
          name: 'Gross',
          code: 'GROSS',
          category: 'GROSS',
          sequence: 30,
          method: 'FORMULA',
          fixedAmount: null,
          formula: "categories['BASIC'] + rules['ALLOWANCE']",
        }),
      ],
      inputs,
    );
    expect(amount(result.basic)).toBe('9500.00');
    expect(amount(result.gross)).toBe('9600.00');
  });

  it('rejects a rule reference to a later sequence', () => {
    expect(() =>
      executePayroll(
        [
          rule({
            salaryRuleId: 1,
            name: 'Gross',
            code: 'GROSS',
            category: 'GROSS',
            sequence: 10,
            method: 'FORMULA',
            fixedAmount: null,
            formula: "rules['LATER'] + 1",
          }),
          rule({ salaryRuleId: 2, name: 'Later', code: 'LATER', sequence: 20 }),
        ],
        inputs,
      ),
    ).toThrow(/current or later in the sequence/);
  });

  it.each([
    'globalThis.process.exit(1)',
    'contractWage; process.exit(1)',
    "categories['BASIC'].constructor('return 1')()",
    'contractWage = 0',
    '1 // 1',
  ])('rejects hostile or executable syntax: %s', (formula) => {
    expect(() =>
      executePayroll(
        [rule({ method: 'FORMULA', fixedAmount: null, formula })],
        inputs,
      ),
    ).toThrow(PayrollEngineError);
  });

  it('rounds every line half-up to two decimals before later rules use it', () => {
    const result = executePayroll(
      [
        rule({ salaryRuleId: 1, code: 'THIRD', fixedAmount: '1.005', sequence: 10 }),
        rule({
          salaryRuleId: 2,
          name: 'Net',
          code: 'NET',
          category: 'NET',
          sequence: 20,
          method: 'FORMULA',
          fixedAmount: null,
          formula: "rules['THIRD'] * 3",
        }),
      ],
      inputs,
    );
    expect(amount(result.lines[0].amount)).toBe('1.01');
    expect(amount(result.net)).toBe('3.03');
  });

  it('rejects division by zero and non-finite inputs', () => {
    expect(() => executePayroll([rule({ method: 'FORMULA', fixedAmount: null, formula: '1 / 0' })], inputs)).toThrow(
      /Division by zero/,
    );
    expect(() => executePayroll([rule()], { ...inputs, contractWage: Number.POSITIVE_INFINITY })).toThrow(/finite decimal/);
  });
});
