"use client";

import { useEffect, useState } from "react";

import styles from "./system-settings-page.module.css";

import { Input } from "@/components/ui/input";

function toValidHexOrFallback(value: string): string {
  const normalized = value.trim();
  return /^#([0-9a-fA-F]{6})$/.test(normalized) ? normalized : "#000000";
}

export function ColorSettingField({
  defaultValue,
  id,
  label,
  name,
  placeholder
}: {
  defaultValue: string;
  id: string;
  label: string;
  name: string;
  placeholder: string;
}) {
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    setValue(defaultValue);
  }, [defaultValue]);

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className={styles.colorFieldRow}>
        <input
          aria-label={`${label}颜色选择`}
          className={styles.colorFieldPicker}
          onChange={(event) => {
            setValue(event.target.value);
          }}
          type="color"
          value={toValidHexOrFallback(value)}
        />
        <Input
          id={id}
          name={name}
          onChange={(event) => {
            setValue(event.target.value);
          }}
          placeholder={placeholder}
          required
          value={value}
        />
      </div>
    </div>
  );
}
