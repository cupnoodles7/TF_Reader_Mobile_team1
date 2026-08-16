// src/gallery/StateGallery.test.tsx
//
// StateGallery is dev tooling (CONVENTIONS §9), but the switcher itself is real
// logic: one section mounted at a time, selected from a fixed list of tab
// buttons. This PR inserted a new tab — 'resolveAccess' — between 'ActionBar'
// and 'CategoryCard', so what is worth pinning here is that the insertion did
// not break the switcher: every tab still renders, still toggles
// `accessibilityState.selected`, and still unmounts the previous section rather
// than stacking two galleries on screen at once.
//
// `await render(...)` is required — RTL 14's render is async.
import { fireEvent, render, screen } from '@testing-library/react-native';

import StateGallery from './StateGallery';

describe('StateGallery', () => {
  it('starts on the Skeleton section, with its tab marked selected', async () => {
    await render(<StateGallery />);

    expect(screen.getByRole('button', { name: 'Skeleton' }).props.accessibilityState).toMatchObject(
      { selected: true },
    );
    expect(screen.getByRole('button', { name: 'ActionBar' }).props.accessibilityState).toMatchObject(
      { selected: false },
    );
    // SkeletonGallery's own content, distinct from the tab label of the same name.
    expect(screen.getByText('block — 200 x 80')).toBeTruthy();
  });

  // The tab this PR added. It sits between ActionBar and CategoryCard in the
  // switcher, and it is the only surface that renders `resolveAccess` resolving
  // real inputs rather than a hand-typed list of buttons.
  describe('the resolveAccess tab', () => {
    it('renders a tab for it', async () => {
      await render(<StateGallery />);
      expect(screen.getByRole('button', { name: 'resolveAccess' })).toBeTruthy();
    });

    it('mounts ResolveAccessGallery when pressed, and unmounts the previous section', async () => {
      await render(<StateGallery />);

      fireEvent.press(screen.getByRole('button', { name: 'resolveAccess' }));

      // Distinctive body copy from resolveAccess.gallery.tsx — not the heading,
      // which shares its text with the tab label and would match twice.
      expect(
        screen.getByText('Inputs are literals; every answer below came out of the real resolver.'),
      ).toBeTruthy();
      // The previous section's content is gone, not merely hidden behind it.
      expect(screen.queryByText('block — 200 x 80')).toBeNull();
    });

    it('marks the resolveAccess tab selected and the previous tab not selected', async () => {
      await render(<StateGallery />);

      fireEvent.press(screen.getByRole('button', { name: 'resolveAccess' }));

      expect(
        screen.getByRole('button', { name: 'resolveAccess' }).props.accessibilityState,
      ).toMatchObject({ selected: true });
      expect(
        screen.getByRole('button', { name: 'Skeleton' }).props.accessibilityState,
      ).toMatchObject({ selected: false });
    });
  });

  it('switches between sections without stacking their content', async () => {
    await render(<StateGallery />);

    fireEvent.press(screen.getByRole('button', { name: 'ActionButton' }));
    // Distinctive body copy, not the heading — the heading shares its text with
    // the tab label and would match twice while this section is active.
    expect(screen.getByText('Last pressed: nothing yet')).toBeTruthy();
    expect(screen.queryByText('block — 200 x 80')).toBeNull();

    fireEvent.press(screen.getByRole('button', { name: 'resolveAccess' }));
    expect(
      screen.getByText('Inputs are literals; every answer below came out of the real resolver.'),
    ).toBeTruthy();
    // ActionButtonGallery's content is gone once its section is no longer active.
    expect(screen.queryByText('Last pressed: nothing yet')).toBeNull();

    fireEvent.press(screen.getByRole('button', { name: 'Skeleton' }));
    expect(screen.getByText('block — 200 x 80')).toBeTruthy();
  });

  // A full regression check on the switcher's contents: every section the app
  // declares still has a tab, in particular the two immediate neighbours of the
  // one this PR inserted.
  it('still renders a tab for every declared section', async () => {
    await render(<StateGallery />);

    [
      'Skeleton',
      'TopAppBar',
      'BottomTabBar',
      'BottomSheet',
      'OfflineBanner',
      'EmptyState',
      'ErrorState',
      'SearchInput',
      'AccessTierBadge',
      'FilterChip',
      'InstitutionRow',
      'ListRow',
      'SectionHeader',
      'VoiceOverlay',
      'InstitutionDetailView',
      'ActionButton',
      'ActionBar',
      'resolveAccess',
      'CategoryCard',
      'ContentCard',
      'SubjectChip',
      'Tabs',
    ].forEach((name) => {
      expect(screen.getByRole('button', { name })).toBeTruthy();
    });
  });
});