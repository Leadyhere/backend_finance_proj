export const getMonthRange = (dateInput) => {
  const base = dateInput ? new Date(dateInput) : new Date();
  const start = new Date(base.getFullYear(), base.getMonth(), 1);
  const end = new Date(base.getFullYear(), base.getMonth() + 1, 1);
  return { start, end };
};

export const formatMonthKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  return `${year}-${month}`;
};

export const getLastMonths = (count) => {
  const months = [];
  const current = new Date();

  for (let i = count - 1; i >= 0; i -= 1) {
    months.push(new Date(current.getFullYear(), current.getMonth() - i, 1));
  }

  return months;
};
