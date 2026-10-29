import type {
  ReactNode,
  CSSProperties,
  ComponentType,
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
export type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'color'> & {
  type?: 'primary' | 'secondary' | 'text' | 'outline' | 'default';
  htmlType?: 'submit' | 'button' | 'reset';
  loading?: boolean;
  long?: boolean;
  icon?: ReactNode;
  size?: 'small' | 'mini' | 'default' | 'large';
  status?: 'danger' | 'warning';
  href?: string;
};
export type InputProps = Pick<
  InputHTMLAttributes<HTMLInputElement>,
  | 'id'
  | 'type'
  | 'placeholder'
  | 'disabled'
  | 'readOnly'
  | 'maxLength'
  | 'autoComplete'
  | 'name'
  | 'className'
  | 'style'
  | 'inputMode'
  | 'onFocus'
  | 'onBlur'
  | 'onKeyDown'
  | 'aria-label'
  | 'aria-invalid'
  | 'aria-describedby'
> & {
  value?: string;
  onChange?: (value: string) => void;
  prefix?: ReactNode;
  allowClear?: boolean;
  error?: boolean;
};
export type TextAreaProps = Pick<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  | 'id'
  | 'placeholder'
  | 'disabled'
  | 'readOnly'
  | 'maxLength'
  | 'name'
  | 'className'
  | 'style'
  | 'rows'
  | 'spellCheck'
  | 'aria-label'
  | 'aria-invalid'
  | 'aria-describedby'
> & {
  value?: string;
  onChange?: (value: string) => void;
  autoSize?: { minRows?: number; maxRows?: number };
  showWordLimit?: boolean;
};
export type SelectProps = {
  id?: string;
  'aria-label'?: string;
  'aria-invalid'?: boolean;
  className?: string;
  style?: CSSProperties;
  options?: { value: string; label: ReactNode; disabled?: boolean }[];
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  allowClear?: boolean;
  showSearch?: boolean;
  disabled?: boolean;
};
export type NumberProps = Omit<InputProps, 'value' | 'onChange' | 'min' | 'max'> & {
  value?: number;
  onChange?: (value: number | undefined) => void;
  min?: number;
  max?: number;
  precision?: number;
};
export type CheckboxProps = {
  id?: string;
  children?: ReactNode;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  'aria-label'?: string;
  'aria-invalid'?: boolean;
};
export type OverlayProps = {
  title?: ReactNode;
  visible?: boolean;
  onCancel?: () => void;
  onOk?: () => void;
  okText?: string;
  cancelText?: string;
  footer?: ReactNode;
  children?: ReactNode;
  className?: string;
  width?: string | number;
  style?: CSSProperties;
  placement?: 'left' | 'right' | 'bottom';
  maskClosable?: boolean;
  unmountOnExit?: boolean;
  confirmLoading?: boolean;
};
export type AlertProps = {
  type?: 'error' | 'info' | 'success' | 'warning';
  content?: ReactNode;
  action?: ReactNode;
  title?: ReactNode;
  closable?: boolean;
  onClose?: () => void;
};
export type Pagination =
  | false
  | {
      current?: number;
      pageSize?: number;
      total?: number;
      onChange?: (page: number) => void;
      showTotal?: boolean;
      sizeCanChange?: boolean;
    };
// Cell values follow each column's declared dataIndex; row types remain generic.
export type Column<T> = {
  title?: ReactNode;
  key?: string;
  dataIndex?: keyof T | string;
  width?: number;
  render?: (value: any, row: T, index: number) => ReactNode;
};
export type TableProps<T> = {
  data?: T[];
  columns: Column<T>[];
  rowKey: keyof T | string | ((row: T) => string);
  noDataElement?: ReactNode;
  pagination?: Pagination;
  loading?: boolean;
  border?: boolean;
  scroll?: { x?: number | string };
  className?: string;
};
export type UIAdapter = {
  Button: ComponentType<ButtonProps>;
  Input: ComponentType<InputProps>;
  Password: ComponentType<InputProps>;
  TextArea: ComponentType<TextAreaProps>;
  Select: ComponentType<SelectProps>;
  InputNumber: ComponentType<NumberProps>;
  Checkbox: ComponentType<CheckboxProps>;
  Alert: ComponentType<AlertProps>;
  Table: <T>(props: TableProps<T>) => ReactNode;
};
