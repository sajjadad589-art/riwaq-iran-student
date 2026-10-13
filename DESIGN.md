# واجهة تطبيق وياك

تحديث مبني على الصور المرجعية الثلاث التي أرسلها المستخدم: رئيسية مختصرة، بطاقات أسعار لكل 100 دولار، أقسام مستقلة، شريط تنقل ثابت، محول، فلاتر عبارات، وقائمة المزيد. التطبيق PWA قابل للتثبيت، وليس حزمة Android أو iOS أصلية. لا توجد رسوم بيانية أو نسب تغير مصطنعة. تغذية السوق غير المهيأة تظهر غير متاحة.

الخلفية مولدة بالأداة المدمجة image_gen، محفوظة في public/tehran-hero.png. الوصف المستخدم:

Use case: photorealistic-natural. Asset type: background photograph for the top of the Arabic Wayak travel mobile app. Generate only the background, no interface or phone. Landscape 3:2. Beautiful Tehran skyline at blue hour sunset with Milad Tower near center-left and dramatic snow capped Alborz mountains in the distance. Rich cobalt blue sky with subtle pink orange clouds. Realistic detailed urban skyline at bottom. Reserve darker calm right half and upper sky for white Arabic UI text and a small timer placed later in code. No text, no logos, no flags, no watermark, no UI. Crisp elegant travel photography, matching the blue and white premium app references.

الأعلام والأيقونات عناصر SVG مستقلة، والنصوص وأزرار التنقل عناصر تفاعلية. أرقام السوق لا تُستخرج من صور المرجع. اختبارات المتصفح: npm run test:browser، بعد تشغيل معاينة الإنتاج محلياً على 4173 أو تحديد APP_URL.

تحديث أسعار السوق: استُبدل مسار الأسعار المرجعية بمصدر Nerkhsanj الإيراني وبيانات IQWealth للسوق الموازي العراقي. تُعرض أوقات المصادر بصورة مستقلة، ولا يُختلق سعر أو نسبة تغيير. التفاصيل في README.md.

تحسينات الواجهة: تخفيف تكرار النص في الرئيسية، أرقام مالية غربية بفواصل، اتجاهات تحويل سريعة، حالات المبلغ والبحث الفارغ، المدن والأماكن المحفوظة، قائمة تجهيز، ميزانية، وتحسين لمس الأزرار والتركيز والتنقل. الخلفية والهوية الزرقاء من المرجع محفوظتان.
