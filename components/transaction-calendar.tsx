import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import type { Transaction } from '@/db/schema';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { buildCalendarWeeks, dayTypeTotals } from '@/lib/calendar';
import { occurrenceInMonth } from '@/lib/recurring';
import type { DayGroup } from '@/lib/timeline';

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

type Props = {
  groups: DayGroup<Transaction>[];
  /** 定期支出/収入。該当日にドット(収入=accent、支出=critical)を表示する */
  recurrings?: { type: string; dayOfMonth: number }[];
  /** 記録のある日をタップしたとき(記録のない日は反応しない) */
  onPressDay: (group: DayGroup<Transaction>) => void;
};

// 月表示のカレンダー。各日のセルに 収入(accent色)/支出(文字色)/振替(灰) の総額を
// この順の3段固定で表示する(無い種別の段は空けたまま詰めない)。
export function TransactionCalendar({ groups, recurrings, onPressDay }: Props) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const [visibleMonth, setVisibleMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  // key は lib/timeline.ts の DayGroup.key('YYYY-M-D')と同じ形式
  const groupMap = useMemo(() => new Map(groups.map((g) => [g.key, g])), [groups]);
  const weeks = useMemo(
    () => buildCalendarWeeks(visibleMonth.year, visibleMonth.month),
    [visibleMonth],
  );

  // 表示中の月の定期収支マーカー(日→種別)。存在しない日は月末へ丸められる
  const recurringMarkers = useMemo(() => {
    const map = new Map<number, { income: boolean; expense: boolean }>();
    for (const item of recurrings ?? []) {
      const day = occurrenceInMonth(visibleMonth.year, visibleMonth.month, item.dayOfMonth).getDate();
      const marker = map.get(day) ?? { income: false, expense: false };
      if (item.type === 'income') marker.income = true;
      else marker.expense = true;
      map.set(day, marker);
    }
    return map;
  }, [recurrings, visibleMonth]);

  const moveMonth = (delta: number) => {
    setVisibleMonth(({ year, month }) => {
      const moved = new Date(year, month + delta, 1);
      return { year: moved.getFullYear(), month: moved.getMonth() };
    });
  };

  const today = new Date();
  const isToday = (date: Date) =>
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();

  const weekdayColor = (weekday: number) => {
    if (weekday === 0) return colors.sunday;
    if (weekday === 6) return colors.saturday;
    return colors.text;
  };

  return (
    <View>
      {/* 月送りヘッダー */}
      <View style={styles.monthHeader}>
        <Pressable hitSlop={12} onPress={() => moveMonth(-1)}>
          <ThemedText style={styles.monthArrow}>‹</ThemedText>
        </Pressable>
        <ThemedText type="defaultSemiBold" style={styles.monthLabel}>
          {visibleMonth.year}年{visibleMonth.month + 1}月
        </ThemedText>
        <Pressable hitSlop={12} onPress={() => moveMonth(1)}>
          <ThemedText style={styles.monthArrow}>›</ThemedText>
        </Pressable>
      </View>

      {/* 曜日ヘッダー */}
      <View style={styles.weekRow}>
        {WEEKDAYS.map((label, weekday) => (
          <View key={label} style={styles.weekdayCell}>
            <ThemedText style={[styles.weekdayText, { color: weekdayColor(weekday) }]}>
              {label}
            </ThemedText>
          </View>
        ))}
      </View>

      {weeks.map((week, weekIndex) => (
        <View key={weekIndex} style={styles.weekRow}>
          {week.map((date, dayIndex) => {
            if (!date) {
              return <View key={dayIndex} style={[styles.dayCell, { borderColor: colors.border }]} />;
            }
            const key = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
            const group = groupMap.get(key);
            const totals = group ? dayTypeTotals(group.items) : null;
            const marker = recurringMarkers.get(date.getDate());
            return (
              <Pressable
                key={dayIndex}
                style={[styles.dayCell, { borderColor: colors.border }]}
                onPress={group ? () => onPressDay(group) : undefined}
                disabled={!group}
              >
                <View style={styles.dayHeader}>
                  <ThemedText
                    style={[
                      styles.dayNumber,
                      { color: isToday(date) ? colors.accent : weekdayColor(date.getDay()) },
                      isToday(date) && styles.dayNumberToday,
                    ]}
                  >
                    {date.getDate()}
                  </ThemedText>
                  {marker ? (
                    <View style={styles.markerRow}>
                      {marker.income ? (
                        <View style={[styles.marker, { backgroundColor: colors.accent }]} />
                      ) : null}
                      {marker.expense ? (
                        <View style={[styles.marker, { backgroundColor: colors.critical }]} />
                      ) : null}
                    </View>
                  ) : null}
                </View>
                <ThemedText
                  style={[styles.totalText, { color: colors.accent }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {totals && totals.income > 0 ? totals.income.toLocaleString() : ' '}
                </ThemedText>
                <ThemedText
                  style={[styles.totalText, { color: colors.text }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {totals && totals.expense > 0 ? totals.expense.toLocaleString() : ' '}
                </ThemedText>
                <ThemedText
                  style={[styles.totalText, { color: colors.icon }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {totals && totals.transfer > 0 ? totals.transfer.toLocaleString() : ' '}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 12,
  },
  monthArrow: {
    fontSize: 24,
    lineHeight: 28,
  },
  monthLabel: {
    fontSize: 16,
  },
  weekRow: {
    flexDirection: 'row',
  },
  weekdayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  weekdayText: {
    fontSize: 12,
  },
  dayCell: {
    flex: 1,
    minHeight: 64,
    borderWidth: 0.5,
    padding: 2,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dayNumber: {
    fontSize: 11,
    lineHeight: 14,
  },
  dayNumberToday: {
    fontWeight: 'bold',
  },
  markerRow: {
    flexDirection: 'row',
    gap: 2,
  },
  marker: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  totalText: {
    fontSize: 9,
    lineHeight: 13,
    textAlign: 'right',
  },
});
