export type ConfirmationRequest = {
  title: string;
  content: string;
  resolve: (value: boolean) => void;
};
export const confirmationEvent = 'kuaikangyang:confirmation';

// A DOM event keeps the mounted host reachable across development module refreshes.
// If the host is unavailable, cancel safely instead of opening a blocking browser dialog.
export function confirmAction(title: string, content: string): Promise<boolean> {
  return new Promise((resolve) => {
    const handled = !window.dispatchEvent(
      new CustomEvent<ConfirmationRequest>(confirmationEvent, {
        cancelable: true,
        detail: { title, content, resolve },
      }),
    );
    if (!handled) resolve(false);
  });
}
