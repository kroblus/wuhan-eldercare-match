import { useRef, useState } from 'react';
import { Button, Input, TextArea, Checkbox, Popup } from 'antd-mobile';
import type { UIAdapter, SelectProps, TableProps } from './types';
function SelectField({
  options = [],
  value,
  onChange,
  placeholder = '请选择',
  disabled,
  allowClear,
  showSearch,
  id,
  ...p
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        ref={trigger}
        id={id}
        type="button"
        className="ui-mobile-select"
        disabled={disabled}
        aria-label={p['aria-label']}
        aria-invalid={p['aria-invalid']}
        aria-haspopup="dialog"
        onClick={() => {
          setSearch('');
          setOpen(true);
        }}
      >
        {options.find((o) => o.value === value)?.label || placeholder}
        <span aria-hidden="true">⌄</span>
      </button>
      <Popup
        getContainer={() => trigger.current?.closest('dialog') || document.body}
        visible={open}
        onMaskClick={() => setOpen(false)}
        onClose={() => setOpen(false)}
        position="bottom"
        bodyClassName="ui-picker-sheet"
        showCloseButton
      >
        <div role="dialog" aria-modal="true" aria-label={p['aria-label'] || placeholder}>
          <h2>{placeholder}</h2>
          {showSearch && (
            <Input
              aria-label="搜索选项"
              placeholder="输入名称搜索"
              value={search}
              onChange={setSearch}
              clearable
            />
          )}
          {allowClear && (
            <Button
              block
              onClick={() => {
                onChange?.('');
                setOpen(false);
              }}
            >
              全部 / 清除选择
            </Button>
          )}
          <div className="ui-picker-options">
            {options
              .filter(
                (o) =>
                  !search ||
                  String(o.label).toLocaleLowerCase().includes(search.toLocaleLowerCase()),
              )
              .map((o) => (
                <Button
                  key={o.value}
                  block
                  disabled={o.disabled}
                  color={o.value === value ? 'primary' : 'default'}
                  onClick={() => {
                    onChange?.(o.value);
                    setOpen(false);
                  }}
                >
                  {o.label}
                  {o.value === value ? ' ✓' : ''}
                </Button>
              ))}
          </div>
          <Button block onClick={() => setOpen(false)}>
            返回
          </Button>
        </div>
      </Popup>
    </>
  );
}
const adapter: UIAdapter = {
  Button: ({
    type,
    htmlType = 'button',
    long,
    icon,
    size,
    status,
    children,
    loading,
    href,
    ...p
  }) => (
    <Button
      {...p}
      type={htmlType}
      block={long}
      loading={loading}
      color={status === 'danger' ? 'danger' : type === 'primary' ? 'primary' : 'default'}
      fill={type === 'text' ? 'none' : 'solid'}
      onClick={(e) => {
        p.onClick?.(e);
        if (href) location.href = href;
      }}
    >
      {icon}
      {children}
    </Button>
  ),
  Input: ({ onChange, prefix, allowClear, error, ...p }) => (
    <div className="ui-mobile-input">
      {prefix}
      <Input {...p} value={p.value ?? ''} onChange={onChange} clearable={allowClear} />
    </div>
  ),
  Password: ({ onChange, prefix, allowClear, error, ...p }) => (
    <div className="ui-mobile-input">
      <Input {...p} type="password" value={p.value ?? ''} onChange={onChange} />
    </div>
  ),
  TextArea: ({ onChange, autoSize, showWordLimit, ...p }) => (
    <div className="ui-mobile-input">
      <TextArea
        {...p}
        value={p.value ?? ''}
        showCount={showWordLimit}
        rows={autoSize?.minRows ?? p.rows ?? 3}
        onChange={onChange}
      />
    </div>
  ),
  InputNumber: ({ onChange, min, max, precision, allowClear, prefix, error, value, ...p }) => (
    <div className="ui-mobile-input">
      <Input
        {...p}
        type="number"
        min={min}
        max={max}
        step={precision === 0 ? 1 : undefined}
        value={value === undefined ? '' : String(value)}
        onChange={(v) => onChange?.(v === '' ? undefined : Number(v))}
      />
    </div>
  ),
  Checkbox: ({ children, ...p }) => <Checkbox {...p}>{children}</Checkbox>,
  Select: SelectField,
  Alert: ({ type = 'info', content, title, action, closable, onClose }) => (
    <div className={'ui-notice ui-notice-' + type} role={type === 'error' ? 'alert' : 'status'}>
      {title && <strong>{title}</strong>}
      <div>{content}</div>
      {action}
      {closable && (
        <Button fill="none" onClick={onClose}>
          关闭提示
        </Button>
      )}
    </div>
  ),
  Table: <T,>({ data = [], columns, rowKey, pagination, loading }: TableProps<T>) => (
    <div className="ui-mobile-data">
      {loading && <p role="status">正在读取…</p>}
      {!loading && !data.length && <p className="ui-empty">暂无记录</p>}
      {data.map((row, index) => (
        <article
          className="ui-data-card"
          key={typeof rowKey === 'function' ? rowKey(row) : String(row[rowKey as keyof T] ?? index)}
        >
          {columns.map((column, i) => (
            <div key={i}>
              {column.title && <span className="muted">{column.title}</span>}
              <div>
                {column.render
                  ? column.render(row[column.dataIndex as keyof T], row, index)
                  : String(row[column.dataIndex as keyof T] ?? '—')}
              </div>
            </div>
          ))}
        </article>
      ))}
      {pagination && (
        <div className="ui-pagination">
          <Button
            disabled={(pagination.current || 1) <= 1}
            onClick={() => pagination.onChange?.((pagination.current || 1) - 1)}
          >
            上一页
          </Button>
          <span>
            {pagination.current || 1} /{' '}
            {Math.max(1, Math.ceil((pagination.total || 0) / (pagination.pageSize || 25)))}
          </span>
          <Button
            disabled={
              (pagination.current || 1) * (pagination.pageSize || 25) >= (pagination.total || 0)
            }
            onClick={() => pagination.onChange?.((pagination.current || 1) + 1)}
          >
            下一页
          </Button>
        </div>
      )}
    </div>
  ),
};
export default adapter;
