'use client';

import { useSyncExternalStore } from 'react';
import { themes } from './theme-config';
import { readPreference, selectPreference, subscribePreferences } from './preferences';
import { useTranslation } from './i18n';
import { Icon } from './workspace-ui';

export function ThemePicker() {
  const t = useTranslation();
  const selected = useSyncExternalStore(subscribePreferences, () => readPreference('theme'), () => 'white' as const);
  return <div className="theme-picker" role="group" aria-label={t('外观')}>
    {themes.map((theme) => <button key={theme.id} type="button" aria-pressed={selected === theme.id} aria-label={t(`${theme.label}样式`)} title={t(`${theme.label}样式`)} onClick={() => selectPreference('theme', theme.id)}>
      <span className={`theme-swatch swatch-${theme.id}`} aria-hidden="true"><i /><b /></span>
      <span className="theme-option-label">{t(theme.label)}{selected === theme.id && <Icon name="check" size={13} />}</span>
    </button>)}
  </div>;
}
