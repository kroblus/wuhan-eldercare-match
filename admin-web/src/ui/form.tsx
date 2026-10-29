import RcForm, { Field as RcField, useForm } from 'rc-field-form';
import type { FormInstance, Rule } from 'rc-field-form/lib/interface';
import {
  cloneElement,
  createContext,
  isValidElement,
  useContext,
  useId,
  type ReactNode,
  type ReactElement,
} from 'react';
export const DisabledContext = createContext(false);
export function useDisabled(disabled?: boolean) {
  return useContext(DisabledContext) || !!disabled;
}
type FormProps<T> = {
  id?: string;
  form: FormInstance<T>;
  children?: ReactNode;
  className?: string;
  layout?: string;
  initialValues?: Partial<T>;
  disabled?: boolean;
  onSubmit?: (values: T) => void;
  onValuesChange?: (changes: Partial<T>, values: T) => void;
  onSubmitFailed?: (errors: unknown) => void;
};
function FormRoot<T>({
  id,
  form,
  children,
  className,
  initialValues,
  disabled = false,
  onSubmit,
  onValuesChange,
  onSubmitFailed,
}: FormProps<T>) {
  return (
    <DisabledContext.Provider value={disabled}>
      <RcForm
        id={id}
        form={form}
        className={['ui-form', className].filter(Boolean).join(' ')}
        initialValues={initialValues}
        onFinish={onSubmit}
        onValuesChange={onValuesChange}
        onFinishFailed={onSubmitFailed}
        preserve
      >
        {children}
      </RcForm>
    </DisabledContext.Provider>
  );
}
function Item({
  field,
  label,
  rules,
  triggerPropName,
  children,
}: {
  field?: string;
  label?: ReactNode;
  rules?: Rule[];
  triggerPropName?: string;
  children?: ReactNode;
}) {
  const id = useId();
  if (!field)
    return (
      <div className="ui-field">
        {label && <span className="ui-field-label">{label}</span>}
        {children}
      </div>
    );
  return (
    <RcField name={field} rules={rules} valuePropName={triggerPropName || 'value'} preserve>
      {(control, meta) => (
        <div className={`ui-field ${meta.errors.length ? 'ui-field-error' : ''}`}>
          {label && (
            <label
              htmlFor={id}
              className="ui-field-label"
              data-required={rules?.some((rule) => typeof rule === 'object' && rule.required)}
            >
              {label}
            </label>
          )}
          {isValidElement(children)
            ? cloneElement(children as ReactElement<Record<string, unknown>>, {
                ...control,
                id,
                'aria-invalid': meta.errors.length > 0,
                'aria-describedby': meta.errors.length ? id + '-errors' : undefined,
              })
            : children}
          {!!meta.errors.length && (
            <div id={id + '-errors'} role="alert" className="ui-field-errors">
              {meta.errors.join('；')}
            </div>
          )}
        </div>
      )}
    </RcField>
  );
}
export const Form = Object.assign(FormRoot, { useForm, Item });
