import {
  createContext,
  useCallback,
  useContext,
  useRef,
  type ReactNode,
} from 'react';
import {
  findNodeHandle,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  type TextInputProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { screenStyles } from '@/constants/screenStyles';

type FormScrollContextValue = {
  /** Scrolls the focused text field above the on-screen keyboard. */
  scrollInputIntoView: (input: TextInput | null) => void;
};

const FormScrollContext = createContext<FormScrollContextValue | null>(null);

/**
 * Returns the scroll helper from KeyboardAwareFormScroll (safe no-op if missing).
 */
export function useFormScrollInputIntoView(): FormScrollContextValue['scrollInputIntoView'] {
  const context = useContext(FormScrollContext);

  if (context === null) {
    return () => undefined;
  }

  return context.scrollInputIntoView;
}

type KeyboardAwareFormScrollProps = {
  children: ReactNode;
  backgroundColor: string;
};

/**
 * Form wrapper that lifts / scrolls content when the keyboard opens.
 * Analogy: when a popup keyboard covers the desk, we slide the paper up so you can still write.
 */
export default function KeyboardAwareFormScroll({
  children,
  backgroundColor,
}: KeyboardAwareFormScrollProps) {
  const scrollViewRef = useRef<ScrollView>(null);
  const insets = useSafeAreaInsets();

  // AppHeader sits above the screen; offset keeps fields from hiding under it + keyboard.
  const keyboardVerticalOffset = insets.top + 56;

  const scrollInputIntoView = useCallback((input: TextInput | null) => {
    if (input === null || scrollViewRef.current === null) {
      return;
    }

    const inputHandle = findNodeHandle(input);

    if (inputHandle === null) {
      return;
    }

    // Wait briefly so Android finishes resizing for the keyboard first.
    const delayMs = Platform.OS === 'android' ? 250 : 100;

    setTimeout(() => {
      const scrollView = scrollViewRef.current as ScrollView & {
        scrollResponderScrollNativeHandleToKeyboard?: (
          nodeHandle: number,
          additionalOffset: number,
          preventNegativeScrollOffset: boolean,
        ) => void;
      };

      if (scrollView === null) {
        return;
      }

      // Preferred RN helper: scrolls the focused native input above the keyboard.
      if (scrollView.scrollResponderScrollNativeHandleToKeyboard) {
        scrollView.scrollResponderScrollNativeHandleToKeyboard(inputHandle, 140, true);
        return;
      }

      // Fallback if the helper is unavailable.
      const scrollHandle = findNodeHandle(scrollView);

      if (scrollHandle === null) {
        return;
      }

      input.measureLayout(
        scrollHandle,
        (_x, y) => {
          scrollView.scrollTo({
            y: Math.max(0, y - 24),
            animated: true,
          });
        },
        () => undefined,
      );
    }, delayMs);
  }, []);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor }}
      behavior="padding"
      keyboardVerticalOffset={keyboardVerticalOffset}>
      <FormScrollContext.Provider value={{ scrollInputIntoView }}>
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={screenStyles.scrollContent}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          automaticallyAdjustKeyboardInsets
          showsVerticalScrollIndicator>
          {children}
        </ScrollView>
      </FormScrollContext.Provider>
    </KeyboardAvoidingView>
  );
}

/**
 * TextInput that asks the parent form scroll view to keep it visible on focus.
 */
export function FormTextInput(props: TextInputProps) {
  const inputRef = useRef<TextInput>(null);
  const scrollInputIntoView = useFormScrollInputIntoView();

  return (
    <TextInput
      {...props}
      ref={inputRef}
      onFocus={(event) => {
        scrollInputIntoView(inputRef.current);
        props.onFocus?.(event);
      }}
    />
  );
}
