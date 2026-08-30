import { FlatList, ScrollView, StyleSheet, Text, View } from "react-native";
import type { Curriculum, School } from "@/lib/api";
import { SchoolPicker } from "@/components/onboarding/SchoolPicker";
import { DateField } from "@/components/DateTimeField";
import { childDobBounds } from "@/lib/dates";
import {
  GENDERS,
  curriculumChipLabel,
  isLimitedCurriculum,
} from "@/constants/onboarding";
import {
  Chip,
  colors,
  FieldInput,
  FieldLabel,
  InfoCard,
} from "@/components/onboarding/ui";

type Props = {
  token: string;
  curricula: Curriculum[];
  nickname: string;
  onNicknameChange: (v: string) => void;
  dateOfBirth: Date | null;
  onDateOfBirthChange: (v: Date) => void;
  selectedSchool: School | null;
  onSchoolSelect: (school: School | null) => void;
  gender: string;
  onGenderChange: (v: string) => void;
  curriculumId: string | null;
  onCurriculumChange: (id: string) => void;
  gradeId: string | null;
  onGradeChange: (id: string) => void;
  defaultCity?: string;
  defaultPin?: string;
  defaultState?: string;
};

export function ChildFormFields({
  token,
  curricula,
  nickname,
  onNicknameChange,
  dateOfBirth,
  onDateOfBirthChange,
  selectedSchool,
  onSchoolSelect,
  gender,
  onGenderChange,
  curriculumId,
  onCurriculumChange,
  gradeId,
  onGradeChange,
  defaultCity = "",
  defaultPin = "",
  defaultState = "",
}: Props) {
  const selectedCurriculum = curricula.find((c) => c.id === curriculumId);
  const dobBounds = childDobBounds();

  return (
    <>
      <FieldInput
        label="Nickname *"
        placeholder="e.g. Aarav — kept private"
        value={nickname}
        onChangeText={onNicknameChange}
        hint="Never shown to other parents"
      />

      <View style={styles.dobField}>
        <DateField
          label="Date of birth *"
          value={dateOfBirth}
          onChange={onDateOfBirthChange}
          minimumDate={dobBounds.minimumDate}
          maximumDate={dobBounds.maximumDate}
          hint="Private — never shown to other parents"
        />
      </View>

      <SchoolPicker
        token={token}
        selected={selectedSchool}
        onSelect={onSchoolSelect}
        defaultCity={defaultCity}
        defaultPin={defaultPin}
        defaultState={defaultState}
      />

      <FieldLabel>Gender</FieldLabel>
      <View style={styles.chipRow}>
        {GENDERS.map((g) => (
          <Chip
            key={g.value}
            label={g.label}
            selected={gender === g.value}
            onPress={() => onGenderChange(g.value)}
          />
        ))}
      </View>

      <FieldLabel>Curriculum</FieldLabel>
      <Text style={styles.curriculumHint}>
        For nursery through 12th, choose CBSE, SSC, or IGCSE.
      </Text>
      <FlatList
        horizontal
        data={curricula}
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
        renderItem={({ item }) => (
          <View style={styles.chipWrap}>
            <Chip
              label={curriculumChipLabel(item)}
              selected={curriculumId === item.id}
              onPress={() => onCurriculumChange(item.id)}
            />
          </View>
        )}
      />

      {selectedCurriculum ? (
        <>
          {isLimitedCurriculum(selectedCurriculum) ? (
            <InfoCard>
              {selectedCurriculum.name} only includes early years classes
              (up to about grade 5). Select CBSE or SSC above for classes 6–12.
            </InfoCard>
          ) : null}

          <FieldLabel>
            Class / grade ({selectedCurriculum.name})
          </FieldLabel>
          <Text style={styles.gradeHint}>
            {selectedCurriculum.grades.length} classes available — scroll to see
            all.
          </Text>
          <ScrollView
            nestedScrollEnabled
            style={styles.gradeScroll}
            contentContainerStyle={styles.gradeGrid}
            keyboardShouldPersistTaps="handled"
          >
            {selectedCurriculum.grades.map((g) => (
              <View key={g.id} style={styles.gradeCell}>
                <Chip
                  label={g.label}
                  selected={gradeId === g.id}
                  onPress={() => onGradeChange(g.id)}
                />
              </View>
            ))}
          </ScrollView>
        </>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  dobField: { marginBottom: 16 },
  chipRow: { flexDirection: "row", marginBottom: 16 },
  chipWrap: { marginRight: 8 },
  curriculumHint: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 10,
  },
  gradeHint: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 10,
  },
  gradeScroll: {
    maxHeight: 220,
    marginBottom: 8,
  },
  gradeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingBottom: 8,
  },
  gradeCell: { minWidth: "30%" },
});
