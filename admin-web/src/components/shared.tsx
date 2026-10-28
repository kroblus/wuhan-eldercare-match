import { Alert, Button, Form, Input, Select, Tag, Modal } from '@arco-design/web-react';
import type { ReactNode } from 'react';
export const options = (labels: Record<string, string>) =>
  Object.entries(labels).map(([value, label]) => ({ value, label }));
export function Field({
  name,
  label,
  required = false,
  children,
}: {
  name: string;
  label: string;
  required?: boolean;
  children?: ReactNode;
}) {
  return (
    <Form.Item
      field={name}
      label={label}
      rules={required ? [{ required: true, message: '请填写' + label }] : []}
    >
      {children || <Input maxLength={200} />}
    </Form.Item>
  );
}
export function Choice({
  labels,
  ...props
}: {
  labels: Record<string, string>;
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
}) {
  return <Select options={options(labels)} {...props} />;
}
export function ErrorNotice({ message, retry }: { message: string; retry?: () => void }) {
  return message ? (
    <Alert
      type="error"
      content={message}
      action={retry ? <Button onClick={retry}>重新读取</Button> : undefined}
    />
  ) : null;
}
export function StateTag({ children, tone = 'gray' }: { children: ReactNode; tone?: string }) {
  return <Tag color={tone}>{children}</Tag>;
}
export const confirmAction = (title: string, content: string) =>
  new Promise<boolean>((resolve) =>
    Modal.confirm({
      title,
      content,
      okText: '确认继续',
      cancelText: '返回核对',
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
    }),
  );
