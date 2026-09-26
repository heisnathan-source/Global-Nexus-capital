export function validateWithdrawal({
  withdrawalsEnabled,
  identityApproved,
  hasFundsPassword,
  amountPesewas,
  availablePesewas,
  lastWithdrawalAt,
  now = new Date(),
  allowedDays = [1,2,3,4,5,6,0],
}) {
  if (!withdrawalsEnabled) return "Withdrawals are currently unavailable.";
  if (!identityApproved) return "Identity verification must be approved before withdrawal.";
  if (!hasFundsPassword) return "A 6-digit Funds Password is required.";
  if (!Number.isInteger(amountPesewas) || amountPesewas <= 0) return "Invalid withdrawal amount.";
  if (amountPesewas > availablePesewas) return "Insufficient available balance.";

  const day = now.getUTCDay();
  if (!allowedDays.includes(day)) return "Withdrawals are unavailable today.";

  if (lastWithdrawalAt) {
    const elapsed = now.getTime() - new Date(lastWithdrawalAt).getTime();
    if (elapsed < 24 * 60 * 60 * 1000) return "Only one withdrawal request is allowed per 24 hours.";
  }
  return null;
}

export function calculateFee(amountPesewas, mode, value) {
  if (mode === "percentage") {
    if (value < 0 || value > 100) throw new Error("Invalid fee percentage");
    return Math.round(amountPesewas * (value / 100));
  }
  if (mode === "fixed") {
    if (!Number.isInteger(value) || value < 0) throw new Error("Invalid fixed fee");
    return value;
  }
  throw new Error("Unknown fee mode");
}
