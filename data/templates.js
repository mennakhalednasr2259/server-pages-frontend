export const PAGE_TEMPLATES = [
  { type: "index", code: "INDEX", label: "Default page", labelAr: "الصفحة الافتراضية", icon: "mdi-home-variant-outline", enabled: true, isIndex: true, title: "Welcome", titleAr: "مرحبًا بك", message: "Our website is ready. Contact us to learn more about our services.", messageAr: "الموقع جاهز. تواصل معنا للتعرّف على خدماتنا.", buttonLabel: "Contact us", buttonLabelAr: "تواصل معنا" },
  { type: "404", code: "404", label: "Page not found", labelAr: "الصفحة غير موجودة", icon: "mdi-file-question-outline", enabled: true, isIndex: false, title: "Page not found", titleAr: "الصفحة غير موجودة", message: "We couldn’t find the page you’re looking for.", messageAr: "تعذر العثور على الصفحة المطلوبة.", buttonLabel: "Back to home", buttonLabelAr: "العودة إلى الصفحة الرئيسية" },
  { type: "403", code: "403", label: "Access forbidden", labelAr: "الوصول غير مسموح", icon: "mdi-lock-outline", enabled: true, isIndex: false, title: "Access forbidden", titleAr: "الوصول غير مسموح", message: "You don’t have permission to view this page.", messageAr: "لا تملك صلاحية الوصول إلى هذه الصفحة.", buttonLabel: "", buttonLabelAr: "" },
  { type: "500", code: "500", label: "Server error", labelAr: "خطأ في السيرفر", icon: "mdi-server-off", enabled: true, isIndex: false, title: "Server error", titleAr: "خطأ في السيرفر", message: "Something went wrong. Please try again later.", messageAr: "حدث خطأ أثناء معالجة طلبك. يرجى المحاولة مرة أخرى لاحقًا.", buttonLabel: "Try again", buttonLabelAr: "إعادة المحاولة" },
  { type: "maintenance", code: "MAINTENANCE", label: "Maintenance", labelAr: "الصيانة", icon: "mdi-wrench-outline", enabled: true, isIndex: false, title: "Under maintenance", titleAr: "الموقع قيد الصيانة", message: "We’re making a few improvements and will be back soon.", messageAr: "الموقع قيد الصيانة حاليًا. نعمل على استعادة الخدمة في أقرب وقت.", buttonLabel: "", buttonLabelAr: "" },
  { type: "coming-soon", code: "COMING SOON", label: "Coming soon", labelAr: "قريبًا", icon: "mdi-rocket-launch-outline", enabled: true, isIndex: false, title: "Coming soon", titleAr: "قريبًا", message: "We’re preparing something new. Please check back soon.", messageAr: "نعمل على تجهيز الموقع. يرجى العودة قريبًا.", buttonLabel: "", buttonLabelAr: "" },
  { type: "suspended", code: "SUSPENDED", label: "Service suspended", labelAr: "الخدمة متوقفة", icon: "mdi-pause-circle-outline", enabled: false, isIndex: false, title: "Service suspended", titleAr: "الخدمة متوقفة", message: "This service is temporarily unavailable. Please contact the account owner.", messageAr: "الخدمة غير متاحة حاليًا. يرجى التواصل مع مسؤول الحساب لمزيد من المعلومات.", buttonLabel: "Contact us", buttonLabelAr: "التواصل مع المسؤول" },
];

export const DEMO_CLIENTS = [
  { id: "client-acme-001", name: "Acme Studio", domain: "acme-studio.com" },
  { id: "client-northstar-002", name: "Northstar Digital", domain: "northstar.ae" },
  { id: "client-cedar-003", name: "Cedar & Co.", domain: "cedarco.com" },
];

export const DEFAULT_CLIENT_ID = "client-acme-001";

export function createPages(indexType = "index") {
  return PAGE_TEMPLATES.map((page) => ({
    ...page,
    isIndex: page.type === indexType,
    design: { background: "#f7f9f8", text: "#1d312e", button: "#315c56", imageUrl: "", logoUrl: "", alignment: "start" },
    buttonUrl: "",
  }));
}
