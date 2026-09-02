// Screen 02 — Sign-in sheet (CAP-3).
// transparentModal, not BottomSheet — nesting a Modal inside transparentModal causes z-index issues on Android.
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as WebBrowser from 'expo-web-browser';

import ActionButton from '@components/ActionButton';
import ErrorState from '@components/ErrorState';
import OfflineBanner from '@components/OfflineBanner';
import { getAuthApiClient } from '@/config/auth';
import { useInstitutionStore } from '@store/institutionStore';
import { usePendingIntentStore } from '@store/pendingIntentStore';
import { useSessionStore } from '@store/sessionStore';
import { saveRefreshToken } from '@store/secureStorage';
import { useNetworkStatus } from '@hooks/useNetworkStatus';
import { color, radius, space, type as typeScale } from '@theme/tokens';
import type { CatalogueStackParamList } from '../navigation/types';

// Matches the backend's SamlAuthenticationSuccessHandler/FailureHandler deep link exactly
// (tfreader://auth/callback?code=... or ?error=...) — see app.json's "scheme": "tfreader".
const DEEP_LINK_CALLBACK = 'tfreader://auth/callback';

type Props = NativeStackScreenProps<CatalogueStackParamList, 'SignIn'>;

export default function SignInScreen({ navigation }: Props) {
  const institution = useInstitutionStore((s) => s.selectedInstitution);
  const takeIntent = usePendingIntentStore((s) => s.take);
  const setSession = useSessionStore((s) => s.setSession);
  const isOnline = useNetworkStatus();

  const [submitting, setSubmitting] = useState(false);
  const [signInError, setSignInError] = useState(false);

  const handleDismiss = useCallback(() => {
    if (submitting) return;
    navigation.goBack();
  }, [navigation, submitting]);

  const handleSignIn = useCallback(async () => {
    if (!institution || submitting || !isOnline) return;
    setSignInError(false);
    setSubmitting(true);
    try {
      const auth = getAuthApiClient();

      const { authorizationUrl } = await auth.beginSamlSignIn(institution.id);
      const result = await WebBrowser.openAuthSessionAsync(
        auth.resolveAuthorizationUrl(authorizationUrl),
        DEEP_LINK_CALLBACK,
      );

      if (result.type !== 'success') {
        // 'cancel' / 'dismiss' — the reader closed the browser themselves, not a failure.
        return;
      }

      const callbackUrl = new URL(result.url);
      const error = callbackUrl.searchParams.get('error');
      if (error) throw new Error(`SAML sign-in failed: ${error}`);

      const code = callbackUrl.searchParams.get('code');
      if (!code) throw new Error('SAML callback carried no code');

      const token = await auth.exchangeCode(code);
      const me = await auth.getMe(token.accessToken);

      await saveRefreshToken(token.refreshToken);
      setSession({
        accessToken: token.accessToken,
        expiresIn: token.expiresIn,
        userId: me.userId,
        institutionId: me.institutionId,
        roles: me.roles,
        collections: me.collections,
      });

      // `popTo`, NOT `navigate` — for the common case the same ItemDetail is
      // already in the stack underneath AccessGate and this screen (the reader
      // never left the app), and `navigate` does not reliably collapse back to
      // it, leaving a duplicate with a stranded sheet beneath. `popTo` pops to
      // the existing entry, and pushes a fresh one if it genuinely isn't there.
      const intent = takeIntent();
      if (intent?.action === 'read') {
        navigation.popTo('ItemDetail', { itemId: intent.itemId });
      } else {
        // No intent to replay — the dev "Sign in (test)" path lands here, and
        // a silent goBack() is indistinguishable from the flow failing
        // outright. This confirms the real token round trip actually happened.
        if (__DEV__) {
          // Logged, not just alerted — a screenshot of the alert is easy to mistranscribe
          // one character of a 200+ char token from; the Metro log is copy-pasteable exactly.
          console.log('[dev sign-in] accessToken:', token.accessToken);
          console.log('[dev sign-in] refreshToken:', token.refreshToken);
          Alert.alert('Signed in', `userId: ${me.userId}\nroles: ${me.roles.join(', ')}\n\nTokens printed to the Metro log.`);
        }
        navigation.goBack();
      }
    } catch {
      setSignInError(true);
    } finally {
      setSubmitting(false);
    }
  }, [institution, submitting, isOnline, navigation, takeIntent, setSession]);

  const handleRetry = useCallback(() => {
    handleSignIn();
  }, [handleSignIn]);

  // Guard: institution must be selected before this sheet is navigated to.
  // If the store is empty (shouldn't happen in normal flow), go back silently.
  useEffect(() => {
    if (!institution) navigation.goBack();
  }, [institution, navigation]);

  if (!institution) return null;

  return (
    <View style={styles.overlay}>
      <View style={styles.backdrop} />
      <Pressable style={StyleSheet.absoluteFill} onPress={handleDismiss} accessibilityLabel="Dismiss" />
      {/* Stop taps on the sheet from reaching the absoluteFill dismiss pressable.
          View + onStartShouldSetResponder claims the touch without wrapping children
          in an accessibility container (a default-accessible Pressable would group
          all children into one unit, hiding inner buttons from assistive technology). */}
      <View testID="sign-in-sheet" style={styles.sheet} onStartShouldSetResponder={() => true}>
        <View style={styles.handleArea}>
          <View style={styles.handle} />
        </View>

        <View style={styles.body}>
          <Text style={styles.heading}>Sign in</Text>

          {signInError ? (
            <ErrorState
              variant="not_ready"
              message="Sign-in could not be started. Please try again."
              onRetry={handleRetry}
            />
          ) : (
            <>
              <View style={styles.institutionBlock}>
                <Text style={styles.institutionName}>{institution.name}</Text>
                <Text style={styles.institutionMeta}>
                  {institution.city} · {institution.country}
                </Text>
              </View>

              <ActionButton
                action="signIn"
                state={submitting ? 'loading' : 'idle'}
                disabled={!isOnline}
                onPress={handleSignIn}
              />
            </>
          )}

          <Pressable
            style={styles.cancelButton}
            onPress={handleDismiss}
            accessibilityRole="button"
          >
            <Text style={styles.cancelLabel}>Cancel</Text>
          </Pressable>
        </View>
      </View>
      <OfflineBanner visible={!isOnline} />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: color.navy,
    opacity: 0.5,
  },
  sheet: {
    backgroundColor: color.white,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingBottom: space.xl,
  },
  handleArea: {
    alignItems: 'center',
    paddingVertical: space.sm,
  },
  handle: {
    width: space.xl + space.md,
    height: space.xs,
    borderRadius: radius.pill,
    backgroundColor: color.border,
  },
  body: {
    paddingHorizontal: space.lg,
    gap: space.md,
  },
  heading: {
    fontWeight: typeScale.sectionHeader.weight,
    fontFamily: typeScale.sectionHeader.fontFamily,
    fontSize: typeScale.sectionHeader.size,
    lineHeight: typeScale.sectionHeader.lineHeight,
    color: color.textPrimary,
    textAlign: 'center',
    marginBottom: space.sm,
  },
  institutionBlock: {
    alignItems: 'center',
    gap: space.xs,
    marginBottom: space.sm,
  },
  institutionName: {
    fontWeight: typeScale.body.weight,
    fontFamily: typeScale.body.fontFamily,
    fontSize: typeScale.body.size,
    lineHeight: typeScale.body.lineHeight,
    color: color.textPrimary,
    textAlign: 'center',
  },
  institutionMeta: {
    fontWeight: typeScale.meta.weight,
    fontFamily: typeScale.meta.fontFamily,
    fontSize: typeScale.meta.size,
    lineHeight: typeScale.meta.lineHeight,
    color: color.textSecondary,
    textAlign: 'center',
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: space.sm,
  },
  cancelLabel: {
    fontWeight: typeScale.body.weight,
    fontFamily: typeScale.body.fontFamily,
    fontSize: typeScale.body.size,
    lineHeight: typeScale.body.lineHeight,
    color: color.textSecondary,
  },
});
