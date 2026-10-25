# Full Project Audit — Server Pages Frontend

**تاريخ الفحص:** 25 أكتوبر 2026  
**المشروع:** E:\Global\server-pages-frontend  
**النطاق:** مراجعة وتوثيق فقط. لم تتغير ملفات التطبيق.

## الملخص التنفيذي

المشروع تطبيق مستقل باستخدام Nuxt 2 وVue 2 وVuetify 2 لإدارة ومعاينة صفحات حالة مؤقتة للعملاء. لوحة الإدارة تعمل حاليًا على بيانات Demo محفوظة في localStorage، والعملاء الثلاثة ثابتون في data/templates.js.

هناك إعداد مركزي لـ Base URL في public/runtime-config.js أو NUXT_PUBLIC_API_BASE_URL، ويضبط Axios. لكن لا توجد طلبات HTTP فعلية للصفحات؛ services/pageRepository.js يوجه العمليات كلها إلى Demo repository. services/apiPageRepository.js تجهيز قابل للتهيئة يتطلب عقدًا لكل عملية، ولا يحتوي endpoints أو schemas.

الأنواع المعرفة فعلًا: INDEX و404 و403 و500 وMAINTENANCE وCOMING SOON وSUSPENDED. كلها قوالب واجهة؛ صفحات الخطأ ليست استجابات HTTP حقيقية ولا تربط الدومين بالخادم.

شغّلت الاختبارات من الحالة الحالية: 23/23 ناجحة. npm run build فشل قبل التجميع بسبب قفل .nuxt ثم EPERM عند إزالة ملف مولد. Node v24.18.0 وnpm 11.16.0. لم أوقف أي عملية Node أو أحذف ملفات build. لا توجد أدلة كافية لنسب الخطأ إلى عدم توافق Node؛ لم يصل Nuxt إلى مرحلة compilation.

## 1. فكرة المشروع والاستخدام

المستخدم المتوقع هو مشغل/مسؤول لوحة الإدارة، لكن لا يوجد تسجيل دخول أو صلاحيات. يختار عميلًا، يراجع صفحاته، ينشئ أو يعدل أو يحذف صفحة، يعين INDEX، يفعل/يعطل صفحة، ثم يعاينها. الحفظ محلي ولا ينشر الصفحة على دومين العميل.

| النوع | الغرض | ما يحدث حاليًا |
|---|---|---|
| INDEX | الصفحة الافتراضية | pages/index.vue تعرض الصفحة المختارة والمفعلة للعميل |
| 404 | صفحة غير موجودة | تصميم معاينة، لا HTTP 404 |
| 403 | الوصول غير مسموح | تصميم معاينة، لا صلاحيات ولا HTTP 403 |
| 500 | خطأ خادم | تصميم معاينة، لا معالجة خطأ خادم ولا HTTP 500 |
| MAINTENANCE | الصيانة | تصميم معاينة، لا تحويل فعلي |
| COMING SOON | قرب الإطلاق | قالب ثابت متاح |
| SUSPENDED | إيقاف الخدمة | قالب ثابت؛ معطل افتراضيًا، لا يوقف الاستضافة |

ثلاثة العملاء التجريبيين معرفون في data/templates.js. صفحات البداية تحصل على ID بالشكل clientId:type. الصفحة المخصصة تحصل على ID يتضمن clientId وtimestamp وrandom، ويبقى ثابتًا بعد الحفظ. هذا ليس عقدًا مع Backend.

## 2. جرد الملفات والمجلدات المهمة

| المسار | المسؤولية والملفات المرتبطة | الحالة والملاحظات |
|---|---|---|
| pages/admin/index.vue | Dashboard والمحرر، CRUD وINDEX والتفعيل، التنقل، حفظ المسودة، المعاينة، اللغة والثيم. يستخدم VisitorPage وDEMO_CLIENTS وpageRepository وpageValidation. | مستخدم؛ يجمع العرض والمنطق في ملف كبير. |
| pages/index.vue | صفحة الزائر الجذرية؛ تختار clientId من query/runtime/default وتحمل INDEX. | مستخدم؛ لا يستنتج العميل من hostname. |
| pages/server-pages-preview/_type.vue | معاينة /server-pages-preview/:type؛ يقرأ clientId وpageId ويتحقق من النوع والعميل. | مستخدم؛ دون pageId يعرض أول صفحة من النوع. |
| components/VisitorPage.vue | عرض النصوص والصور والألوان والمحاذاة والزر وRTL/LTR. | مكون مشترك بين الإدارة والمعاينة والجذر. |
| layouts/default.vue | غلاف Vuetify الافتراضي. | مستخدم حسب Nuxt. |
| data/templates.js | PAGE_TEMPLATES وDEMO_CLIENTS وDEFAULT_CLIENT_ID وcreatePages. | مصدر Demo الثابت. |
| services/demoPageRepository.js | تحميل/حفظ/CRUD/reset والتحقق من localStorage وفصل السجلات وإضافة القوالب الناقصة. | مصدر البيانات الفعلي. |
| services/pageRepository.js | واجهة repository؛ تمرير العمليات للـ Demo وإنشاء factory للـ API. | mode ثابت demo. |
| services/apiPageRepository.js | Adapter يستخدم axios.request إذا وفر contract به buildRequest وmapResponse لكل عملية. | تجهيز فقط؛ بلا endpoints أو schema. |
| services/apiConfigurationRepository.js | حل Base URL، ضبط Axios، إزالة مفاتيح Base URL القديمة لكل عميل. | مستخدم من plugin؛ تنظيف المفاتيح لا يحذف بيانات الصفحات. |
| utils/apiBaseUrl.js | التحقق من URL واختيار runtime ثم build fallback. | إعداد فقط، لا اتصال. |
| utils/pageValidation.js | التحقق من الألوان والروابط ومصادر الصور. | مستخدم قبل الحفظ؛ لا يغني عن تحقق الخادم. |
| plugins/api-base-url.client.js | قراءة config وتطبيق Base URL على Axios وتنظيف المفاتيح القديمة. | Plugin عميل؛ لا ينفذ طلب صفحات. |
| public/runtime-config.js | إعداد عام window config؛ Base URL فارغ حاليًا وclient/domain تجريبيان. | علني، يجب ألا يحوي secrets. |
| public/theme-init.js | استعادة الثيم من المتصفح وضبط data-color-scheme مبكرًا. | مستخدم. |
| assets/css/app.scss | تنسيق الإدارة والمحرر والمعاينة والـ responsive وRTL وdark/light. | مستخدم؛ لا اختبار بصري آلي. |
| nuxt.config.js | إعداد Nuxt SSR/server، Vuetify، Axios، plugin وpublicRuntimeConfig. | إعداد build/runtime. |
| .env.example | متغير NUXT_PUBLIC_API_BASE_URL الفارغ. | إعداد مركزي موثق. |
| package.json | scripts للتشغيل والاختبار والبناء، واعتماديات Nuxt 2/Vue 2/Vuetify 2/Axios. | لا يحدد Node engines. |
| package-lock.json | قفل اعتماديات npm. | مطلوب للتثبيت المتكرر. |
| tests/demoPageRepository.test.js | 23 اختبار Node للـ repository والـ handlers والـ routes. | ليست Browser E2E. |
| README.md | شرح Demo وBase URL وتجهيز API ومسؤوليات الاستضافة. | توثيق. |
| .gitignore | استثناء node_modules و.nuxt و.output وdist و.env وcoverage. | إعداد أدوات. |
| backup-pre-workspace-redesign-2026-10-22/ | نسخة احتياطية موجودة بالجذر. | لم تظهر ضمن imports/مسارات Nuxt التي راجعتها؛ لم أراجع كل محتواها. |
| node_modules/ و.nuxt/ | اعتماديات وملفات Nuxt مولدة. | ليست source؛ قفل .nuxt منع build. |
| store/ وmiddleware/ | غير موجودين. | لا Vuex store ولا middleware مصادقة. |
| utils/pageIntegration.js وdata/serverPageTemplates.js | غير موجودين. | القوالب في data/templates.js؛ pageIntegration ليس مستخدمًا. |

git status أفاد أن المسار ليس Git repository. لم تنفذ أوامر Git معدلة.

## 3. تدفق الوظائف والاختبار

| الوظيفة | نقطة البداية والدوال | مصدر/حفظ البيانات | التحقق الحالي |
|---|---|---|---|
| فتح Dashboard | watcher على clientId ثم loadPages | pageRepository.list ثم state داخل Vue | اختبار handlers/repository |
| اختيار عميل | changeClient ثم loadPages | DEMO_CLIENTS؛ سجل منفصل بمفتاح العميل | اختبار فصل البيانات والتنقل |
| عرض grid/list والبحث | filteredPages وviewMode | pages للعميل الحالي | assertions على template/state؛ ليس اختبارًا بصريًا |
| إنشاء صفحة | newPage ينشئ draft مخصصًا | لا حفظ قبل savePage ثم commit وrepository.save | إضافة وإعادة تحميل مختبرتان |
| تعديل صفحة | goEditor/navigate ثم draft | commit يستبدل سجل ID نفسه | اختبار الحفظ لكل صفحة |
| حذف | deletePage للصفحات custom ويحمي INDEX | demo repository لمفتاح العميل | مختبر |
| تعيين INDEX | setIndex يتحقق من وجود الصفحة وتفعيلها ثم يضبط isIndex | سجل العميل | مختبر؛ لا fallback تلقائي |
| تفعيل/تعطيل | togglePage من البطاقة/الجدول | يمنع تعطيل الجميع؛ تعطيل INDEX يزيل العلم | مختبر |
| الحفظ | savePage يتحقق من المحتوى والألوان والروابط والصور ثم commit | localStorage؛ استعادة الحالة السابقة عند الفشل | quota/errors مختبرة |
| معاينة مباشرة | VisitorPage يتلقى draft | قد يعرض غير المحفوظ | لا Browser E2E |
| معاينة مستقلة | openVisitor/visitorRoute يمرران type/clientId/pageId/domain/lang؛ route يستخدم get | الصفحة المحفوظة | اختبار المسار والمعرفات |
| عرض INDEX | pages/index.vue يحمل loadConfiguration | repository لعميل query/config/default | INDEX المفقود مختبر |
| اللغة والثيم | toggleLanguage وlocalized، toggleTheme | النصوص داخل السجل؛ الثيم مفتاح عام | الثيم مختبر؛ اللغة تغطيتها جزئية |
| استعادة Demo | resetClient ثم repository.reset ثم loadPages | حذف مفتاح هذا العميل فقط ثم إعادة seed | مختبر؛ ليست استعادة Backend |
| الصور | readImage/readLogo وFileReader | Data URL في التخزين المحلي، بلا upload | فشل القراءة مختبر |
| نسخ روابط | لا handler clipboard ظاهر في التطبيق | غير منفذ | لا اختبار |

المعاينة داخل المحرر تعرض draft. المعاينة المستقلة تقرأ السجل المحفوظ، لذلك التعديلات غير المحفوظة لا تنتقل إليها.

## 4. التخزين والفصل بين العملاء

| المفتاح | الغرض |
|---|---|
| server-pages-standalone:v1:client:<clientId> | { clientId, pages } للعميل |
| server-pages-standalone:v1:selected-client | تفضيل آخر عميل في لوحة الإدارة |
| server-pages-standalone:theme:v1 | تفضيل الثيم العام |
| server-pages-standalone:v1:client-api:<clientId> | إعدادات URL القديمة؛ تزال عند بدء التطبيق |

demoPageRepository يتحقق من clientId وArray وid/type/enabled/isIndex ومن عدم تكرار ID. لا يحذف JSON التالف بصمت. mergeBuiltIns يضيف القوالب الناقصة للسجلات القديمة. save يرفض الصفحات الفارغة أو تعطيل الجميع أو INDEX غير صالح، وreset يزيل سجل عميل واحد.

هذا فصل محلي وليس أمانًا: localStorage قابل للقراءة والتعديل، ولا تتم مشاركة السجلات بين الأجهزة، ولا توجد authentication أو authorization أو tenant isolation في Backend. قائمة العملاء ثابتة. التحقق من schema عند القراءة محدود للخصائص الأساسية فقط. validators بالواجهة لا تمنع التلاعب من DevTools ولا تغني عن تحقق الخادم. runtime-config.js علني ولا يصلح للأسرار.

## 5. المعاينة ومسارات الزائر

- VisitorPage.vue هو العرض المشترك.
- المعاينة المستقلة تستخدم Page ID عند تمريره، وتتحقق من نوع الصفحة والعميل. إن لم يمرر ID تختار أول صفحة من النوع؛ وإن لم يوجد سجل تعرض حالة غير معدة.
- الصفحة المعطلة تعرض حالة disabled.
- الدومين يأتي من بيانات العملاء التجريبية وليس Host/DNS.
- الجذر يعرض INDEX المفعلة المحددة فقط؛ لا يستبدلها بصفحة أخرى عند غيابها.
- Nuxt route الذي يرسم تصميم 404 لا يساوي HTTP 404. لا يوجد توجيه استضافة أو DNS/TLS أو اختيار الحالة على الخادم.

## 6. API وBase URL

Base URL مركزي: window.__SERVER_PAGES_CONFIG__.apiBaseUrl من public/runtime-config.js، أو NUXT_PUBLIC_API_BASE_URL عبر nuxt.config.js و$config. resolveApiBaseUrl يفضل runtime ويتحقق من البروتوكول ويزيل slash نهائيًا. plugin يضبط Axios. لا توجد واجهة لإعداده ولا حفظ لكل عميل في الوضع الحالي.

لم يظهر fetch أو استدعاء $axios لصفحات التطبيق. axios.request موجود فقط في API adapter، الذي يحتاج contract. services/pageRepository.js يوجه إلى Demo دائمًا. لذلك:
- لا توجد endpoints أو HTTP methods أو schemas مؤكدة.
- إنشاء الصفحة لا ينشئ API؛ يحفظ local record.
- لا يمكن اختبار HTTP errors أو auth أو CORS أو timeouts لأن لا طلب حقيقي.
- لا يصح افتراض endpoint لكل صفحة؛ قد يكون endpoint عام مع Page ID، وهذا قرار Senior/Backend.

## 7. مقارنة كلام Senior

| المطلوب | الواقع | الحالة | ما يلزم |
|---|---|---|---|
| Backend ثابت | Base URL مركزي runtime/env وتهيئة Axios | مجهز فقط | تحديد قيم البيئات وإدارة runtime |
| Frontend بدومينات مختلفة | domains تجريبية؛ لا Host mapping | غير منفذ | قرار DNS/TLS وحل client من host |
| Dashboard واحدة | موجودة؛ العملاء ثابتون | Demo فقط | API عملاء وصلاحيات |
| إنشاء صفحة من Dashboard | يحفظ record في localStorage | منفذ ومختبر Demo | API contract وتوليد ID |
| Base URL للصفحة الجديدة | لا إعداد صفحة/endpoint في UI؛ مفاتيح قديمة تنظف | يحتاج توضيح | المقصود Backend origin أم endpoint أم frontend domain؟ |
| API لكل صفحة | Adapter عام بلا contract | تجهيز فقط | endpoint عام + Page ID أم endpoint خاص؟ |
| INDEX للزائر | Vue root يقرأ Demo index | Demo فقط | تحميل public حسب الدومين |
| صفحات الأخطاء فعليًا | قوالب UI | غير منفذ | Backend/proxy/hosting وstatus codes |
| عزل العملاء | مفاتيح localStorage | Demo فقط، ليس أمنًا | Authorization وtenant isolation server-side |
| صور | Data URL محلي | Demo فقط | upload contract |

Backend Base URL هو عنوان API المشترك. API endpoint هو مسار عملية غير معروف. Frontend domain هو عنوان الزائر ولا يساوي API URL.

## 8. UI وResponsive

الواجهة موجودة في admin/index.vue وapp.scss. توجد إدارة Grid/Table وبحث واختيار عميل وبطاقات ومحرر ومعاينة ولغة وثيم واستعادة Demo. لا يوجد قسم Base URL أو API link تجريبي في الواجهة الحالية؛ Page ID يبقى داخليًا للمعاينة والتنقل.

ملاحظات للمراجعة المستقبلية وليست أخطاء مؤكدة:
- ملف الإدارة يجمع العرض والمنطق ويمكن تقسيمه بعد استقرار العقد.
- خيارات alignment هي Start/Center/End وتحتاج مراجعة التعريب.
- “استعادة” تعيد Demo seed ولا تستعيد Backup/Backend، فتحتاج تسمية واضحة.
- CSS يدعم RTL/LTR وdark/light وresponsive، لكن لا screenshot/viewport tests.
- حالات الخطأ الحالية تخص localStorage وليست HTTP.
- الدومين المعروض تجريبي ولا يمثل استضافة فعلية.

## 9. الأمن والاعتمادية

لا تظهر أسرار حالية، لكن أي قيمة في public runtime config عامة. لا يوجد مصادقة أو تحقق صلاحيات. بيانات localStorage ليست موثوقة. يجب التحقق من المدخلات وPage ID والعميل والصلاحيات بالخادم. روابط الزر محصورة في http/https/mailto/tel على الواجهة. CORS وtoken/session وtenant mapping تعتمد على backend/deployment ولا يمكن إثباتها. أخطاء storage quota والإعداد التالف لها تعامل محلي.

## 10. الاختبارات والنتائج الحالية

tests/demoPageRepository.test.js يشغل 23 اختبار Node. يغطي URL المركزي والتحقق وتنظيف المفاتيح القديمة، API adapter mock وغياب contract، CRUD/INDEX، فصل العملاء/reset، أخطاء JSON والتخزين/quota، handlers الإدارة، visitor routes حسب client/page/type، تغيير الثيم، navigation/drafts، اللغة جزئيًا، وفشل قراءة الصور.

النتيجة الفعلية:
- Node v24.18.0، npm 11.16.0.
- npm test: 23 passed، 0 failed.
- npm run build: فشل قبل التجميع. Nuxt لم يحصل على lock لـ .nuxt ثم ظهر EPERM عند unlink لملف مولد (axios.js؛ محاولة أخرى client.js).
- git status: ليس Git repository.
- لا توجد طلبات HTTP لجلب الصفحات.

هذه ليست اختبارات متصفح E2E أو backend integration ولا تتحقق من CSS بصريًا. لم أحذف .nuxt أو أوقف عملية خدمة. لا يوجد دليل كافٍ أن Node هو السبب؛ package.json لا يحدد engines.

## 11. النواقص بالأولوية

### A — يجب إصلاحه قبل الربط
- **Critical:** localStorage وclientId بالواجهة لا يوفران authorization؛ يلزم tenant isolation خادمي.
- **High:** لا يوجد domain-to-client resolution للزائر.
- **High:** 404/403/500/maintenance/suspended لا تنتج status أو routing حقيقيًا.
- **High:** حل تعارض .nuxt وإعادة build آمن.
- **Medium:** تجميع admin/editor يزيد تكلفة التعديل والصيانة.

### B — تجهيز قبل الربط
- **High:** وصل API adapter خلف repository مع حالات loading/error/conflict بعد اعتماد العقد.
- **High:** تثبيت client identity وPage ID authoritative.
- **Medium:** استبدال Data URL بخدمة upload بعد تحديد response.
- **Medium:** mapping موحد لأخطاء HTTP بعد معرفة schema.

### C — Senior/Backend
- **Critical:** Base URL لكل بيئة، domains/client resolution، endpoints/methods/schemas، auth/tenant rules.
- **High:** endpoint عام أم خاص بالصفحة؟ من ينشئ IDs؟ كيف يخزن INDEX؟
- **Medium:** عقد الصور، routing/status، معنى reset، conflict/retry/pagination.

### D — بعد الربط
- **High:** integration tests للـ CRUD والصلاحيات والدومين وCORS وHTTP status.
- **Medium:** اختبار upload وروابط الصور.
- **Medium:** Browser E2E لRTL/LTR وresponsive ورسائل الشبكة.

## 12. خطة مقترحة، غير منفذة

| الخطوة | التعديل والملفات المحتملة | التحقق | قرار Senior |
|---|---|---|---|
| 1 | توثيق contract وauth/client/domain/ID/INDEX/image rules | مراجعة Senior وBackend | نعم |
| 2 | حل قفل .nuxt دون حذف/إيقاف مجهول وإعادة build | build ناجح وتسجيل الإصدارات | تنسيق إن خدمة تعمل |
| 3 | وصل API adapter داخل pageRepository | contract tests ثم staging integration | نعم بعد 1 |
| 4 | جلب العملاء وحل tenant حسب host وتطبيق authorization | اختبارات وصول مرفوض ومسموح | نعم |
| 5 | upload للصور وتوحيد errors | نجاح وفشل ورابط ناتج | نعم |
| 6 | ربط حالات HTTP مع proxy/backend/hosting | اختبار status حقيقي لكل حالة | نعم |
| 7 | إضافة Browser E2E وvisual viewport tests | RTL/LTR وmobile/desktop | تحديد أداة |

## 13. أسئلة Senior

1. ما Backend Base URL لكل بيئة وكيف يدار؟
2. ما endpoint وHTTP method وrequest/response/error schema لكل عملية؟
3. هل “API لكل صفحة” endpoint منفصل أم API عام مع Page ID؟
4. كيف يستنتج clientId من hostname؟ وهل query مسموح للزائر؟
5. من ينشئ Page ID وهل يبقى ثابتًا؟
6. هل INDEX حقل indexPageId أم isIndex؟ وما قواعد التعطيل/الحذف؟
7. ما auth/roles وما بيانات الزائر العامة؟
8. ما upload route والصيغ والحجم وشكل الرابط؟
9. من يعيد status الفعلي لصفحات الخطأ والصيانة والإيقاف؟
10. هل Reset Demo فقط أم استعادة defaults على Backend؟

الملفات المرجحة للتغييرات المستقبلية: services/pageRepository.js وapiPageRepository.js وapiConfigurationRepository.js وutils/apiBaseUrl.js وplugin، nuxt.config.js وruntime-config.js و.env.example، data/templates.js، pages/admin/index.vue وpages/index.vue وpages/server-pages-preview/_type.vue، VisitorPage.vue وpageValidation.js والاختبارات. DNS/TLS/proxy/status تتطلب إعدادات خارج المشروع.

## الخلاصة

**يعمل في Demo:** CRUD محلي، تغيير INDEX والحالة، عزل سجلات localStorage، المعاينة، الترجمة والثيم وحالات فشل التخزين. الاختبارات 23/23.

**مجهز فقط:** Base URL مركزي على Axios وAPI adapter قابل للتهيئة؛ غير موصول إلى بيانات الواجهة.

**غير منفذ:** Backend حي، auth، عملاء من API، رفع صور، ربط دومين، HTTP error routing ونشر الصفحات.

**أهم الأولويات:** اعتماد العقد؛ حماية tenant؛ حسم client/domain resolution؛ حسم IDs وINDEX؛ تحديد routing/status الحقيقي.

**الخطوة التالية:** حسم أسئلة Senior وكتابة API contract قبل أي endpoints أو schemas.

---
التقرير يصف الكود الذي تمت مراجعته فقط ولا يثبت وجود Backend أو deployment فعلي. لم تُعدّل ملفات التطبيق.
