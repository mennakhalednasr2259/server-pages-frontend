<template>
  <v-app>
    <div v-if="loading" class="d-flex justify-center align-center" style="min-height: 100vh"><v-progress-circular indeterminate color="primary" /></div>
    <div v-else-if="page && page.enabled" class="visitor-preview-workspace" :dir="locale === 'ar' ? 'rtl' : 'ltr'">
      <header class="visitor-preview-toolbar">
        <div class="visitor-preview-identity"><v-icon color="primary">mdi-web</v-icon><span><b>{{ clientName }}</b><small>{{ domain }} · {{ page.code }}</small></span></div>
        <v-btn-toggle v-model="previewMode" dense mandatory aria-label="Preview size"><v-btn value="desktop" small :aria-label="locale === 'ar' ? 'عرض سطح المكتب' : 'Desktop view'"><v-icon small>mdi-monitor</v-icon></v-btn><v-btn value="mobile" small :aria-label="locale === 'ar' ? 'عرض الهاتف' : 'Mobile view'"><v-icon small>mdi-cellphone</v-icon></v-btn></v-btn-toggle>
        <div class="visitor-preview-navigation"><v-btn small text :to="dashboardRoute"><v-icon left small>{{ locale === 'ar' ? 'mdi-arrow-right' : 'mdi-arrow-left' }}</v-icon>{{ locale === 'ar' ? 'صفحات السيرفر' : 'Server Pages' }}</v-btn><v-btn small text :to="editorRoute"><v-icon left small>mdi-pencil-outline</v-icon>{{ locale === 'ar' ? 'المحرر' : 'Editor' }}</v-btn></div>
      </header>
      <main class="visitor-preview-viewport" :class="'visitor-preview-viewport--' + previewMode"><VisitorPage :page="page" :domain="domain" :locale="locale" /></main>
    </div>
    <main v-else class="d-flex flex-column justify-center align-center text-center pa-8" style="min-height: 100vh">
      <v-icon size="56" color="warning">mdi-eye-off-outline</v-icon>
      <h1 class="text-h5 mt-4">{{ loadError || (page ? (locale === 'ar' ? 'هذه الصفحة غير مفعّلة' : 'This page is disabled') : (locale === 'ar' ? 'الصفحة غير معدّة لهذا العميل' : 'Page not configured for this customer')) }}</h1>
      <p>{{ page ? (locale === 'ar' ? 'فعّل الصفحة من لوحة الإدارة لمعاينتها كصفحة متاحة للزوار.' : 'Enable this page in the admin before previewing it as available to visitors.') : (locale === 'ar' ? 'لا توجد إعدادات محفوظة لهذا النوع من الصفحات لدى العميل المحدد.' : 'No saved settings exist for this page type and selected customer.') }}</p>
      <v-btn text :to="dashboardRoute">{{ locale === 'ar' ? 'العودة إلى صفحات السيرفر' : 'Back to Server Pages' }}</v-btn>
    </main>
  </v-app>
</template>

<script>
import VisitorPage from "~/components/VisitorPage.vue";
import { DEFAULT_CLIENT_ID, DEMO_CLIENTS } from "~/data/templates";
import { pageRepository } from "~/services/pageRepository";
export default {
  components: { VisitorPage },
  data: () => ({ page: null, loading: true, loadError: "", locale: "ar", domain: "acme-studio.com", previewMode: "desktop", clientId: DEFAULT_CLIENT_ID }),
  computed: {
    clientName() { const client = DEMO_CLIENTS.find((item) => item.id === this.clientId); return client ? client.name : "Server Pages"; },
    editorRoute() { return { path: "/admin", query: { screen: "editor", clientId: this.clientId, pageId: this.page && this.page.id, lang: this.locale } }; },
    dashboardRoute() { return { path: "/admin", query: { screen: "dashboard", clientId: DEMO_CLIENTS.some((item) => item.id === this.clientId) ? this.clientId : DEFAULT_CLIENT_ID, lang: this.locale } }; },
  },
  mounted() { this.loadPage(); },
  watch: { "$route.params.type": "loadPage", "$route.query.clientId": "loadPage", "$route.query.pageId": "loadPage", "$route.query.lang": "loadPage" },
  methods: {
    async loadPage() {
      this.loading = true;
      const routeType = String(this.$route.params.type || "index");
      const clientId = String(this.$route.query.clientId || DEFAULT_CLIENT_ID);
      this.clientId = clientId;
      this.locale = this.$route.query.lang === "en" ? "en" : "ar";
      const client = DEMO_CLIENTS.find((item) => item.id === clientId);
      if (!client) {
        this.page = null;
        this.loading = false;
        return;
      }
      this.domain = client.domain;
      this.loadError = "";
      try {
        const requestedPageId = String(this.$route.query.pageId || "");
        if (requestedPageId) {
          const page = await pageRepository.get(clientId, requestedPageId);
          this.page = page && page.type === routeType && (!page.clientId || page.clientId === clientId) ? page : null;
        } else {
          const pages = await pageRepository.list(clientId);
          this.page = pages.find((item) => item.type === routeType && (!item.clientId || item.clientId === clientId)) || null;
        }
      } catch (error) {
        this.page = null;
        this.loadError = error && error.code === "invalid-data" ? (this.locale === "ar" ? "تعذر قراءة إعدادات الصفحات المحفوظة" : "Saved page settings could not be read") : (this.locale === "ar" ? "تعذر تحميل إعدادات الصفحة" : "Could not load page settings");
      }
      this.loading = false;
    },
  },
};
</script>
