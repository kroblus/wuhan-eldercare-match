import { render as testingRender, type RenderOptions } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import adapter from '../ui/desktop';
import mobileAdapter from '../ui/mobile';
import { ConfirmationHost } from '../ui';
import { UIContext } from '../ui/context';
export function render(ui: ReactElement, options?: RenderOptions & { mobile?: boolean }) {
  const Wrapper = options?.wrapper;
  const mobile = options?.mobile ?? false;
  return testingRender(ui, {
    ...options,
    wrapper: ({ children }: { children: ReactNode }) => (
      <UIContext.Provider value={{ adapter: mobile ? mobileAdapter : adapter, mobile }}>
        <ConfirmationHost />
        {Wrapper ? <Wrapper>{children}</Wrapper> : children}
      </UIContext.Provider>
    ),
  });
}
