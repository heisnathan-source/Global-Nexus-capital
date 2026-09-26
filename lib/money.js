// Monetary values are handled as integer pesewas to avoid floating-point errors.
export const toPesewas = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new Error("Invalid monetary value");
  return Math.round(n * 100);
};
export const fromPesewas = (value) => (Number(value) / 100).toFixed(2);
