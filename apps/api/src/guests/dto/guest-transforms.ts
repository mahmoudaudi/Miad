export const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export const nullableTrim = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const nullableEmail = ({ value }: { value: unknown }) => {
  const trimmed = nullableTrim({ value });
  return typeof trimmed === 'string' ? trimmed.toLowerCase() : trimmed;
};
