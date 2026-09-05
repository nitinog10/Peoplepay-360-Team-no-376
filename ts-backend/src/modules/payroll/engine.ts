import { Prisma } from '../../generated/prisma/client';
import type { SalaryRuleBase, SalaryRuleCategory, SalaryRuleMethod } from '../../generated/prisma/enums';

export type DecimalInput = Prisma.Decimal | number | string;

export interface PayrollInputs {
  contractWage: DecimalInput;
  expectedDays: DecimalInput;
  workedDays: DecimalInput;
  expectedHours: DecimalInput;
  workedHours: DecimalInput;
  unpaidDays: DecimalInput;
}

export interface PayrollRuleInput {
  salaryRuleId: number;
  name: string;
  code: string;
  category: SalaryRuleCategory;
  sequence: number;
  method: SalaryRuleMethod;
  fixedAmount: DecimalInput | null;
  percentage: DecimalInput | null;
  percentageBase: SalaryRuleBase | null;
  formula: string | null;
  isActive: boolean;
}

export interface PayrollLineResult {
  salaryRuleId: number;
  ruleName: string;
  ruleCode: string;
  category: SalaryRuleCategory;
  sequence: number;
  method: SalaryRuleMethod;
  fixedAmount: Prisma.Decimal | null;
  percentage: Prisma.Decimal | null;
  percentageBase: SalaryRuleBase | null;
  formula: string | null;
  amount: Prisma.Decimal;
}

export interface PayrollResult {
  lines: PayrollLineResult[];
  categories: Record<SalaryRuleCategory, Prisma.Decimal>;
  basic: Prisma.Decimal;
  allowances: Prisma.Decimal;
  gross: Prisma.Decimal;
  deductions: Prisma.Decimal;
  net: Prisma.Decimal;
}

export class PayrollEngineError extends Error {
  constructor(message: string, readonly ruleCode?: string) {
    super(ruleCode ? `Rule ${ruleCode}: ${message}` : message);
    this.name = 'PayrollEngineError';
  }
}

const ZERO = () => new Prisma.Decimal(0);
const MONEY_SCALE = 2;
const ROUNDING = Prisma.Decimal.ROUND_HALF_UP;
const INPUT_NAMES = ['contractWage', 'expectedDays', 'workedDays', 'expectedHours', 'workedHours', 'unpaidDays'] as const;
type InputName = (typeof INPUT_NAMES)[number];

function decimal(value: DecimalInput, label: string): Prisma.Decimal {
  try {
    const result = new Prisma.Decimal(value);
    if (!result.isFinite()) throw new Error('non-finite');
    return result;
  } catch {
    throw new PayrollEngineError(`${label} must be a finite decimal`);
  }
}

function money(value: Prisma.Decimal): Prisma.Decimal {
  if (!value.isFinite()) throw new PayrollEngineError('Calculation produced a non-finite value');
  return value.toDecimalPlaces(MONEY_SCALE, ROUNDING);
}

function categories(): Record<SalaryRuleCategory, Prisma.Decimal> {
  return {
    BASIC: ZERO(),
    ALLOWANCE: ZERO(),
    GROSS: ZERO(),
    DEDUCTION: ZERO(),
    NET: ZERO(),
  };
}

type TokenKind = 'number' | 'identifier' | 'string' | 'symbol' | 'eof';
interface Token {
  kind: TokenKind;
  value: string;
  at: number;
}

class Tokenizer {
  private at = 0;
  private count = 0;

  constructor(private readonly source: string) {
    if (source.length > 2_000) throw new PayrollEngineError('Formula is too long');
  }

  next(): Token {
    while (/\s/.test(this.source[this.at] ?? '')) this.at++;
    const start = this.at;
    if (start >= this.source.length) return { kind: 'eof', value: '', at: start };
    if (++this.count > 500) throw new PayrollEngineError('Formula has too many tokens');

    const char = this.source[this.at];
    if (/[0-9.]/.test(char)) {
      const rest = this.source.slice(this.at);
      const match = /^(?:\d+(?:\.\d*)?|\.\d+)/.exec(rest);
      if (!match) throw new PayrollEngineError(`Invalid number at position ${start}`);
      this.at += match[0].length;
      return { kind: 'number', value: match[0], at: start };
    }
    if (/[A-Za-z_]/.test(char)) {
      const match = /^[A-Za-z_][A-Za-z0-9_]*/.exec(this.source.slice(this.at))!;
      this.at += match[0].length;
      return { kind: 'identifier', value: match[0], at: start };
    }
    if (char === "'" || char === '"') {
      const quote = char;
      this.at++;
      let value = '';
      while (this.at < this.source.length && this.source[this.at] !== quote) {
        const current = this.source[this.at];
        if (current === '\\' || current === '\n' || current === '\r') {
          throw new PayrollEngineError(`Escapes and line breaks are not allowed in references at position ${this.at}`);
        }
        value += current;
        this.at++;
      }
      if (this.source[this.at] !== quote) throw new PayrollEngineError(`Unterminated string at position ${start}`);
      this.at++;
      return { kind: 'string', value, at: start };
    }
    if ('+-*/()[],'.includes(char)) {
      this.at++;
      return { kind: 'symbol', value: char, at: start };
    }
    throw new PayrollEngineError(`Unsupported token "${char}" at position ${start}`);
  }
}

interface FormulaContext {
  inputs: Record<InputName, Prisma.Decimal>;
  categoryValues: Record<SalaryRuleCategory, Prisma.Decimal>;
  ruleValues: Map<string, Prisma.Decimal>;
  allRuleSequences: Map<string, number>;
  currentSequence: number;
}

class FormulaParser {
  private current: Token;
  private depth = 0;

  constructor(
    private readonly tokenizer: Tokenizer,
    private readonly context: FormulaContext,
  ) {
    this.current = tokenizer.next();
  }

  parse(): Prisma.Decimal {
    const result = this.expression();
    if (this.current.kind !== 'eof') this.fail(`Unexpected token "${this.current.value}"`);
    return result;
  }

  private expression(): Prisma.Decimal {
    let left = this.term();
    while (this.isSymbol('+') || this.isSymbol('-')) {
      const operator = this.take().value;
      const right = this.term();
      left = operator === '+' ? left.plus(right) : left.minus(right);
      this.assertFinite(left);
    }
    return left;
  }

  private term(): Prisma.Decimal {
    let left = this.unary();
    while (this.isSymbol('*') || this.isSymbol('/')) {
      const operator = this.take().value;
      const right = this.unary();
      if (operator === '/' && right.isZero()) this.fail('Division by zero');
      left = operator === '*' ? left.times(right) : left.dividedBy(right);
      this.assertFinite(left);
    }
    return left;
  }

  private unary(): Prisma.Decimal {
    if (this.isSymbol('+')) {
      this.take();
      return this.unary();
    }
    if (this.isSymbol('-')) {
      this.take();
      return this.unary().negated();
    }
    return this.primary();
  }

  private primary(): Prisma.Decimal {
    if (++this.depth > 64) this.fail('Formula nesting is too deep');
    try {
      if (this.current.kind === 'number') {
        const token = this.take();
        return decimal(token.value, `Number at position ${token.at}`);
      }
      if (this.isSymbol('(')) {
        this.take();
        const value = this.expression();
        this.expectSymbol(')');
        return value;
      }
      if (this.current.kind === 'identifier') {
        const name = this.take().value;
        if (this.isSymbol('(')) return this.call(name);
        if (name === 'categories' || name === 'rules') return this.reference(name);
        if ((INPUT_NAMES as readonly string[]).includes(name)) return this.context.inputs[name as InputName];
        this.fail(`Unknown identifier "${name}"`);
      }
      this.fail(`Expected a number, input, reference, function, or parenthesized expression`);
    } finally {
      this.depth--;
    }
  }

  private reference(namespace: 'categories' | 'rules'): Prisma.Decimal {
    this.expectSymbol('[');
    if (this.current.kind !== 'string') this.fail(`${namespace} reference must use a quoted key`);
    const key = this.take().value;
    this.expectSymbol(']');

    if (namespace === 'categories') {
      if (!Object.prototype.hasOwnProperty.call(this.context.categoryValues, key)) {
        this.fail(`Unknown category "${key}"`);
      }
      return this.context.categoryValues[key as SalaryRuleCategory];
    }

    const value = this.context.ruleValues.get(key);
    if (value) return value;
    const sequence = this.context.allRuleSequences.get(key);
    if (sequence !== undefined && sequence >= this.context.currentSequence) {
      this.fail(`Rule "${key}" is current or later in the sequence`);
    }
    this.fail(`Unknown rule "${key}"`);
  }

  private call(name: string): Prisma.Decimal {
    if (!['min', 'max', 'round'].includes(name)) this.fail(`Unknown function "${name}"`);
    this.expectSymbol('(');
    const args: Prisma.Decimal[] = [];
    if (!this.isSymbol(')')) {
      do {
        args.push(this.expression());
        if (!this.isSymbol(',')) break;
        this.take();
      } while (true);
    }
    this.expectSymbol(')');

    if (name === 'min' || name === 'max') {
      if (args.length === 0) this.fail(`${name} requires at least one argument`);
      return args.slice(1).reduce((current, value) => {
        const comparison = value.comparedTo(current);
        return name === 'min' ? (comparison < 0 ? value : current) : comparison > 0 ? value : current;
      }, args[0]);
    }

    if (args.length < 1 || args.length > 2) this.fail('round requires one or two arguments');
    const places = args[1] ?? new Prisma.Decimal(MONEY_SCALE);
    if (!places.isInteger() || places.isNegative() || places.greaterThan(6)) {
      this.fail('round precision must be an integer from 0 to 6');
    }
    return args[0].toDecimalPlaces(places.toNumber(), ROUNDING);
  }

  private assertFinite(value: Prisma.Decimal) {
    if (!value.isFinite()) this.fail('Calculation produced a non-finite value');
  }

  private isSymbol(value: string): boolean {
    return this.current.kind === 'symbol' && this.current.value === value;
  }

  private expectSymbol(value: string) {
    if (!this.isSymbol(value)) this.fail(`Expected "${value}"`);
    this.take();
  }

  private take(): Token {
    const token = this.current;
    this.current = this.tokenizer.next();
    return token;
  }

  private fail(message: string): never {
    throw new PayrollEngineError(`${message} at position ${this.current.at}`);
  }
}

function evaluateFormula(source: string, context: FormulaContext): Prisma.Decimal {
  if (!source.trim()) throw new PayrollEngineError('Formula is empty');
  return new FormulaParser(new Tokenizer(source), context).parse();
}

function percentageBase(
  base: SalaryRuleBase,
  inputs: Record<InputName, Prisma.Decimal>,
  totals: Record<SalaryRuleCategory, Prisma.Decimal>,
): Prisma.Decimal {
  if (base === 'CONTRACT_WAGE') return inputs.contractWage;
  if (base === 'BASIC') return totals.BASIC;
  return totals.GROSS;
}

export function executePayroll(rules: readonly PayrollRuleInput[], input: PayrollInputs): PayrollResult {
  const inputs = Object.fromEntries(
    INPUT_NAMES.map((name) => [name, decimal(input[name], `Input ${name}`)]),
  ) as Record<InputName, Prisma.Decimal>;

  const activeRules = rules.filter((rule) => rule.isActive).slice().sort((a, b) => a.sequence - b.sequence);
  const allRuleSequences = new Map<string, number>();
  const sequences = new Set<number>();
  for (const rule of activeRules) {
    if (allRuleSequences.has(rule.code)) throw new PayrollEngineError(`Duplicate rule code "${rule.code}"`);
    if (sequences.has(rule.sequence)) throw new PayrollEngineError(`Duplicate rule sequence ${rule.sequence}`);
    allRuleSequences.set(rule.code, rule.sequence);
    sequences.add(rule.sequence);
  }

  const totals = categories();
  const ruleValues = new Map<string, Prisma.Decimal>();
  const lines: PayrollLineResult[] = [];

  for (const rule of activeRules) {
    try {
      let amount: Prisma.Decimal;
      let fixedAmount: Prisma.Decimal | null = null;
      let percentage: Prisma.Decimal | null = null;

      if (rule.method === 'FIXED') {
        if (rule.fixedAmount === null) throw new PayrollEngineError('FIXED requires fixedAmount');
        fixedAmount = decimal(rule.fixedAmount, 'fixedAmount');
        amount = fixedAmount;
      } else if (rule.method === 'PERCENTAGE') {
        if (rule.percentage === null || rule.percentageBase === null) {
          throw new PayrollEngineError('PERCENTAGE requires percentage and percentageBase');
        }
        percentage = decimal(rule.percentage, 'percentage');
        amount = percentageBase(rule.percentageBase, inputs, totals).times(percentage).dividedBy(100);
      } else {
        if (rule.formula === null) throw new PayrollEngineError('FORMULA requires formula');
        amount = evaluateFormula(rule.formula, {
          inputs,
          categoryValues: totals,
          ruleValues,
          allRuleSequences,
          currentSequence: rule.sequence,
        });
      }

      amount = money(amount);
      totals[rule.category] = money(totals[rule.category].plus(amount));
      ruleValues.set(rule.code, amount);
      lines.push({
        salaryRuleId: rule.salaryRuleId,
        ruleName: rule.name,
        ruleCode: rule.code,
        category: rule.category,
        sequence: rule.sequence,
        method: rule.method,
        fixedAmount,
        percentage,
        percentageBase: rule.percentageBase,
        formula: rule.formula,
        amount,
      });
    } catch (error) {
      if (error instanceof PayrollEngineError) throw new PayrollEngineError(error.message, rule.code);
      throw new PayrollEngineError(error instanceof Error ? error.message : 'Unknown calculation error', rule.code);
    }
  }

  return {
    lines,
    categories: totals,
    basic: totals.BASIC,
    allowances: totals.ALLOWANCE,
    gross: totals.GROSS,
    deductions: totals.DEDUCTION,
    net: totals.NET,
  };
}
