// src/screens/ReaderPreferencesScreen.test.tsx
// Reader preferences — the screen, its two sections, and Restore defaults.
//
// DRIVEN THROUGH THE HOOK SEAM, NOT AROUND IT. Every test injects a fake
// `PrefsSource` via the screen's `prefsSource` prop and asserts on what reached
// it. Nothing here mocks `useReaderPrefs`: mocking the hook would test that the
// screen calls a function, where injecting the source tests that a tap becomes
// the right write. The hook's own rules — the nested-group spread, the
// optimistic rollback — are covered in useReaderPrefs.test.ts.
//
// `await render(...)` is required — RTL 14's render is async. See App.test.tsx.
// `await act(async () => ...)` where a callback has to be fired outside a press;
// a bare synchronous `act()` corrupts every later render in the file. See the
// header of useReaderPrefs.test.ts, which records why.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';

import { DEFAULT_PREFS } from '@/shared/contracts';
import type { PrefsSource, PrefsValues } from '@/features/personalization/useReaderPrefs';
import {
  FONT_FAMILY_OPTIONS,
  TEXT_SIZE_OPTIONS,
  THEME_OPTIONS,
} from '@/features/personalization/prefsOptions';

import ReaderPreferencesScreen from './ReaderPreferencesScreen';

// Offline is the screen's own axis, read from `useNetworkStatus` rather than from
// the hook — prefs are local-first, so connectivity never gates a write. Mocked
// so the banner and the "controls stay live" rule can both be asserted.
const mockIsOnline = jest.fn(() => true);
jest.mock('@hooks/useNetworkStatus', () => ({
  useNetworkStatus: () => mockIsOnline(),
}));

const STORED: PrefsValues = {
  ...DEFAULT_PREFS,
  theme: 'sepia',
  font: { family: 'Lora', customFontUri: 'file:///fonts/custom.ttf' },
};

function fakeSource(overrides: Partial<PrefsSource> = {}): PrefsSource {
  return {
    getPrefs: jest.fn(() => Promise.resolve(STORED)),
    savePrefs: jest.fn(() => Promise.resolve()),
    resetPrefs: jest.fn(() => Promise.resolve()),
    subscribe: jest.fn(() => () => {}),
    ...overrides,
  };
}

/** Renders and waits for the first read to land. */
async function renderReady(source: PrefsSource) {
  await render(<ReaderPreferencesScreen prefsSource={source} />);
  await waitFor(() => expect(screen.getByText('Theme')).toBeTruthy());
}

// SCOPED QUERIES, AND NOT FOR NEATNESS. `Tabs` hardcodes `testID="tabs"` and
// `tabs-tab-<id>`, this screen renders two of them, and BOTH have a 'system'
// option — so `tabs-tab-system` and the label "System" are genuinely ambiguous
// at screen level. Every option assertion below scopes to its own section.
const themeSection = () => within(screen.getByTestId('theme-section'));
const fontSection = () => within(screen.getByTestId('font-section'));
const typographySection = () => within(screen.getByTestId('typography-section'));

afterEach(() => {
  mockIsOnline.mockReturnValue(true);
});

describe('ReaderPreferencesScreen structure', () => {
  it('renders Theme, Font, Layout and Typography sections', async () => {
    await renderReady(fakeSource());

    expect(screen.getByText('Theme')).toBeTruthy();
    expect(screen.getByText('Font')).toBeTruthy();
    expect(screen.getByText('Reading style')).toBeTruthy();
    expect(screen.getByText('Page view')).toBeTruthy();
    expect(screen.getByTestId('typography-section')).toBeTruthy();
  });

  // Never rendered: identity and sync plumbing, plus zoom and the accessibility
  // flags, which belong to other surfaces.
  it('renders none of the fields this screen must not show', async () => {
    await renderReady(fakeSource());

    for (const forbidden of [/zoom/i, /userId/i, /updatedAt/i, /isDeleted/i, /synced/i]) {
      expect(screen.queryByText(forbidden)).toBeNull();
    }
  });
});

describe('ReaderPreferencesScreen theme section', () => {
  it('offers exactly the four theme options', async () => {
    await renderReady(fakeSource());

    for (const option of THEME_OPTIONS) {
      expect(themeSection().getByTestId(`tabs-tab-${option.id}`)).toBeTruthy();
      expect(themeSection().getByText(option.label)).toBeTruthy();
    }
  });

  // `highContrast` is a real member of the contract's Theme union, deliberately
  // not offered: it pairs with `AccessibilityPrefs.highContrast`, which prefs.ts
  // marks as pending Hruthik's sign-off.
  // SCOPED TO THE THEME SECTION, and it was not always. This used to query the
  // whole screen, which was equivalent while nothing else could render the
  // words — Accessibility now legitimately does, as the ONE contrast control
  // (Hruthik's contract, FINAL 2026-09-02: contrast is independent of theme, so
  // dark plus high contrast is valid).
  //
  // THE ASSERTION IS NOT WEAKENED BY THE NARROWING. What it always meant is
  // "the Theme picker must not offer highContrast as a theme", and that is
  // exactly what it still checks. The companion assertion below then pins the
  // other half — that the setting does exist, once, somewhere else — so the two
  // together are stricter than the original single query.
  it('does not offer high contrast as a theme', async () => {
    await renderReady(fakeSource());

    const themeSection = within(screen.getByTestId('theme-section'));
    expect(themeSection.queryByText(/high.?contrast/i)).toBeNull();
  });

  it('offers high contrast exactly once, in Accessibility rather than Theme', async () => {
    await renderReady(fakeSource());

    const matches = screen.getAllByText(/high.?contrast/i);
    expect(matches).toHaveLength(1);
    expect(within(screen.getByTestId('accessibility-display-group')).getByText('High contrast')).toBeTruthy();
  });

  it('marks the stored theme as the selected option', async () => {
    await renderReady(fakeSource());

    expect(themeSection().getByTestId('tabs-tab-sepia').props.accessibilityState.selected).toBe(
      true,
    );
    expect(themeSection().getByTestId('tabs-tab-light').props.accessibilityState.selected).toBe(
      false,
    );
  });

  it('writes the picked theme through the seam', async () => {
    const source = fakeSource();
    await renderReady(source);

    fireEvent.press(themeSection().getByText('Dark'));

    expect(source.savePrefs).toHaveBeenCalledWith({ theme: 'dark' });
  });

  // A theme set from another device, or from the accessibility surface. `Tabs`
  // renders nothing active, which is right — a wrong highlight is worse than
  // none — and the section says so rather than looking broken.
  it('selects nothing and explains itself when the stored theme is not an option', async () => {
    const source = fakeSource({
      getPrefs: jest.fn(() => Promise.resolve({ ...STORED, theme: 'highContrast' as const })),
    });
    await renderReady(source);

    for (const option of THEME_OPTIONS) {
      expect(
        themeSection().getByTestId(`tabs-tab-${option.id}`).props.accessibilityState.selected,
      ).toBe(false);
    }
    expect(screen.getByText(/set elsewhere/i)).toBeTruthy();
  });
});

describe('ReaderPreferencesScreen font section', () => {
  // The seven options live inside a `BottomSheet`, which renders nothing
  // until opened — see BottomSheet.test.tsx. `waitFor` covers its own
  // setTimeout(0)-then-animate open, the same way ShelfScreen.test.tsx waits
  // out FilterSortSheet.
  async function openFontPicker() {
    fireEvent.press(fontSection().getByTestId('font-picker-trigger'));
    await waitFor(() => expect(screen.getByTestId('font-picker-sheet')).toBeTruthy());
  }

  it('shows the stored family on the trigger', async () => {
    await renderReady(fakeSource());

    expect(fontSection().getByText('Lora')).toBeTruthy();
  });

  // Scoped to the section — Typography carries its own "EPUB only" hint too,
  // so an unscoped query here would be ambiguous.
  it('says the choice is EPUB only', async () => {
    await renderReady(fakeSource());

    expect(fontSection().getByText(/EPUB only/i)).toBeTruthy();
  });

  it('offers exactly the seven provisional font options once opened', async () => {
    await renderReady(fakeSource());
    await openFontPicker();

    for (const option of FONT_FAMILY_OPTIONS) {
      expect(screen.getByTestId(`font-option-${option.id}`)).toBeTruthy();
    }
  });

  it('marks the stored family as the selected option', async () => {
    await renderReady(fakeSource());
    await openFontPicker();

    expect(screen.getByTestId('font-option-Lora').props.accessibilityState.selected).toBe(true);
  });

  // The screen's half of the hook's spread rule: the write must carry the
  // family the reader picked AND keep the custom font URI they already had.
  it('writes the picked family through the seam without dropping customFontUri', async () => {
    const source = fakeSource();
    await renderReady(source);
    await openFontPicker();

    fireEvent.press(screen.getByTestId('font-option-Merriweather'));

    expect(source.savePrefs).toHaveBeenCalledWith({
      font: { family: 'Merriweather', customFontUri: 'file:///fonts/custom.ttf' },
    });
  });

  it('closes the sheet once a font is picked', async () => {
    await renderReady(fakeSource());
    await openFontPicker();

    fireEvent.press(screen.getByTestId('font-option-Merriweather'));

    await waitFor(() => expect(screen.queryByTestId('font-picker-sheet')).toBeNull());
  });

  it('selects nothing and names the current face when it is not an option', async () => {
    const source = fakeSource({
      getPrefs: jest.fn(() => Promise.resolve({ ...STORED, font: { family: 'Georgia' } })),
    });
    await renderReady(source);

    // Exact match: the note below also mentions "Georgia" in a sentence, and
    // an exact string match does not confuse the two.
    expect(fontSection().getByText('Georgia')).toBeTruthy();
    expect(fontSection().getByText(/is not one of these options/i)).toBeTruthy();

    await openFontPicker();
    for (const option of FONT_FAMILY_OPTIONS) {
      expect(
        screen.getByTestId(`font-option-${option.id}`).props.accessibilityState.selected,
      ).toBe(false);
    }
  });
});

describe('ReaderPreferencesScreen typography section', () => {
  it('offers exactly the six text size presets', async () => {
    await renderReady(fakeSource());

    for (const option of TEXT_SIZE_OPTIONS) {
      expect(typographySection().getByTestId(`tabs-tab-${option.id}`)).toBeTruthy();
    }
  });

  it('says the choice is EPUB only', async () => {
    await renderReady(fakeSource());

    expect(typographySection().getByText(/EPUB only/i)).toBeTruthy();
  });

  it('marks the stored text size as the selected preset', async () => {
    await renderReady(fakeSource());

    // STORED carries DEFAULT_PREFS.typography, so size 16.
    expect(
      typographySection().getByTestId('tabs-tab-16').props.accessibilityState.selected,
    ).toBe(true);
  });

  // A value from outside the six presets — another device, or a value this
  // picker predates. Same handling as Theme's `highContrast` case.
  it('selects nothing and explains itself when the stored text size is not a preset', async () => {
    const source = fakeSource({
      getPrefs: jest.fn(() =>
        Promise.resolve({ ...STORED, typography: { ...STORED.typography, size: 15 } }),
      ),
    });
    await renderReady(source);

    for (const option of TEXT_SIZE_OPTIONS) {
      expect(
        typographySection().getByTestId(`tabs-tab-${option.id}`).props.accessibilityState.selected,
      ).toBe(false);
    }
    expect(screen.getByText(/set elsewhere/i)).toBeTruthy();
  });

  it('writes the picked text size through the seam, spreading the group', async () => {
    const source = fakeSource();
    await renderReady(source);

    fireEvent.press(typographySection().getByText('20pt'));

    expect(source.savePrefs).toHaveBeenCalledWith({
      typography: { size: 20, lineHeight: 1.5, spacing: 0, margins: 16 },
    });
  });

  it('renders a slider for line height, letter spacing and page margins', async () => {
    await renderReady(fakeSource());

    expect(typographySection().getByTestId('typography-line-height-slider')).toBeTruthy();
    expect(typographySection().getByTestId('typography-letter-spacing-slider')).toBeTruthy();
    expect(typographySection().getByTestId('typography-margins-slider')).toBeTruthy();
  });

  // Save-on-release: the section wires the slider's release event straight to
  // the seam, spreading the rest of the typography group.
  it('writes the released line height through the seam, spreading the group', async () => {
    const source = fakeSource();
    await renderReady(source);

    fireEvent(
      typographySection().getByTestId('typography-line-height-slider'),
      'slidingComplete',
      1.8,
    );

    expect(source.savePrefs).toHaveBeenCalledWith({
      typography: { size: 16, lineHeight: 1.8, spacing: 0, margins: 16 },
    });
  });

  it('writes the released letter spacing through the seam, spreading the group', async () => {
    const source = fakeSource();
    await renderReady(source);

    fireEvent(
      typographySection().getByTestId('typography-letter-spacing-slider'),
      'slidingComplete',
      2,
    );

    expect(source.savePrefs).toHaveBeenCalledWith({
      typography: { size: 16, lineHeight: 1.5, spacing: 2, margins: 16 },
    });
  });

  it('writes the released page margins through the seam, spreading the group', async () => {
    const source = fakeSource();
    await renderReady(source);

    fireEvent(
      typographySection().getByTestId('typography-margins-slider'),
      'slidingComplete',
      32,
    );

    expect(source.savePrefs).toHaveBeenCalledWith({
      typography: { size: 16, lineHeight: 1.5, spacing: 0, margins: 32 },
    });
  });
});

describe('ReaderPreferencesScreen restore defaults', () => {
  it('offers the action', async () => {
    await renderReady(fakeSource());

    expect(screen.getByRole('button', { name: 'Restore defaults' })).toBeTruthy();
  });

  it('calls resetPrefs, and does not write the groups one at a time', async () => {
    const source = fakeSource();
    await renderReady(source);

    fireEvent.press(screen.getByText('Restore defaults'));

    expect(source.resetPrefs).toHaveBeenCalledTimes(1);
    expect(source.savePrefs).not.toHaveBeenCalled();
  });

  it('returns the controls to the contract defaults', async () => {
    await renderReady(fakeSource());

    fireEvent.press(screen.getByText('Restore defaults'));

    // DEFAULT_PREFS is theme 'system' and family 'system' — one per section,
    // which is exactly why these queries have to be scoped.
    await waitFor(() =>
      expect(themeSection().getByTestId('tabs-tab-system').props.accessibilityState.selected).toBe(
        true,
      ),
    );
    // Font's own control is a picker trigger, not a `Tabs` bar — the reset
    // shows up as the trigger's displayed value rather than a selected segment.
    expect(fontSection().getByText('System')).toBeTruthy();
  });
});

describe('ReaderPreferencesScreen states', () => {
  it('renders skeletons, and no controls, while the first read is in flight', async () => {
    const source = fakeSource({ getPrefs: jest.fn(() => new Promise<PrefsValues>(() => {})) });
    await render(<ReaderPreferencesScreen prefsSource={source} />);

    expect(screen.getByTestId('reader-prefs-skeleton')).toBeTruthy();
    expect(screen.queryByText('Theme')).toBeNull();
  });

  it('renders an error with a retry when the read fails', async () => {
    const source = fakeSource({ getPrefs: jest.fn(() => Promise.reject(new Error('nope'))) });
    await render(<ReaderPreferencesScreen prefsSource={source} />);

    await waitFor(() =>
      expect(screen.getByText("We couldn't load your reading preferences.")).toBeTruthy(),
    );
    expect(screen.getByRole('button', { name: /retry/i })).toBeTruthy();
  });

  it('recovers when retry succeeds', async () => {
    const getPrefs = jest
      .fn()
      .mockRejectedValueOnce(new Error('nope'))
      .mockResolvedValueOnce(STORED);
    await render(<ReaderPreferencesScreen prefsSource={fakeSource({ getPrefs })} />);

    await waitFor(() => expect(screen.getByRole('button', { name: /retry/i })).toBeTruthy());
    fireEvent.press(screen.getByRole('button', { name: /retry/i }));

    await waitFor(() => expect(screen.getByText('Theme')).toBeTruthy());
  });

  // OFFLINE IS NOT A BLOCKING STATE. Prefs are written locally and reconciled by
  // LWW on `updatedAt`, so the banner is informational and every control stays
  // live behind it. This is the test that stops someone "fixing" the screen by
  // disabling it offline.
  it('shows the offline banner and keeps every control usable behind it', async () => {
    mockIsOnline.mockReturnValue(false);
    const source = fakeSource();
    await renderReady(source);

    expect(screen.getByText(/offline/i)).toBeTruthy();

    fireEvent.press(themeSection().getByText('Dark'));
    expect(source.savePrefs).toHaveBeenCalledWith({ theme: 'dark' });
  });

  it('reports a failed write inline, leaving the screen on its content', async () => {
    const source = fakeSource({ savePrefs: jest.fn(() => Promise.reject(new Error('nope'))) });
    await renderReady(source);

    fireEvent.press(themeSection().getByText('Dark'));

    await waitFor(() => expect(screen.getByText(/didn't save/i)).toBeTruthy());
    // Still the content, not an error page — the values on screen are correct
    // because the hook rolled the failed one back.
    expect(screen.getByText('Theme')).toBeTruthy();
    expect(themeSection().getByTestId('tabs-tab-sepia').props.accessibilityState.selected).toBe(
      true,
    );
  });
});

describe('ReaderPreferencesScreen accessibility', () => {
  it('announces each section heading as a header', async () => {
    await renderReady(fakeSource());

    const headers = screen.getAllByRole('header');
    const labels = headers.map((header) => header.props.children);

    expect(labels).toContain('Theme');
    expect(labels).toContain('Font');
  });

  it('announces the selected option, so the current value is not colour-only', async () => {
    await renderReady(fakeSource());

    expect(themeSection().getByTestId('tabs-tab-sepia').props.accessibilityState.selected).toBe(
      true,
    );
  });

  it('announces Restore defaults as a button under its visible name', async () => {
    await renderReady(fakeSource());

    expect(screen.getByRole('button', { name: 'Restore defaults' })).toBeTruthy();
  });

  it('announces a failed write as an alert', async () => {
    const source = fakeSource({ savePrefs: jest.fn(() => Promise.reject(new Error('nope'))) });
    await renderReady(source);

    fireEvent.press(themeSection().getByText('Dark'));

    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
  });
});

// ─── 5 · Accessibility (Hruthik's contract, FINAL 2026-09-02) ────────────────
//
// TWELVE CONTROLS, FOUR GROUPS, AND NO TTS. The last of those is asserted
// explicitly rather than left implicit: `accessibility.tts` is a real group on
// the record that this screen must never surface, so "it is not rendered" is a
// property worth a failing test if someone adds it.
//
// THE TRI-STATE IS THE POINT OF MOST OF THESE. `reduceMotion` is the one field
// on this screen that a well-meaning change could quietly turn into a boolean,
// so it is pinned from several directions: the stored default, both non-default
// selections, and the type of what actually reaches the seam.

const accessibilitySection = () => within(screen.getByTestId('accessibility-section'));
const textGroup = () => within(screen.getByTestId('accessibility-text-group'));
const displayGroup = () => within(screen.getByTestId('accessibility-display-group'));
const announceGroup = () => within(screen.getByTestId('accessibility-announce-group'));

// The accessibility defaults, reached through DEFAULT_PREFS rather than
// retyped, so a contract change moves these tests instead of silently passing
// against a stale copy.
const A11Y = DEFAULT_PREFS.accessibility;

describe('ReaderPreferencesScreen accessibility section', () => {
  it('renders all four groups', async () => {
    await renderReady(fakeSource());

    expect(screen.getByTestId('accessibility-text-group')).toBeTruthy();
    expect(screen.getByTestId('accessibility-display-group')).toBeTruthy();
    expect(screen.getByTestId('accessibility-announce-group')).toBeTruthy();
    expect(screen.getByTestId('accessibility-hints-group')).toBeTruthy();
  });

  it('renders all twelve controls', async () => {
    await renderReady(fakeSource());

    const a11y = accessibilitySection();
    // Ten toggles…
    [
      'Dyslexia-friendly font',
      'Match device text size',
      'Readable spacing',
      'Bold text',
      'High contrast',
      'Large touch targets',
      'Large audio controls',
      'Page changes',
      'Chapter changes',
      'Extra screen reader hints',
    ].forEach((label) => expect(a11y.getByText(label)).toBeTruthy());

    // …one slider, one segmented picker.
    expect(a11y.getByTestId('accessibility-font-scale-slider')).toBeTruthy();
    expect(a11y.getByText('Reduce motion')).toBeTruthy();
  });

  it('shows every toggle at its contract default', async () => {
    await renderReady(fakeSource());

    // `ListRow` puts role="switch" on the ROW, not on the inner RN Switch, and
    // exposes its state as `accessibilityState.checked` — see ListRow.test.tsx.
    const checked = (group: ReturnType<typeof within>, label: string) =>
      group.getByRole('switch', { name: label }).props.accessibilityState.checked;

    // The three that default ON are the interesting ones — a blanket "all
    // false" would pass against a record that had lost them.
    expect(checked(textGroup(), 'Match device text size')).toBe(true);
    expect(checked(announceGroup(), 'Page changes')).toBe(true);
    expect(checked(announceGroup(), 'Chapter changes')).toBe(true);

    expect(checked(textGroup(), 'Dyslexia-friendly font')).toBe(false);
    expect(checked(displayGroup(), 'High contrast')).toBe(false);
  });

  it('defaults pageChanges and chapterChanges to true in the contract itself', () => {
    // Guards the defaults at the source, not just at the render — a screen test
    // alone would still pass if both the default and the assertion were flipped.
    expect(A11Y.announce.pageChanges).toBe(true);
    expect(A11Y.announce.chapterChanges).toBe(true);
  });

  it('shows the font scale multiplier at 1.0', async () => {
    await renderReady(fakeSource());

    expect(A11Y.text.fontScaleMultiplier).toBe(1.0);
    expect(accessibilitySection().getByTestId('accessibility-font-scale-slider').props.value).toBe(
      1.0,
    );
    expect(accessibilitySection().getByText('1.0×')).toBeTruthy();
  });

  it("defaults reduceMotion to 'system'", async () => {
    await renderReady(fakeSource());

    expect(A11Y.display.reduceMotion).toBe('system');
    expect(displayGroup().getByTestId('tabs-tab-system').props.accessibilityState.selected).toBe(
      true,
    );
  });

  it("selects 'on' and writes the raw string", async () => {
    const source = fakeSource();
    await renderReady(source);

    fireEvent.press(displayGroup().getByText('On'));

    expect(source.savePrefs).toHaveBeenCalledWith({
      accessibility: { ...A11Y, display: { ...A11Y.display, reduceMotion: 'on' } },
    });
  });

  it("selects 'off' and writes the raw string", async () => {
    const source = fakeSource();
    await renderReady(source);

    fireEvent.press(displayGroup().getByText('Off'));

    expect(source.savePrefs).toHaveBeenCalledWith({
      accessibility: { ...A11Y, display: { ...A11Y.display, reduceMotion: 'off' } },
    });
  });

  // THE ANTI-REGRESSION FOR THE ONE MISTAKE THIS FIELD INVITES. 'off' is falsy
  // in no useful sense and `false` is not a member of the union, but a
  // well-meaning `Boolean(...)` or `=== 'on'` somewhere on the path would still
  // typecheck at a cast. Assert the runtime type, not just the value.
  it('never coerces reduceMotion to a boolean', async () => {
    const source = fakeSource();
    await renderReady(source);

    fireEvent.press(displayGroup().getByText('Off'));

    const patch = (source.savePrefs as jest.Mock).mock.calls[0][0];
    expect(typeof patch.accessibility.display.reduceMotion).toBe('string');
    expect(patch.accessibility.display.reduceMotion).toBe('off');
  });

  // THE LOAD-BEARING ONE FOR THE TWO-LEVEL MERGE. Hruthik's contract warns the
  // top-level-replace rule "bites twice" here: a naive patch would wipe the
  // four sibling fields in `display` AND the sibling `text` / `announce` / `tts`
  // groups. Both levels are asserted.
  it('preserves siblings at both levels when one nested field changes', async () => {
    const source = fakeSource();
    await renderReady(source);

    fireEvent.press(displayGroup().getByText('On'));

    const patch = (source.savePrefs as jest.Mock).mock.calls[0][0];
    // Level 2 — the other four display fields survive.
    expect(patch.accessibility.display).toEqual({
      ...A11Y.display,
      reduceMotion: 'on',
    });
    // Level 1 — the sibling groups survive.
    expect(patch.accessibility.text).toEqual(A11Y.text);
    expect(patch.accessibility.announce).toEqual(A11Y.announce);
    expect(patch.accessibility.tts).toEqual(A11Y.tts);
    expect(patch.accessibility.screenReaderHints).toBe(A11Y.screenReaderHints);
  });

  it('preserves siblings when a top-level accessibility field changes', async () => {
    const source = fakeSource();
    await renderReady(source);

    fireEvent.press(
      within(screen.getByTestId('accessibility-hints-group')).getByRole('switch', {
        name: 'Extra screen reader hints',
      }),
    );

    expect(source.savePrefs).toHaveBeenCalledWith({
      accessibility: { ...A11Y, screenReaderHints: true },
    });
  });

  // CLAMPED IN THE HOOK, NOT BY THE SLIDER — the slider's own bounds only
  // constrain a drag, so the guard is asserted by driving the event past them
  // directly, which is exactly what another caller could do.
  it('clamps the font scale multiplier to the top of its range', async () => {
    const source = fakeSource();
    await renderReady(source);

    fireEvent(
      accessibilitySection().getByTestId('accessibility-font-scale-slider'),
      'slidingComplete',
      4.0,
    );

    const patch = (source.savePrefs as jest.Mock).mock.calls[0][0];
    expect(patch.accessibility.text.fontScaleMultiplier).toBe(1.5);
  });

  it('clamps the font scale multiplier to the bottom of its range', async () => {
    const source = fakeSource();
    await renderReady(source);

    fireEvent(
      accessibilitySection().getByTestId('accessibility-font-scale-slider'),
      'slidingComplete',
      0.1,
    );

    const patch = (source.savePrefs as jest.Mock).mock.calls[0][0];
    expect(patch.accessibility.text.fontScaleMultiplier).toBe(0.8);
  });

  it('says screen reader hints do not reach book content', async () => {
    await renderReady(fakeSource());

    const hints = within(screen.getByTestId('accessibility-hints-group'));
    expect(hints.getByText(/does not change book content/i)).toBeTruthy();
    expect(hints.getByText(/text inside a book .* is not affected/i)).toBeTruthy();
  });

  // `accessibility.tts` is Ahana's, driven from the in-reader TtsControls panel.
  // Named fields rather than a bare "TTS" query, so this fails loudly if any
  // one of them is surfaced.
  it('renders no TTS section or controls', async () => {
    await renderReady(fakeSource());

    expect(screen.queryByText(/text.to.speech|\bTTS\b/i)).toBeNull();
    [/voice/i, /\brate\b/i, /\bpitch\b/i, /background playback/i, /highlight mode/i].forEach(
      (pattern) => expect(screen.queryByText(pattern)).toBeNull(),
    );
  });
});
