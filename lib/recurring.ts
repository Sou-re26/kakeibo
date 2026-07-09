// 指定した月における発生日。その月に存在しない日(例: 2月の31日)は月末に丸める
export function occurrenceInMonth(year: number, month: number, dayOfMonth: number): Date {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(dayOfMonth, lastDay));
}

// now 以降(今日を含む)で最も近い発生日
export function nextOccurrence(dayOfMonth: number, now: Date): Date {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thisMonth = occurrenceInMonth(today.getFullYear(), today.getMonth(), dayOfMonth);
  if (thisMonth.getTime() >= today.getTime()) {
    return thisMonth;
  }
  return occurrenceInMonth(today.getFullYear(), today.getMonth() + 1, dayOfMonth);
}

// now から target までの日数(日付単位)。同日なら0
export function daysUntil(target: Date, now: Date): number {
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const to = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
}

// fromExclusive より後、toInclusive まで(日付単位)の発生日を昇順で返す。
// 自動記帳の「前回実行日の翌日〜今日」の列挙に使う
export function occurrencesBetween(
  dayOfMonth: number,
  fromExclusive: Date,
  toInclusive: Date,
): Date[] {
  const from = new Date(
    fromExclusive.getFullYear(),
    fromExclusive.getMonth(),
    fromExclusive.getDate(),
  );
  const to = new Date(toInclusive.getFullYear(), toInclusive.getMonth(), toInclusive.getDate());
  const result: Date[] = [];
  if (to.getTime() <= from.getTime()) return result;

  let year = from.getFullYear();
  let month = from.getMonth();
  while (year < to.getFullYear() || (year === to.getFullYear() && month <= to.getMonth())) {
    const occurrence = occurrenceInMonth(year, month, dayOfMonth);
    if (occurrence.getTime() > from.getTime() && occurrence.getTime() <= to.getTime()) {
      result.push(occurrence);
    }
    month++;
    if (month > 11) {
      month = 0;
      year++;
    }
  }
  return result;
}
