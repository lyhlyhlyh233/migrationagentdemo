'use client';

import { useTranslation } from './i18n';
import { Icon } from './workspace-ui';

// User-specified preview labels; these are not fetched from a model provider.
export const conversationModels = [
  { id: 'glm-5.1', label: 'GLM 5.1' },
  { id: 'deepseek-v4', label: 'DeepSeek v4' },
] as const;
export type ConversationModelId = typeof conversationModels[number]['id'];
export const defaultConversationModel: ConversationModelId = 'glm-5.1';

export function ConversationModelPicker({ value, onChange }: { value: ConversationModelId; onChange: (value: ConversationModelId) => void }) {
  const t = useTranslation();
  return <label className="composer-model-picker"><span>{t('模型')}</span><span className="composer-model-control"><select aria-label={t('切换对话模型')} value={value} onChange={(event) => {
    const model = conversationModels.find((item) => item.id === event.target.value);
    if (model) onChange(model.id);
  }}><optgroup label={t('示例模型 · 尚未接入服务')}>{conversationModels.map((model) => <option key={model.id} value={model.id}>{model.label}</option>)}</optgroup></select><Icon name="chevron" size={13} /></span></label>;
}
