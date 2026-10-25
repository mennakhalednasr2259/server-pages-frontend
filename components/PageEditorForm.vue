<template>
  <div class="editor-panel">
    <div class="editor-panel__heading">
      <span class="status-card__icon" :class="'tone-' + tone"><v-icon>{{ icon }}</v-icon></span>
      <div><b>{{ pageLabel }}</b><small>{{ draft.code }}<span v-if="draft.isIndex"> · INDEX</span></small></div>
      <v-spacer />
      <button type="button" class="page-toggle page-toggle--editor" role="switch" :aria-checked="draft.enabled ? 'true' : 'false'" @click="updateField('enabled', !draft.enabled)">
        <span class="page-toggle__track"><span class="page-toggle__thumb"></span></span>
        <span class="page-toggle__label">{{ draft.enabled ? t('مفعّلة', 'Enabled') : t('متوقفة', 'Disabled') }}</span>
      </button>
    </div>

    <div class="editor-form">
      <v-tabs :value="settingsTab" grow class="editor-tabs" @change="$emit('settings-tab-change', $event)">
        <v-tab>{{ t('المحتوى', 'Content') }}</v-tab>
        <v-tab>{{ t('الزر والرابط', 'Button & link') }}</v-tab>
        <v-tab>{{ t('المظهر', 'Appearance') }}</v-tab>
        <v-tab>{{ t('الصور', 'Images') }}</v-tab>
      </v-tabs>
      <v-tabs-items :value="settingsTab" class="editor-tab-panels">
        <v-tab-item><div class="form-grid">
          <v-text-field :value="draft.titleAr" :label="t('العنوان بالعربية', 'Arabic title')" outlined dense @input="updateField('titleAr', $event)" />
          <v-text-field :value="draft.title" :label="t('العنوان بالإنجليزية', 'English title')" outlined dense @input="updateField('title', $event)" />
          <v-textarea :value="draft.messageAr" :label="t('الرسالة بالعربية', 'Arabic message')" outlined rows="3" @input="updateField('messageAr', $event)" />
          <v-textarea :value="draft.message" :label="t('الرسالة بالإنجليزية', 'English message')" outlined rows="3" @input="updateField('message', $event)" />
        </div></v-tab-item>
        <v-tab-item><div class="form-grid">
          <v-text-field :value="draft.buttonLabelAr" :label="t('نص الزر بالعربية', 'Arabic button label')" outlined dense @input="updateField('buttonLabelAr', $event)" />
          <v-text-field :value="draft.buttonLabel" :label="t('نص الزر بالإنجليزية', 'English button label')" outlined dense @input="updateField('buttonLabel', $event)" />
          <v-text-field :value="draft.buttonUrl" :label="t('رابط الزر', 'Button URL')" hint="https:// · mailto: · tel:" persistent-hint outlined dense @input="updateField('buttonUrl', $event)" />
        </div><p class="image-hint">{{ t('يظهر الزر عند وجود نص ورابط صالح.', 'The button appears when its label and URL are valid.') }}</p></v-tab-item>
        <v-tab-item><div class="form-grid form-grid--colors">
          <v-text-field :value="draft.design.background" type="color" :label="t('الخلفية', 'Background')" outlined dense @input="updateDesign('background', $event)" />
          <v-text-field :value="draft.design.text" type="color" :label="t('النص', 'Text')" outlined dense @input="updateDesign('text', $event)" />
          <v-text-field :value="draft.design.button" type="color" :label="t('الزر', 'Button')" outlined dense @input="updateDesign('button', $event)" />
          <v-select :value="draft.design.alignment" :items="alignments" item-text="text" item-value="value" :label="t('محاذاة المحتوى', 'Content alignment')" outlined dense @change="updateDesign('alignment', $event)" />
        </div></v-tab-item>
        <v-tab-item><div class="form-grid">
          <v-text-field :value="draft.design.logoUrl" :label="t('رابط الشعار', 'Logo URL')" outlined dense @input="updateDesign('logoUrl', $event)" />
          <v-text-field :value="draft.design.imageUrl" :label="t('رابط الصورة', 'Image URL')" outlined dense @input="updateDesign('imageUrl', $event)" />
          <v-file-input accept="image/*" outlined dense :label="t('اختيار شعار للمعاينة', 'Choose logo for preview')" @change="$emit('select-logo', $event)" />
          <v-file-input accept="image/*" outlined dense :label="t('اختيار صورة للمعاينة', 'Choose image for preview')" @change="$emit('select-image', $event)" />
        </div><p class="image-hint">{{ t('الصور المحلية للمعاينة فقط ولا تُرفع إلى خادم.', 'Local images are preview-only and are not uploaded.') }}</p></v-tab-item>
      </v-tabs-items>

      <div class="editor-actions">
        <v-btn text @click="$emit('cancel')">{{ isCreating ? t('إلغاء الإنشاء', 'Cancel creation') : t('إلغاء التعديلات', 'Cancel changes') }}</v-btn>
        <v-spacer />
        <span v-if="saving" class="editing-indicator">{{ t('جارٍ الحفظ…', 'Saving…') }}</span>
        <span v-else-if="hasUnsavedChanges" class="unsaved-state">{{ t('تعديلات غير محفوظة', 'Unsaved changes') }}</span>
        <span v-else class="saved-state"><v-icon small>mdi-check-circle-outline</v-icon>{{ t('محفوظة', 'Saved') }}</span>
        <v-btn color="primary" :disabled="saving || !hasUnsavedChanges" @click="$emit('save')"><v-icon left small>mdi-content-save-outline</v-icon>{{ saving ? t('جارٍ الحفظ…', 'Saving…') : (isCreating ? t('إنشاء الصفحة', 'Create page') : t('حفظ التعديلات', 'Save changes')) }}</v-btn>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: "PageEditorForm",
  props: {
    draft: { type: Object, required: true },
    locale: { type: String, required: true },
    pageLabel: { type: String, required: true },
    icon: { type: String, required: true },
    tone: { type: String, required: true },
    isCreating: { type: Boolean, default: false },
    settingsTab: { type: Number, default: 0 },
    alignments: { type: Array, default: () => [] },
    saving: { type: Boolean, default: false },
    hasUnsavedChanges: { type: Boolean, default: false },
  },
  methods: {
    t(ar, en) { return this.locale === "ar" ? ar : en; },
    updateField(field, value) {
      const next = { ...this.draft, [field]: value };
      this.$emit("update:draft", next);
    },
    updateDesign(field, value) {
      const next = { ...this.draft, design: { ...this.draft.design, [field]: value } };
      this.$emit("update:draft", next);
    },
  },
};
</script>
