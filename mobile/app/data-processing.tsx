import { AppBackHeader } from "@/components/AppBackHeader";
import { colors } from "@/lib/theme";
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

export default function DataProcessingScreen() {
  return (
    <View style={styles.page}>
      <AppBackHeader
        title="Данные и геолокация"
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Section
          title="Местоположение"
          text="Координаты используются при начале и завершении рабочей смены, а также при подтверждении прибытия на объект. Приложение сначала использует последнее актуальное местоположение, поэтому повторное определение должно выполняться быстрее."
        />

        <Section
          title="Фотографии"
          text="Доступ к фотографиям используется для установки аватара, фиксации работ до и после выполнения, а также для загрузки документов и актов."
        />

        <Section
          title="Персональные данные"
          text="В системе сохраняются данные профиля, рабочие смены, назначенные заявки, сообщения администратору и история выполненных действий."
        />

        <Section
          title="Доступ"
          text="Пользователь видит только назначенные ему заявки. Администратор имеет доступ к управлению пользователями, ролями и сообщениям сотрудников."
        />

        <Pressable
          style={styles.settingsButton}
          onPress={() => {
            void Linking.openSettings();
          }}
        >
          <Text style={styles.settingsText}>
            Открыть настройки приложения
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function Section({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>
        {title}
      </Text>

      <Text style={styles.sectionText}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.background,
  },

  scroll: {
    flex: 1,
  },

  content: {
    padding: 16,
    paddingBottom: 40,
  },

  section: {
    marginBottom: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },

  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
  },

  sectionText: {
    marginTop: 10,
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 23,
  },

  settingsButton: {
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
    borderRadius: 15,
    backgroundColor: colors.primary,
  },

  settingsText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "800",
  },
});
