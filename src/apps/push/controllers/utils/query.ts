import { BadRequestException } from '@nestjs/common';

export function parseQueryNumber(
  value: string | undefined,
  name: string,
): number {
  if (!value?.trim() || !Number.isFinite(Number(value))) {
    throw new BadRequestException(`${name} must be a number`);
  }
  return Number(value);
}

export function parseQueryText(
  value: string | undefined,
  name: string,
): string {
  if (!value?.trim()) throw new BadRequestException(`${name} is required`);
  return value;
}

export function parseQueryEnum<T extends string>(
  value: string | undefined,
  name: string,
  values: readonly T[],
): T {
  if (value && values.includes(value as T)) return value as T;
  throw new BadRequestException(`${name} must be one of: ${values.join(', ')}`);
}

export function parseQueryList(value: string | undefined): string[] {
  return value ? value.split(',') : [];
}
