import { Button, Input, InputNumber, Checkbox, Select, Alert, Table, ConfigProvider } from 'antd';
import type { TableColumnsType } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import type { ReactNode } from 'react';
import type { UIAdapter, TableProps } from './types';
import { brand } from '../evergreen/tokens';
function Theme({ children }: { children: ReactNode }) {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: brand.primary,
          colorLink: brand.primary,
          colorText: brand.ink,
          colorTextSecondary: brand.muted,
          colorBorder: brand.line,
          colorBgLayout: brand.canvas,
          borderRadius: 12,
          fontSize: 16,
          controlHeight: 44,
          fontFamily: "'Microsoft YaHei UI','PingFang SC',sans-serif",
        },
      }}
    >
      {children}
    </ConfigProvider>
  );
}
const adapter: UIAdapter = {
  Button: ({ type, htmlType = 'button', long, icon, size, status, children, ...p }) => (
    <Theme>
      <Button
        {...p}
        htmlType={htmlType}
        block={long}
        danger={status === 'danger'}
        type={type === 'primary' ? 'primary' : type === 'text' ? 'text' : 'default'}
        size={size === 'mini' ? 'small' : size === 'default' ? undefined : size}
        icon={icon}
      >
        {children}
      </Button>
    </Theme>
  ),
  Input: ({ onChange, error, ...p }) => (
    <Theme>
      <Input
        {...p}
        value={p.value ?? ''}
        status={error ? 'error' : undefined}
        onChange={(e) => onChange?.(e.target.value)}
      />
    </Theme>
  ),
  Password: ({ onChange, error, ...p }) => (
    <Theme>
      <Input.Password
        {...p}
        value={p.value ?? ''}
        status={error ? 'error' : undefined}
        onChange={(e) => onChange?.(e.target.value)}
      />
    </Theme>
  ),
  TextArea: ({ onChange, autoSize, showWordLimit, ...p }) => (
    <Theme>
      <Input.TextArea
        {...p}
        value={p.value ?? ''}
        autoSize={autoSize}
        showCount={showWordLimit}
        onChange={(e) => onChange?.(e.target.value)}
      />
    </Theme>
  ),
  InputNumber: ({ onChange, precision, allowClear, prefix, error, ...p }) => (
    <Theme>
      <InputNumber<number>
        {...p}
        value={p.value ?? null}
        precision={precision}
        onChange={(v) => onChange?.(v ?? undefined)}
      />
    </Theme>
  ),
  Checkbox: ({ onChange, ...p }) => (
    <Theme>
      <Checkbox {...p} onChange={(e) => onChange?.(e.target.checked)} />
    </Theme>
  ),
  Select: (p) => (
    <Theme>
      <Select
        {...p}
        value={p.value ?? undefined}
        getPopupContainer={(trigger) => trigger.parentElement || document.body}
        optionFilterProp="label"
        onChange={(v) => p.onChange?.(v ?? '')}
      />
    </Theme>
  ),
  Alert: ({ content, title, action, ...p }) => (
    <Theme>
      <Alert
        {...p}
        title={title ?? content}
        description={title ? content : undefined}
        action={action}
        showIcon
      />
    </Theme>
  ),
  Table: <T,>({
    data,
    columns,
    pagination,
    rowKey,
    noDataElement,
    border,
    ...p
  }: TableProps<T>) => (
    <Theme>
      <Table<T>
        {...p}
        dataSource={data}
        rowKey={rowKey as string}
        locale={{ emptyText: noDataElement }}
        columns={columns as TableColumnsType<T>}
        pagination={
          pagination
            ? {
                ...pagination,
                showSizeChanger: false,
                showTotal: pagination.showTotal ? (total) => `共 ${total} 条` : undefined,
              }
            : false
        }
      />
    </Theme>
  ),
};
export default adapter;
