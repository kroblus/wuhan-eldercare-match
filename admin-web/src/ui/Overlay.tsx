import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useMobile } from './context';
import { Button } from './index';
import type { OverlayProps } from './types';
import { useScrollLock } from './scrollLock';

// The native modal host stays mounted across viewport changes, preserving the
// business forms within it. showModal supplies browser focus trapping/inertness.
export default function Overlay({
  kind = 'modal',
  visible,
  title,
  onCancel,
  onOk,
  children,
  footer,
  okText = '确认继续',
  cancelText = '返回核对',
  className,
  width,
  style,
  placement = 'right',
  confirmLoading,
}: OverlayProps & { kind?: 'modal' | 'drawer' }) {
  const ref = useRef<HTMLDialogElement>(null);
  const mobile = useMobile();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (visible) {
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) dialog.close();
  }, [visible]);
  useScrollLock(!!visible);
  return createPortal(
    <dialog
      ref={ref}
      aria-label={typeof title === 'string' ? title : undefined}
      className={[
        'ui-overlay',
        'ui-overlay-' + (mobile ? 'mobile' : kind),
        'ui-overlay-' + placement,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={mobile ? undefined : { ...style, width: width ?? style?.width }}
      onCancel={(event) => {
        event.preventDefault();
        onCancel?.();
      }}
    >
      <header className="ui-overlay-header">
        <Button onClick={onCancel} aria-label="关闭窗口">
          {mobile ? '返回' : '关闭'}
        </Button>
        <h2>{title}</h2>
      </header>
      <div className="ui-overlay-body">{children}</div>
      {footer === null ? null : footer !== undefined ? (
        footer
      ) : onOk ? (
        <div className="ui-overlay-footer">
          <Button onClick={onCancel}>{cancelText}</Button>
          <Button type="primary" loading={confirmLoading} onClick={onOk}>
            {okText}
          </Button>
        </div>
      ) : null}
    </dialog>,
    document.body,
  );
}
