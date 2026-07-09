import { asc, eq } from 'drizzle-orm';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import {
  CATEGORIES,
  formatCategoryLabel,
  INCOME_CATEGORIES,
  type Category,
} from '@/constants/categories';
import { Colors } from '@/constants/theme';
import {
  totalBudget,
  useSettings,
  type HomeBreakdown,
  type HomeComparison,
} from '@/contexts/settings';
import { db } from '@/db/client';
import { accounts, recurrings, type Account, type Recurring } from '@/db/schema';
import { useColorScheme } from '@/hooks/use-color-scheme';

const BREAKDOWN_OPTIONS: { key: HomeBreakdown; label: string }[] = [
  { key: 'category', label: 'カテゴリ別' },
  { key: 'period', label: '期間別(月ごと)' },
];

const COMPARISON_OPTIONS: { key: HomeComparison; label: string; periodOnly?: boolean }[] = [
  { key: 'prevMonth', label: '前月比' },
  { key: 'budget', label: '予算比' },
  { key: 'income', label: '収入比', periodOnly: true },
];

// ドロワー内の項目(セクション)。タップで開閉するアコーディオン
const SECTIONS = [
  { key: 'display', label: 'ホームの表示' },
  { key: 'budget', label: 'カテゴリ別予算' },
  { key: 'recurring', label: '定期収支' },
  { key: 'alert', label: '支払日の警告' },
] as const;

type SectionKey = (typeof SECTIONS)[number]['key'];

const budgetTextsFrom = (budgets: Record<string, number>): Record<string, string> =>
  Object.fromEntries(
    CATEGORIES.map((cat) => [
      cat.key,
      budgets[cat.key] === undefined ? '' : budgets[cat.key].toLocaleString(),
    ]),
  );

type Props = {
  visible: boolean;
  onClose: () => void;
};

// 設定のサイドドロワー(旧 app/settings.tsx の内容を項目別セクションで表示)。
// 画面遷移ではなくModal+Animatedによる左スライドで、全タブから開ける
export function SettingsDrawer({ visible, onClose }: Props) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const drawerWidth = Math.min(width * 0.85, 340);

  // 開閉アニメーション(0=閉、1=開)。閉アニメーション完了までModalは表示し続ける
  const progress = useRef(new Animated.Value(0)).current;
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    if (visible) {
      setRendered(true);
      Animated.timing(progress, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    } else if (rendered) {
      Animated.timing(progress, { toValue: 0, duration: 180, useNativeDriver: true }).start(
        ({ finished }) => {
          if (finished) setRendered(false);
        },
      );
    }
  }, [visible, rendered, progress]);

  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-drawerWidth, 0],
  });

  const [expanded, setExpanded] = useState<Set<SectionKey>>(new Set(['display']));
  const toggleSection = (key: SectionKey) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });

  const { settings, isLoaded, updateSettings } = useSettings();
  const [budgetTexts, setBudgetTexts] = useState<Record<string, string>>(() =>
    budgetTextsFrom(settings.categoryBudgets),
  );
  const [alertDaysText, setAlertDaysText] = useState('');

  // 定期収支
  const [recurringList, setRecurringList] = useState<Recurring[]>([]);
  const [recType, setRecType] = useState<'expense' | 'income'>('expense');
  const [recLabel, setRecLabel] = useState('');
  const [recDay, setRecDay] = useState('');
  const [recAmount, setRecAmount] = useState('');
  const [recCategoryKey, setRecCategoryKey] = useState<string | null>(null);
  const [recSubcategoryKey, setRecSubcategoryKey] = useState<string | null>(null);
  const [recAccountId, setRecAccountId] = useState<number | null>(null);
  const [isCategoryPickerOpen, setIsCategoryPickerOpen] = useState(false);
  const [pickerMain, setPickerMain] = useState<Category | null>(null); // カテゴリ選択の2段階目
  const [isAccountPickerOpen, setIsAccountPickerOpen] = useState(false);
  const [accountList, setAccountList] = useState<Account[]>([]);

  const loadRecurrings = useCallback(async () => {
    try {
      const [rows, accountRows] = await Promise.all([
        db.select().from(recurrings).orderBy(asc(recurrings.dayOfMonth)),
        db.select().from(accounts).orderBy(asc(accounts.id)),
      ]);
      setRecurringList(rows);
      setAccountList(accountRows);
    } catch (error) {
      console.error(error);
    }
  }, []);

  // 開いた瞬間の1回だけ入力欄へ反映する(開いている間の設定変更で編集中の欄を巻き込まない)
  const prevVisible = useRef(false);
  useEffect(() => {
    if (visible && !prevVisible.current && isLoaded) {
      setBudgetTexts(budgetTextsFrom(settings.categoryBudgets));
      setAlertDaysText(String(settings.alertDaysBefore));
      loadRecurrings();
    }
    prevVisible.current = visible;
  }, [visible, isLoaded, settings.categoryBudgets, settings.alertDaysBefore, loadRecurrings]);

  const commitAlertDays = () => {
    const trimmed = alertDaysText.trim();
    const days = Number(trimmed);
    if (!/^\d+$/.test(trimmed) || !Number.isInteger(days) || days > 31) {
      Alert.alert('保存できません', '警告日数は0〜31の整数で入力してください。');
      setAlertDaysText(String(settings.alertDaysBefore));
      return;
    }
    updateSettings({ alertDaysBefore: days });
  };

  // 種別ごとのカテゴリ候補。種別を切り替えたら選択済みカテゴリはリセットする
  const recCategoryOptions = recType === 'income' ? INCOME_CATEGORIES : CATEGORIES;
  const switchRecType = (type: 'expense' | 'income') => {
    if (type !== recType) {
      setRecCategoryKey(null);
      setRecSubcategoryKey(null);
    }
    setRecType(type);
  };

  const addRecurring = async () => {
    const label = recLabel.trim();
    const day = Number(recDay.trim());
    const amountText = recAmount.trim().replace(/,/g, '');
    if (!label) {
      Alert.alert('追加できません', '名前を入力してください。');
      return;
    }
    if (!Number.isInteger(day) || day < 1 || day > 31) {
      Alert.alert('追加できません', '日は1〜31の整数で入力してください。');
      return;
    }
    let amount: number | null = null;
    if (amountText !== '') {
      if (!/^\d+$/.test(amountText) || !Number.isSafeInteger(Number(amountText))) {
        Alert.alert('追加できません', '金額は0以上の整数(円)で入力してください。');
        return;
      }
      amount = Number(amountText);
    }
    try {
      // 登録日当日以前の発生分は記帳しない(appliedThrough=今日から開始)
      const today = new Date();
      await db.insert(recurrings).values({
        type: recType,
        label,
        dayOfMonth: day,
        amount,
        categoryKey: recCategoryKey,
        subcategoryKey: recSubcategoryKey,
        accountId: recAccountId,
        appliedThrough: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
      });
      setRecLabel('');
      setRecDay('');
      setRecAmount('');
      setRecCategoryKey(null);
      setRecSubcategoryKey(null);
      setRecAccountId(null);
      await loadRecurrings();
    } catch (error) {
      console.error(error);
      Alert.alert('追加に失敗しました', 'もう一度お試しください。');
    }
  };

  const deleteRecurring = (item: Recurring) => {
    Alert.alert('定期収支を削除', `「${item.label}」を削除しますか?`, [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: async () => {
          try {
            await db.delete(recurrings).where(eq(recurrings.id, item.id));
            await loadRecurrings();
          } catch (error) {
            console.error(error);
            Alert.alert('削除に失敗しました', 'もう一度お試しください。');
          }
        },
      },
    ]);
  };

  const commitBudget = (categoryKey: string) => {
    const trimmed = (budgetTexts[categoryKey] ?? '').trim().replace(/,/g, '');
    const next = { ...settings.categoryBudgets };
    if (trimmed === '') {
      delete next[categoryKey];
    } else if (!/^\d+$/.test(trimmed) || !Number.isSafeInteger(Number(trimmed))) {
      Alert.alert('保存できません', '予算は0以上の整数(円)で入力してください。');
      setBudgetTexts((prev) => ({
        ...prev,
        [categoryKey]:
          settings.categoryBudgets[categoryKey] === undefined
            ? ''
            : settings.categoryBudgets[categoryKey].toLocaleString(),
      }));
      return;
    } else {
      next[categoryKey] = Number(trimmed);
    }
    updateSettings({ categoryBudgets: next });
    // 確定した値をコンマ区切りへ整形して表示に戻す
    setBudgetTexts((prev) => ({
      ...prev,
      [categoryKey]: trimmed === '' ? '' : Number(trimmed).toLocaleString(),
    }));
  };

  const renderOption = (label: string, selected: boolean, onPress: () => void, key: string) => (
    <Pressable
      key={key}
      style={[styles.optionRow, { borderColor: colors.border }]}
      onPress={onPress}
    >
      <ThemedText style={styles.optionLabel}>{label}</ThemedText>
      {selected ? (
        <ThemedText style={{ color: colors.tint }} type="defaultSemiBold">
          ✓
        </ThemedText>
      ) : null}
    </Pressable>
  );

  const comparisonOptions = COMPARISON_OPTIONS.filter(
    (option) => !option.periodOnly || settings.homeBreakdown === 'period',
  );

  const total = totalBudget(settings.categoryBudgets);

  const renderSectionBody = (key: SectionKey) => {
    switch (key) {
      case 'display':
        return (
          <>
            <ThemedText style={styles.sectionLabel}>「使ったお金」の表示方式</ThemedText>
            {BREAKDOWN_OPTIONS.map((option) =>
              renderOption(
                option.label,
                settings.homeBreakdown === option.key,
                () => updateSettings({ homeBreakdown: option.key }),
                option.key,
              ),
            )}
            <ThemedText style={[styles.sectionLabel, styles.sectionLabelSpaced]}>
              支出の比較対象
            </ThemedText>
            {comparisonOptions.map((option) =>
              renderOption(
                option.label,
                settings.homeComparison === option.key,
                () => updateSettings({ homeComparison: option.key }),
                option.key,
              ),
            )}
            {settings.homeBreakdown === 'category' ? (
              <ThemedText style={styles.note}>収入比は期間別のときに選べます。</ThemedText>
            ) : null}
          </>
        );
      case 'budget':
        return (
          <>
            {CATEGORIES.map((cat) => (
              <View key={cat.key} style={[styles.budgetRow, { borderColor: colors.border }]}>
                <ThemedText style={styles.budgetIcon}>{cat.icon}</ThemedText>
                <ThemedText style={styles.budgetLabel}>{cat.label}</ThemedText>
                <TextInput
                  style={[styles.budgetInput, { color: colors.text, borderColor: colors.border }]}
                  placeholder="未設定"
                  placeholderTextColor={colors.icon}
                  value={budgetTexts[cat.key] ?? ''}
                  onChangeText={(text) =>
                    setBudgetTexts((prev) => ({ ...prev, [cat.key]: text }))
                  }
                  onEndEditing={() => commitBudget(cat.key)}
                  keyboardType="number-pad"
                />
              </View>
            ))}
            <View style={styles.budgetTotalRow}>
              <ThemedText style={styles.budgetTotalLabel}>合計(円/月)</ThemedText>
              <ThemedText type="defaultSemiBold">
                {total === null ? '未設定' : `¥${total.toLocaleString()}`}
              </ThemedText>
            </View>
            <ThemedText style={styles.note}>
              予算比の計算に使います。総額の予算比は設定したカテゴリ予算の合計と比較します。
            </ThemedText>
          </>
        );
      case 'recurring':
        return (
          <>
            {recurringList.length === 0 ? (
              <ThemedText style={styles.note}>
                まだ登録がありません。家賃や給料日を登録すると、ホームとカレンダーに表示されます。
              </ThemedText>
            ) : (
              recurringList.map((item) => (
                <View key={item.id} style={[styles.recurringRow, { borderColor: colors.border }]}>
                  <View
                    style={[
                      styles.recurringDot,
                      {
                        backgroundColor: item.type === 'income' ? colors.accent : colors.critical,
                      },
                    ]}
                  />
                  <View style={styles.recurringBody}>
                    <ThemedText style={styles.optionLabel}>{item.label}</ThemedText>
                    <ThemedText style={styles.note}>
                      毎月{item.dayOfMonth}日
                      {item.categoryKey
                        ? `・${formatCategoryLabel(item.categoryKey, item.subcategoryKey)}`
                        : ''}
                      {item.amount !== null ? `・¥${item.amount.toLocaleString()}` : ''}
                      {item.accountId !== null
                        ? `・${accountList.find((acc) => acc.id === item.accountId)?.name ?? '不明な口座'}`
                        : ''}
                    </ThemedText>
                  </View>
                  <Pressable
                    hitSlop={8}
                    onPress={() => deleteRecurring(item)}
                    style={({ pressed }) => [pressed && styles.pressed]}
                  >
                    <ThemedText style={{ color: colors.critical }}>✕</ThemedText>
                  </Pressable>
                </View>
              ))
            )}

            {/* 追加フォーム */}
            <View style={styles.recTypeRow}>
              {(
                [
                  { key: 'expense', label: '定期支出' },
                  { key: 'income', label: '定期収入' },
                ] as const
              ).map((option) => (
                <Pressable
                  key={option.key}
                  onPress={() => switchRecType(option.key)}
                  style={({ pressed }) => [
                    styles.recTypeButton,
                    { backgroundColor: recType === option.key ? colors.accent : colors.card },
                    pressed && styles.pressed,
                  ]}
                >
                  <ThemedText
                    style={{ color: recType === option.key ? colors.onAccent : colors.text }}
                  >
                    {option.label}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border }]}
              placeholder="名前(例: 家賃、給料)"
              placeholderTextColor={colors.icon}
              value={recLabel}
              onChangeText={setRecLabel}
            />
            <Pressable
              onPress={() => {
                setPickerMain(null);
                setIsCategoryPickerOpen(true);
              }}
              style={({ pressed }) => [
                styles.input,
                styles.recCategoryButton,
                { borderColor: colors.border },
                pressed && styles.pressed,
              ]}
            >
              <ThemedText style={recCategoryKey ? undefined : { color: colors.icon }}>
                {formatCategoryLabel(recCategoryKey, recSubcategoryKey) ?? 'カテゴリ(任意)'}
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => setIsAccountPickerOpen(true)}
              style={({ pressed }) => [
                styles.input,
                styles.recCategoryButton,
                { borderColor: colors.border },
                pressed && styles.pressed,
              ]}
            >
              <ThemedText style={recAccountId !== null ? undefined : { color: colors.icon }}>
                {recAccountId !== null
                  ? (accountList.find((acc) => acc.id === recAccountId)?.name ?? '不明な口座')
                  : '口座(任意)'}
              </ThemedText>
            </Pressable>
            <View style={styles.recInputRow}>
              <TextInput
                style={[
                  styles.input,
                  styles.recDayInput,
                  { color: colors.text, borderColor: colors.border },
                ]}
                placeholder="毎月の日(1〜31)"
                placeholderTextColor={colors.icon}
                value={recDay}
                onChangeText={setRecDay}
                keyboardType="number-pad"
              />
              <TextInput
                style={[
                  styles.input,
                  styles.recAmountInput,
                  { color: colors.text, borderColor: colors.border },
                ]}
                placeholder="金額(任意)"
                placeholderTextColor={colors.icon}
                value={recAmount}
                onChangeText={setRecAmount}
                keyboardType="number-pad"
              />
            </View>
            <Pressable
              onPress={addRecurring}
              style={({ pressed }) => [
                styles.addRecurringButton,
                { borderColor: colors.tint },
                pressed && styles.pressed,
              ]}
            >
              <ThemedText style={{ color: colors.tint }}>＋ 追加</ThemedText>
            </Pressable>
          </>
        );
      case 'alert':
        return (
          <>
            <View style={styles.alertDaysRow}>
              <ThemedText style={styles.alertDaysLabel}>何日前から警告する</ThemedText>
              <TextInput
                style={[
                  styles.input,
                  styles.alertDaysInput,
                  { color: colors.text, borderColor: colors.border },
                ]}
                placeholder="3"
                placeholderTextColor={colors.icon}
                value={alertDaysText}
                onChangeText={setAlertDaysText}
                onEndEditing={commitAlertDays}
                keyboardType="number-pad"
              />
            </View>
            <ThemedText style={styles.note}>
              定期支出の支払日がこの日数以内になると、ホームに警告を表示します(0=当日のみ)。
            </ThemedText>
          </>
        );
    }
  };

  return (
    <Modal visible={rendered} transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
        <Animated.View
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim, opacity: progress }]}
        />
      </Pressable>

      <Animated.View
        style={[
          styles.drawer,
          {
            width: drawerWidth,
            backgroundColor: colors.background,
            paddingTop: insets.top + 16,
            transform: [{ translateX }],
          },
        ]}
      >
        <ThemedText type="title" style={styles.drawerTitle}>
          設定
        </ThemedText>

        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
        >
          {SECTIONS.map((section) => {
            const isOpen = expanded.has(section.key);
            return (
              <View key={section.key}>
                <Pressable
                  style={[styles.sectionHeader, { borderColor: colors.border }]}
                  onPress={() => toggleSection(section.key)}
                >
                  <ThemedText type="defaultSemiBold" style={styles.sectionHeaderLabel}>
                    {section.label}
                  </ThemedText>
                  <IconSymbol
                    name={isOpen ? 'chevron.down' : 'chevron.right'}
                    size={18}
                    color={colors.icon}
                  />
                </Pressable>
                {isOpen ? <View style={styles.sectionBody}>{renderSectionBody(section.key)}</View> : null}
              </View>
            );
          })}
        </ScrollView>
      </Animated.View>

      {/* 定期収支のカテゴリ選択モーダル(大カテゴリ→サブカテゴリの2段階)。
          ドロワーのModal内に重ねて表示する(Androidが主対象。iOSの多重Modalは未検証) */}
      <Modal
        visible={isCategoryPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsCategoryPickerOpen(false)}
      >
        <Pressable
          style={[styles.modalBackdrop, { backgroundColor: colors.scrim }]}
          onPress={() => setIsCategoryPickerOpen(false)}
        >
          <View style={[styles.modalSheet, { backgroundColor: colors.background }]}>
            <ThemedText type="defaultSemiBold" style={styles.modalTitle}>
              {pickerMain ? pickerMain.label : 'カテゴリを選択'}
            </ThemedText>
            <ScrollView style={styles.modalList}>
              {pickerMain === null ? (
                <>
                  <Pressable
                    style={[styles.modalRow, { borderColor: colors.border }]}
                    onPress={() => {
                      setRecCategoryKey(null);
                      setRecSubcategoryKey(null);
                      setIsCategoryPickerOpen(false);
                    }}
                  >
                    <ThemedText>なし</ThemedText>
                  </Pressable>
                  {recCategoryOptions.map((cat) => (
                    <Pressable
                      key={cat.key}
                      style={[styles.modalRow, { borderColor: colors.border }]}
                      onPress={() => {
                        if (cat.subcategories.length === 0) {
                          setRecCategoryKey(cat.key);
                          setRecSubcategoryKey(null);
                          setIsCategoryPickerOpen(false);
                        } else {
                          setPickerMain(cat);
                        }
                      }}
                    >
                      <ThemedText>
                        {cat.icon} {cat.label}
                        {cat.subcategories.length > 0 ? ' ›' : ''}
                      </ThemedText>
                    </Pressable>
                  ))}
                </>
              ) : (
                <>
                  <Pressable
                    style={[styles.modalRow, { borderColor: colors.border }]}
                    onPress={() => setPickerMain(null)}
                  >
                    <ThemedText>← 戻る</ThemedText>
                  </Pressable>
                  {pickerMain.subcategories.map((sub) => (
                    <Pressable
                      key={sub.key}
                      style={[styles.modalRow, { borderColor: colors.border }]}
                      onPress={() => {
                        setRecCategoryKey(pickerMain.key);
                        setRecSubcategoryKey(sub.key);
                        setIsCategoryPickerOpen(false);
                      }}
                    >
                      <ThemedText>{sub.label}</ThemedText>
                    </Pressable>
                  ))}
                </>
              )}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      {/* 定期収支の口座選択モーダル */}
      <Modal
        visible={isAccountPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsAccountPickerOpen(false)}
      >
        <Pressable
          style={[styles.modalBackdrop, { backgroundColor: colors.scrim }]}
          onPress={() => setIsAccountPickerOpen(false)}
        >
          <View style={[styles.modalSheet, { backgroundColor: colors.background }]}>
            <ThemedText type="defaultSemiBold" style={styles.modalTitle}>
              口座を選択
            </ThemedText>
            <ScrollView style={styles.modalList}>
              <Pressable
                style={[styles.modalRow, { borderColor: colors.border }]}
                onPress={() => {
                  setRecAccountId(null);
                  setIsAccountPickerOpen(false);
                }}
              >
                <ThemedText>指定なし</ThemedText>
              </Pressable>
              {accountList.map((acc) => (
                <Pressable
                  key={acc.id}
                  style={[styles.modalRow, { borderColor: colors.border }]}
                  onPress={() => {
                    setRecAccountId(acc.id);
                    setIsAccountPickerOpen(false);
                  }}
                >
                  <ThemedText>{acc.name}</ThemedText>
                </Pressable>
              ))}
              {accountList.length === 0 ? (
                <ThemedText style={styles.note}>
                  口座がありません。「残高」タブから追加できます。
                </ThemedText>
              ) : null}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  drawer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    paddingHorizontal: 16,
  },
  drawerTitle: {
    marginBottom: 8,
  },
  content: {
    paddingBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 0.5,
  },
  sectionHeaderLabel: {
    fontSize: 16,
  },
  sectionBody: {
    paddingTop: 8,
    paddingBottom: 16,
  },
  sectionLabel: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 4,
  },
  sectionLabelSpaced: {
    marginTop: 16,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 0.5,
  },
  optionLabel: {
    fontSize: 16,
  },
  note: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 6,
  },
  budgetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    borderBottomWidth: 0.5,
  },
  budgetIcon: {
    fontSize: 18,
    width: 24,
    textAlign: 'center',
  },
  budgetLabel: {
    flex: 1,
    fontSize: 15,
  },
  budgetInput: {
    width: 110,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 15,
    textAlign: 'right',
  },
  budgetTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  budgetTotalLabel: {
    fontSize: 15,
    opacity: 0.7,
  },
  pressed: {
    opacity: 0.6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  recurringRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
  },
  recurringDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  recurringBody: {
    flex: 1,
  },
  recTypeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    marginBottom: 8,
  },
  recTypeButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 16,
  },
  recInputRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  recDayInput: {
    flex: 1,
  },
  recAmountInput: {
    flex: 1,
  },
  addRecurringButton: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
  },
  recCategoryButton: {
    marginTop: 8,
  },
  alertDaysRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  alertDaysLabel: {
    fontSize: 15,
  },
  alertDaysInput: {
    width: 80,
    textAlign: 'right',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 32,
  },
  modalSheet: {
    borderRadius: 16,
    padding: 20,
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 18,
    marginBottom: 8,
  },
  modalList: {
    flexGrow: 0,
  },
  modalRow: {
    paddingVertical: 14,
    borderBottomWidth: 0.5,
  },
});
