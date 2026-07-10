import type {
  InputHTMLAttributes,
  ReactNode,
} from "react";

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  trailing?: ReactNode;
};

export function TextField({
  label,
  error,
  trailing,
  id,
  name,
  ...inputProps
}: TextFieldProps) {
  const fieldId =
    id ??
    name ??
    label.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="field">
      <label className="field-label" htmlFor={fieldId}>
        {label}
      </label>

      <div
        className={`input-wrap ${
          error ? "input-wrap-error" : ""
        }`}
      >
        <input
          {...inputProps}
          id={fieldId}
          name={name}
          className="text-input"
          aria-invalid={Boolean(error)}
          aria-describedby={
            error ? `${fieldId}-error` : undefined
          }
        />

        {trailing && (
          <div className="input-trailing">
            {trailing}
          </div>
        )}
      </div>

      {error && (
        <p
          className="field-error"
          id={`${fieldId}-error`}
        >
          {error}
        </p>
      )}
    </div>
  );
}
