import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useUI } from './context';
import { useDisabled } from './form';
import Overlay from './Overlay';
import { confirmationEvent, type ConfirmationRequest } from './confirmation';
export { confirmAction } from './confirmation';
import type {
  ButtonProps,
  InputProps,
  TextAreaProps,
  SelectProps,
  NumberProps,
  CheckboxProps,
  OverlayProps,
  AlertProps,
  TableProps,
} from './types';
export { Form } from './form';
export { UIProvider, useMobile } from './context';
export function Button(p: ButtonProps) {
  const C = useUI().Button;
  return <C {...p} />;
}
function Text(p: InputProps) {
  const C = useUI().Input;
  return <C {...p} disabled={useDisabled(p.disabled)} />;
}
function Password(p: InputProps) {
  const C = useUI().Password;
  return <C {...p} disabled={useDisabled(p.disabled)} />;
}
function TextArea(p: TextAreaProps) {
  const C = useUI().TextArea;
  return <C {...p} disabled={useDisabled(p.disabled)} />;
}
export const Input = Object.assign(Text, { Password, TextArea });
export function Select(p: SelectProps) {
  const C = useUI().Select;
  return <C {...p} disabled={useDisabled(p.disabled)} />;
}
export function InputNumber(p: NumberProps) {
  const C = useUI().InputNumber;
  return <C {...p} disabled={useDisabled(p.disabled)} />;
}
export function Checkbox(p: CheckboxProps) {
  const C = useUI().Checkbox;
  return <C {...p} disabled={useDisabled(p.disabled)} />;
}
export function Drawer(p: OverlayProps) {
  return <Overlay {...p} kind="drawer" />;
}
export function Modal(p: OverlayProps) {
  return <Overlay {...p} />;
}
export function Alert(p: AlertProps) {
  const C = useUI().Alert;
  return <C {...p} />;
}
export function Table<T>(p: TableProps<T>) {
  const C = useUI().Table;
  return <C {...p} />;
}
export function Tag({
  children,
  color = 'gray',
}: {
  children?: ReactNode;
  color?: string;
  bordered?: boolean;
}) {
  return (
    <span className={'ui-tag tone-' + (color === 'orange' ? 'warning' : color)}>{children}</span>
  );
}
export function Spin() {
  return <span className="ui-spinner" role="status" aria-label="加载中" />;
}
export function Empty({ description = '暂无记录' }: { description?: ReactNode }) {
  return (
    <div className="ui-empty">
      <span aria-hidden="true">○</span>
      <p>{description}</p>
    </div>
  );
}
export function Space({
  children,
  className,
}: {
  children?: ReactNode;
  wrap?: boolean;
  className?: string;
  size?: string | number;
}) {
  return <div className={['ui-space', className].filter(Boolean).join(' ')}>{children}</div>;
}
function CollapseRoot({
  children,
  className,
}: {
  children?: ReactNode;
  bordered?: boolean;
  defaultActiveKey?: string[];
  className?: string;
}) {
  return <div className={['ui-collapse', className].filter(Boolean).join(' ')}>{children}</div>;
}
function CollapseItem({
  header,
  children,
}: {
  header: ReactNode;
  children?: ReactNode;
  name: string;
  destroyOnHide?: boolean;
}) {
  return (
    <details>
      <summary>{header}</summary>
      <div className="ui-collapse-content">{children}</div>
    </details>
  );
}
export const Collapse = Object.assign(CollapseRoot, { Item: CollapseItem });
export function Descriptions({
  data,
}: {
  data: { label: ReactNode; value: ReactNode }[];
  column?: number;
  labelStyle?: unknown;
}) {
  return (
    <dl className="ui-descriptions">
      {data.map((r, i) => (
        <div key={i}>
          <dt>{r.label}</dt>
          <dd>{r.value ?? '未提供'}</dd>
        </div>
      ))}
    </dl>
  );
}
function TimelineRoot({ children }: { children?: ReactNode }) {
  return <ol className="ui-timeline">{children}</ol>;
}
function TimelineItem({ children, label }: { children?: ReactNode; label?: ReactNode }) {
  return (
    <li>
      <time>{label}</time>
      <div>{children}</div>
    </li>
  );
}
export const Timeline = Object.assign(TimelineRoot, { Item: TimelineItem });

// A single declarative confirmation host uses the active desktop/mobile overlay.
export function ConfirmationHost() {
  const [request, setRequest] = useState<ConfirmationRequest | null>(null);
  const pending = useRef<((value: boolean) => void) | null>(null);
  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      const next = (event as CustomEvent<ConfirmationRequest>).detail;
      pending.current?.(false);
      pending.current = next.resolve;
      setRequest(next);
    };
    window.addEventListener(confirmationEvent, handler);
    return () => {
      pending.current?.(false);
      window.removeEventListener(confirmationEvent, handler);
    };
  }, []);
  function close(value: boolean) {
    pending.current?.(value);
    pending.current = null;
    setRequest(null);
  }
  return (
    <Modal
      visible={!!request}
      title={request?.title}
      okText="确认继续"
      cancelText="返回核对"
      onOk={() => close(true)}
      onCancel={() => close(false)}
    >
      {request?.content}
    </Modal>
  );
}
