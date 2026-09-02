// src/screens/ReaderPreferencesScreen.AccessibilitySection.tsx
// The Accessibility section of the reader preferences screen — Khushi.
//
// A PART, NOT A SHARED COMPONENT (CONVENTIONS §1), same reasoning as the four
// sections beside it: one consumer, one file, one import and one line added to
// the screen.
//
// PROPS IN, CALLBACKS OUT (§3). No store, no hook — the screen owns
// `useReaderPrefs` and hands down `prefs.accessibility` plus the twelve
// `on<Event>` callbacks below.
//
// NO NEW COMPONENTS (§10). Ten toggles are `ListRow variant="toggle"`, which
// already wraps a `Switch`; the multiplier is the same `Slider` Typography
// uses; reduce motion is the same segmented `Tabs` every other picker on this
// screen uses. Nothing here needed a primitive that did not exist.
//
// FOUR GROUPS, TWELVE CONTROLS, AND NO TTS. `accessibility.tts` is declared in
// the contract and is Ahana's, driven from the in-reader TtsControls panel —
// this file must not render a TTS section or expose any of its seven fields.
// The group is not read here at all.
//
// REDUCE MOTION STAYS A STRING ON THIS SURFACE. `activeId` is the raw
// 'system' | 'on' | 'off' and `onChange` hands the same back. Resolving it to
// an effective boolean against live OS state is the reader's job — collapsing
// it here would destroy the difference between "follow the OS" and "off",
// which is the entire reason the field is a tri-state rather than a checkbox.
//
// CONSTRAINING VALUES IS THE HOOK'S JOB, NOT THIS FILE'S. The multiplier's
// clamp lives in `useReaderPrefs`, for the reason stated above the Typography
// callbacks: the slider bounds only constrain what a drag can produce. This
// file forwards what the control reports and nothing more.
import { StyleSheet, Text, View } from 'react-native';

import { ListRow } from '@components/ListRow';
import { SectionHeader } from '@components/SectionHeader';
import { Slider } from '@components/Slider';
import { Tabs } from '@components/Tabs';
import type { AccessibilityPrefs, ReduceMotion } from '@/shared/contracts';
import { color, space, type as typeScale } from '@theme/tokens';

import {
  FONT_SCALE_MULTIPLIER,
  REDUCE_MOTION_OPTIONS,
} from '@/features/personalization/prefsOptions';

export interface AccessibilitySectionProps {
  accessibility: AccessibilityPrefs;
  onToggleDyslexiaFont: (enabled: boolean) => void;
  onToggleRespectOsFontScale: (enabled: boolean) => void;
  onToggleReadableSpacing: (enabled: boolean) => void;
  onChangeFontScaleMultiplier: (multiplier: number) => void;
  onToggleBoldText: (enabled: boolean) => void;
  onToggleHighContrast: (enabled: boolean) => void;
  onToggleLargeTouchTargets: (enabled: boolean) => void;
  onToggleLargeAudioControls: (enabled: boolean) => void;
  onSelectReduceMotion: (reduceMotion: ReduceMotion) => void;
  onToggleAnnouncePageChanges: (enabled: boolean) => void;
  onToggleAnnounceChapterChanges: (enabled: boolean) => void;
  onToggleScreenReaderHints: (enabled: boolean) => void;
}

export default function AccessibilitySection({
  accessibility,
  onToggleDyslexiaFont,
  onToggleRespectOsFontScale,
  onToggleReadableSpacing,
  onChangeFontScaleMultiplier,
  onToggleBoldText,
  onToggleHighContrast,
  onToggleLargeTouchTargets,
  onToggleLargeAudioControls,
  onSelectReduceMotion,
  onToggleAnnouncePageChanges,
  onToggleAnnounceChapterChanges,
  onToggleScreenReaderHints,
}: AccessibilitySectionProps) {
  const { text, display, announce } = accessibility;

  return (
    <View style={styles.section} testID="accessibility-section">
      <SectionHeader title="Accessibility" />

      {/* ── Text ────────────────────────────────────────────────────────── */}
      <View style={styles.group} testID="accessibility-text-group">
        <SectionHeader title="Text" />
        <ListRow
          title="Dyslexia-friendly font"
          subtitle="Use OpenDyslexic for book content."
          variant="toggle"
          toggleValue={text.dyslexiaFont}
          onToggleChange={onToggleDyslexiaFont}
        />
        <ListRow
          title="Match device text size"
          subtitle="Follow the text size set in your device settings."
          variant="toggle"
          toggleValue={text.respectOsFontScale}
          onToggleChange={onToggleRespectOsFontScale}
        />
        <ListRow
          title="Readable spacing"
          subtitle="Looser line and word spacing."
          variant="toggle"
          toggleValue={text.readableSpacing}
          onToggleChange={onToggleReadableSpacing}
        />

        <View style={styles.control}>
          <SectionHeader title="Text scale" />
          {/* "On top of", not "instead of" — the contract is explicit that this
              multiplies the OS scale rather than replacing it, and a reader who
              has both on should be able to predict the result. */}
          <Text style={styles.hint}>Applied on top of your device text size.</Text>
          <Slider
            testID="accessibility-font-scale-slider"
            value={text.fontScaleMultiplier}
            minimumValue={FONT_SCALE_MULTIPLIER.min}
            maximumValue={FONT_SCALE_MULTIPLIER.max}
            step={FONT_SCALE_MULTIPLIER.step}
            onSlidingComplete={onChangeFontScaleMultiplier}
          />
          <Text style={styles.readout}>{text.fontScaleMultiplier.toFixed(1)}×</Text>
        </View>
      </View>

      {/* ── Display ─────────────────────────────────────────────────────── */}
      <View style={styles.group} testID="accessibility-display-group">
        <SectionHeader title="Display" />
        <ListRow
          title="Bold text"
          subtitle="Heavier weight throughout."
          variant="toggle"
          toggleValue={display.boldText}
          onToggleChange={onToggleBoldText}
        />
        {/* THE ONLY CONTRAST CONTROL IN THE APP. The Theme picker deliberately
            offers Light/Dark/Sepia/System and not the deprecated 'highContrast'
            theme — contrast is independent of theme, so dark plus high contrast
            is a valid combination. See THEME_OPTIONS. */}
        <ListRow
          title="High contrast"
          subtitle="Stronger contrast. Works with any theme."
          variant="toggle"
          toggleValue={display.highContrast}
          onToggleChange={onToggleHighContrast}
        />
        <ListRow
          title="Large touch targets"
          subtitle="Bigger hit areas for reader controls."
          variant="toggle"
          toggleValue={display.largeTouchTargets}
          onToggleChange={onToggleLargeTouchTargets}
        />
        <ListRow
          title="Large audio controls"
          subtitle="Bigger playback controls."
          variant="toggle"
          toggleValue={display.largeAudioControls}
          onToggleChange={onToggleLargeAudioControls}
        />

        <View style={styles.control}>
          <SectionHeader title="Reduce motion" />
          <Text style={styles.hint}>
            System follows your device setting. On and Off override it.
          </Text>
          <Tabs
            tabs={[...REDUCE_MOTION_OPTIONS]}
            activeId={display.reduceMotion}
            variant="segmented"
            onChange={(id) => onSelectReduceMotion(id as ReduceMotion)}
          />
        </View>
      </View>

      {/* ── Announce ────────────────────────────────────────────────────── */}
      <View style={styles.group} testID="accessibility-announce-group">
        <SectionHeader title="Screen reader announcements" />
        <ListRow
          title="Page changes"
          subtitle="Announce each page turn."
          variant="toggle"
          toggleValue={announce.pageChanges}
          onToggleChange={onToggleAnnouncePageChanges}
        />
        <ListRow
          title="Chapter changes"
          subtitle="Announce when a new chapter starts."
          variant="toggle"
          toggleValue={announce.chapterChanges}
          onToggleChange={onToggleAnnounceChapterChanges}
        />
      </View>

      {/* ── Screen reader hints (top level, not a sub-block) ────────────── */}
      <View style={styles.group} testID="accessibility-hints-group">
        {/* THE LIMIT IS IN THE COPY, NOT ONLY IN THE CONTRACT. Hruthik asks for
            this explicitly: the flag reaches native controls only and cannot
            touch EPUB content inside the WebView, whose accessibility tree comes
            from the DOM. Wording it as if it improved book-content
            accessibility generally would be a promise the setting cannot keep. */}
        <ListRow
          title="Extra screen reader hints"
          subtitle="Adds labels to app controls. Does not change book content."
          variant="toggle"
          toggleValue={accessibility.screenReaderHints}
          onToggleChange={onToggleScreenReaderHints}
        />
        <Text style={styles.note}>
          Applies to this app&rsquo;s own buttons and menus only. Text inside a book is provided by
          the publisher and is not affected.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // No outer margin — the screen owns where the section sits (§8). `lg` between
  // groups rather than the `md` Typography uses: this section holds four named
  // groups rather than four sibling controls, so the grouping has to read as
  // structure and not as a long list.
  section: {
    gap: space.lg,
  },
  group: {
    gap: space.sm,
  },
  // A single control that needs its own header and readout inside a group.
  control: {
    gap: space.sm,
  },
  hint: {
    fontWeight: typeScale.smallLabel.weight,
    fontSize: typeScale.smallLabel.size,
    lineHeight: typeScale.smallLabel.lineHeight,
    color: color.textSecondary,
  },
  note: {
    fontWeight: typeScale.smallLabel.weight,
    fontSize: typeScale.smallLabel.size,
    lineHeight: typeScale.smallLabel.lineHeight,
    color: color.textSecondary,
  },
  readout: {
    fontWeight: typeScale.meta.weight,
    fontSize: typeScale.meta.size,
    lineHeight: typeScale.meta.lineHeight,
    color: color.textSecondary,
  },
});
