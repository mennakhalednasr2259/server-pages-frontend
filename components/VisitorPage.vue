<template>
  <div class="page-preview" :dir="isArabic ? 'rtl' : 'ltr'" :style="pageStyles">
    <header class="visitor-header"><div class="visitor-brand">
      <img v-if="design.logoUrl && logoVisible" :src="design.logoUrl" alt="" @error="hideBrokenLogo">
      <v-icon v-else>mdi-web</v-icon><span>{{ brandName }}</span><small>{{ domain }}</small>
    </div></header>
    <main class="visitor-main" :style="{ textAlign: design.alignment || 'start' }">
      <div class="visitor-art" aria-hidden="true"><img v-if="design.imageUrl && imageVisible" :src="design.imageUrl" alt="" @error="imageVisible = false"><v-icon v-else>{{ icon }}</v-icon></div>
      <section class="visitor-copy"><span class="text-caption font-weight-bold">{{ code }}</span><h1>{{ localized(page, 'title') }}</h1><p>{{ localized(page, 'message') }}</p>
        <a v-if="buttonLabel && safeButtonUrl" class="visitor-action" :href="safeButtonUrl">{{ buttonLabel }}</a>
        <span v-else-if="buttonLabel" class="visitor-action visitor-action--disabled" aria-disabled="true">{{ buttonLabel }}</span>
      </section>
    </main>
  </div>
</template>
<script>
export default {
  props: { page: { type: Object, required: true }, domain: { type: String, default: "" }, locale: { type: String, default: "ar" } },
  data: () => ({ imageVisible: true, logoVisible: true }),
  computed: {
    isArabic() { return this.locale === "ar"; },
    design() { return this.page.design || {}; },
    pageStyles() { return { "--page-bg": this.design.background || "#f7f9f8", "--page-text": this.design.text || "#1d312e", "--page-button": this.design.button || "#315c56" }; },
    brandName() { return (this.domain || "Customer site").split(".")[0]; },
    buttonLabel() { return this.localized(this.page, "buttonLabel"); },
    safeButtonUrl() { const value = (this.page.buttonUrl || "").trim(); return /^(https?:\/\/|mailto:|tel:)/i.test(value) ? value : ""; },
    icon() { return ({ index: "mdi-home-outline", "404": "mdi-file-question-outline", "403": "mdi-lock-outline", "500": "mdi-server-off", maintenance: "mdi-wrench-outline", "coming-soon": "mdi-rocket-launch-outline", suspended: "mdi-pause-circle-outline" })[this.page.type] || "mdi-web"; },
    code() { return this.page.code || this.page.type.toUpperCase(); },
  },
  watch: { page() { this.imageVisible = true; this.logoVisible = true; } },
  methods: {
    localized(page, field) { const key = this.isArabic ? `${field}Ar` : field; return page[key] || page[this.isArabic ? field : `${field}Ar`] || ""; },
    hideBrokenLogo() { this.logoVisible = false; },
  },
};
</script>
