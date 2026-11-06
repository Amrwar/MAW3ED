/**
 * English for the messages the API answers with.
 *
 * Routes write their messages once, in Arabic, the product's language.
 * When the request is English (lib/api-lang.ts decides), err() and the
 * other shared refusals (the rate limiter, the sign-in guard, Zod's own
 * messages) look the sentence up here instead of every route carrying
 * both languages.
 *
 * Keyed by the exact Arabic sentence. Sentences built with ${…} are
 * listed in TEMPLATES with {0}, {1}… where the values go; the value is
 * either an English sentence using the same markers or a function of
 * the values. api-messages-en.test.ts scans the routes and fails on any
 * Arabic message missing from here, so a new one cannot ship
 * Arabic-only.
 *
 * Pure: no imports, so the proxy can use it too.
 */

const ARABIC = /[\u0600-\u06FF]/;

export const MESSAGES: Record<string, string> = {
  /* ── General ── */
  "حصلت مشكلة عندنا، جرّب تاني بعد شوية": "Something went wrong on our side. Try again in a little while.",
  "حدث خطأ، حاول مرة أخرى": "Something went wrong. Try again.",
  "أعد المحاولة": "Please try again.",
  "بيانات غير صالحة": "Some details aren't right. Check them and try again.",
  "طلب غير صالح": "That request isn't valid.",
  "طلب غير صحيح": "That request isn't valid.",
  "قيمة غير صالحة": "That value isn't valid.",
  "غير موجود": "Not found.",
  "مش موجود": "Not found.",
  "مش متاح": "Not available.",
  "غير مصرح": "You're not allowed to do this.",
  "مش مسموح لك بالإجراء ده": "You're not allowed to do this.",
  "مينفعش": "That can't be done.",
  "مفيش تغيير": "Nothing changed.",
  "مفيش حاجة تتغير": "There's nothing to change.",
  "حصل تعديل في نفس الوقت — جرّب تاني": "Someone changed this at the same time. Try again.",
  "مرجع غير موجود": "Something this refers to no longer exists. Refresh and try again.",
  "القيم دي خارج الحدود المسموحة": "Some values are outside the allowed range.",
  "الضغط عالي دلوقتي، جرّب تاني بعد ثواني": "We're busy right now. Try again in a few seconds.",
  "محاولات كتير. استنى شوية وحاول تاني.": "Too many attempts. Wait a little and try again.",
  "حدث خطأ أثناء الحفظ": "Something went wrong while saving. Try again.",
  "حدث خطأ أثناء التحديث": "Something went wrong while updating. Try again.",
  "حدث خطأ أثناء التعديل": "Something went wrong while saving your changes. Try again.",
  "حدث خطأ أثناء الحذف": "Something went wrong while deleting. Try again.",
  "حدث خطأ أثناء حفظ البيانات": "Something went wrong while saving your details. Try again.",
  "حدث خطأ أثناء حفظ الإعدادات": "Something went wrong while saving the settings. Try again.",
  "تعذّر الحفظ، حاول تاني": "We couldn't save that. Try again.",

  /* ── Sign-in, accounts ── */
  "سجّل دخولك الأول": "Please sign in first.",
  "انتهت الجلسة، سجّل الدخول من تاني": "Your session has ended. Please sign in again.",
  "البريد الإلكتروني أو كلمة المرور غير صحيحة": "The email or password isn't right.",
  "أدخل البريد الإلكتروني": "Enter your email.",
  "البريد الإلكتروني غير صحيح": "That email isn't valid.",
  "الإيميل غير صحيح": "That email isn't valid.",
  "إيميل غير صالح": "That email isn't valid.",
  "اكتب إيميل صحيح": "Enter a valid email.",
  "أدخل كلمة المرور": "Enter your password.",
  "كلمة المرور يجب أن تكون 8 أحرف على الأقل": "The password must be at least 8 characters.",
  "هذا البريد الإلكتروني مسجل بالفعل": "This email is already registered.",
  "البريد ده مستخدم في حساب تاني": "This email is used by another account.",
  "حدث خطأ أثناء إنشاء الحساب": "Something went wrong while creating your account. Try again.",
  "خدمة البريد غير متاحة حالياً، حاول تاني بعد شوية": "Email isn't available right now. Try again in a little while.",
  "خدمة البريد غير متاحة حالياً. تواصل مع الدعم.": "Email isn't available right now. Please contact support.",
  "انتظر دقيقة قبل طلب رابط جديد": "Wait a minute before asking for a new link.",
  "ما قدرناش نبعت رابط التأكيد. حاول تاني بعد شوية.": "We couldn't send the confirmation link. Try again in a little while.",
  "ما قدرناش نبعت الرابط. حاول تاني بعد شوية.": "We couldn't send the link. Try again in a little while.",
  "الرابط غير صالح أو منتهي الصلاحية": "This link isn't valid or has expired.",
  "انتهت صلاحية هذا الرابط، أرسل طلبًا جديدًا": "This link has expired. Ask for a new one.",
  "لم يتم العثور على الحساب": "We couldn't find your account.",
  "مفيش بريد إلكتروني على الحساب": "There's no email on this account.",
  "مش قادرين نحدد الجهاز ده. سجّل خروج وادخل تاني.": "We can't identify this device. Sign out and sign in again.",
  "الاسم طويل جدًا": "The name is too long.",
  "الاسم قصير جدًا": "The name is too short.",
  "أدخل اسمك الكامل": "Enter your full name.",

  /* ── Phone and codes ── */
  "أدخل رقم الموبايل": "Enter your mobile number.",
  "اكتب رقم الموبايل والكود": "Enter your mobile number and the code.",
  "حسابك عليه رقم موبايل متأكّد بالفعل": "Your account already has a confirmed mobile number.",
  "الرقم ده مربوط بحساب تاني على موعد. اخرج وادخل برقم الموبايل عشان توصل لحجوزاته.":
    "This number belongs to another Maw3ed account. Sign out, then sign in with the mobile number to reach its bookings.",
  "أدخل رقم الهاتف": "Enter a phone number.",
  "أدخل رقم الواتساب": "Enter your WhatsApp number.",
  "رقم الموبايل غير صحيح": "That mobile number isn't valid.",
  "رقم الموبايل غير صالح": "That mobile number isn't valid.",
  "رقم الهاتف غير صحيح": "That phone number isn't valid.",
  "رقم الموبايل طويل": "The mobile number is too long.",
  "رقم الموبايل غير صحيح — اكتبه بكود الدولة، مثلاً ‎+20 10 1234 5678":
    "That mobile number isn't valid. Include the country code, e.g. +20 10 1234 5678.",
  "معرفناش نبعت الكود دلوقتي. جرّب تاني بعد شوية.": "We couldn't send the code right now. Try again in a little while.",
  "تعذّر إرسال الكود، حاول تاني": "We couldn't send the code. Try again.",
  "استنى دقيقة قبل ما تطلب كود جديد": "Wait a minute before asking for a new code.",
  "انتظر دقيقة قبل طلب كود جديد": "Wait a minute before asking for a new code.",
  "طلبت أكواد كتير. جرّب تاني بعد شوية": "You've asked for too many codes. Try again in a little while.",
  "الكود غير صحيح أو انتهت صلاحيته": "That code isn't right or has expired.",
  "الحساب ده بيدخل بالإيميل وكلمة السر أو بجوجل، مش بكود التليفون": "This account signs in with email and password, or with Google, not with a phone code.",
  "الكود لازم يكون 6 أرقام": "The code must be 6 digits.",
  "اطلب كود جديد الأول": "Ask for a new code first.",
  "الكود انتهت صلاحيته — اطلب كود جديد": "That code has expired. Ask for a new one.",
  "حاولت كتير — اطلب كود جديد": "Too many tries. Ask for a new code.",
  "اكتب الكود اللي وصلك": "Enter the code you received.",
  "الكود مش صحيح": "That code isn't right.",
  "الكود انتهى. اطلب كود جديد": "That code has expired. Ask for a new one.",
  "محاولات كتير. اطلب كود جديد": "Too many tries. Ask for a new code.",
  "تعذّر التحقق من الكود، حاول تاني": "We couldn't check the code. Try again.",
  "الكود غير صالح": "That code isn't valid.",
  "تعذّر إنشاء الكود": "We couldn't create the code. Try again.",

  /* ── Account deletion, profile, favourites ── */
  "الحساب ده مربوط بنشاط. كلّم الدعم عشان تقفل النشاط الأول.":
    "This account is linked to a business. Contact support to close the business first.",
  "حساب الإدارة مايتحذفش من هنا": "Admin accounts can't be deleted here.",
  "محتاجين رقم موبايل متأكَّد منه عشان نتأكد إنه إنت": "We need a confirmed mobile number to make sure it's you.",
  "محتاجين رقم موبايل متأكَّد منه": "We need a confirmed mobile number.",
  "اكتب الكود وأكّد الحذف": "Enter the code and confirm the deletion.",
  "حصل خطأ ومتحذفش الحساب. حاول تاني.": "Something went wrong and the account wasn't deleted. Try again.",
  "النشاط غير موجود": "We couldn't find that business.",
  "اختار النشاط الأول": "Choose a business first.",
  "لم يتم العثور على عملك": "We couldn't find your business.",
  "لم يتم العثور على هذا العمل": "We couldn't find this business.",
  "إنت بتدير نشاط تاني دلوقتي — اخرج من وضع الإدارة الأول":
    "You're managing another business right now. Leave that mode first.",

  /* ── Bookings (customer) ── */
  "الحجز غير موجود": "Booking not found.",
  "لم يتم العثور على هذا الحجز": "We couldn't find this booking.",
  "لا يمكن إلغاء هذا الحجز": "This booking can't be cancelled.",
  "الحجز اتغيّر دلوقتي، حدّث الصفحة وجرّب تاني": "The booking just changed. Refresh the page and try again.",
  "حدث خطأ أثناء الإلغاء": "Something went wrong while cancelling. Try again.",
  "تاريخ غير صحيح": "That date isn't valid.",
  "وقت غير صحيح": "That time isn't valid.",
  "صيغة الوقت غير صحيحة": "That time isn't in the right format.",
  "الحجز ده مينفعش يتغيّر ميعاده": "This booking's time can't be changed.",
  "لا يمكن الحجز في تاريخ ماضٍ": "You can't book a date that has passed.",
  "الموعد ده مش متاح، اختر وقت تاني": "That time isn't available. Choose another.",
  "الباقة أو الاشتراك مش بيغطي الميعاد الجديد، اختر وقت تاني":
    "Your package or membership doesn't cover the new time. Choose another.",
  "حد تاني حجز الموعد ده دلوقتي، اختر وقت تاني": "Someone just booked that time. Choose another.",
  "حصلت مشكلة وإحنا بنغيّر الميعاد، جرّب تاني بعد شوية":
    "Something went wrong while changing the time. Try again in a little while.",
  "اختر خدمة": "Choose a service.",
  "اختار الخدمة واليوم": "Choose a service and a day.",
  "اختار التاريخ والوقت": "Choose a date and a time.",
  "أكّد رقم موبايلك بالكود الأول": "Confirm your mobile number with the code first.",
  "حجوزات كتير بالرقم ده في ساعة واحدة. جرّب بعد شوية.":
    "Too many bookings with this number in one hour. Try again in a little while.",
  "المكان ده مش بيستقبل مرافقين": "This place doesn't take extra guests.",
  "الحجز أونلاين مش متاح للرقم ده بسبب مواعيد فاتت من غير حضور. كلّم المكان عشان تحجز.":
    "Online booking isn't available for this number because of missed appointments. Contact the place to book.",
  "الحجز التجريبي مبيستخدمش نقاط أو باقات": "A test booking can't use points or packages.",
  "سجّل دخولك بالرقم ده أو أكّده بالكود عشان تستخدم رصيدك":
    "Sign in with this number, or confirm it with the code, to use your balance.",
  "الكود ده مش موجود": "That code doesn't exist.",
  "المكان ده مفيهوش برنامج نقاط": "This place doesn't have a points program.",
  "المكان ده مش بيستقبل حجوزات أونلاين دلوقتي. كلّمهم مباشرة عشان تحجز.":
    "This place isn't taking online bookings right now. Contact them directly to book.",
  "العرض خلص دلوقتي، جرّب تحجز من غير كود": "The offer has just ended. Try booking without a code.",
  "مفيش ترابيزة تكفي العدد ده، قلّل العدد أو كلّم المكان":
    "No table fits that many people. Lower the number or contact the place.",
  "مفيش ترابيزة تكفي العدد ده": "No table fits that many people.",
  "الصفحة اتنشرت دلوقتي — الحجز التجريبي مبقاش متاح. احجز عادي لو عايز.":
    "The page was just published, so test bookings are no longer available. Book normally if you like.",
  "النقاط اتصرفت في حجز تاني. جرّب من غير نقاط.": "The points were used on another booking. Try without points.",
  "حدث خطأ أثناء الحجز، حاول مرة أخرى": "Something went wrong while booking. Try again.",
  "الوقت ده عدّى خلاص": "That time has already passed.",
  "الحجز مش مفتوح للتاريخ ده لسه": "Booking isn't open for that date yet.",
  "قفل الحجز لليوم، جرّب بكرة": "Booking for today has closed. Try tomorrow.",
  "النشاط مقفول في الوقت ده": "The place is closed at that time.",
  "المول أو المجمع اللي فيه النشاط مقفول أو موقف الحجز في اليوم ده":
    "The mall or complex this place is in is closed or not taking bookings that day.",
  "الموظف ده مش متاح في الوقت ده": "That staff member isn't available at that time.",
  "النشاط مقفول في اليوم ده (إجازة)": "The place is closed that day (holiday).",
  "الموظف ده في إجازة": "That staff member is on leave.",
  "التاريخ ده مش متاح للحجز": "That date isn't available for booking.",

  /* ── Discount codes ── */
  "الكود ده مش شغّال": "This code isn't active.",
  "الكود ده لسه مابدأش": "This code hasn't started yet.",
  "الكود ده انتهت صلاحيته": "This code has expired.",
  "الكود ده مش على الخدمة دي": "This code doesn't apply to this service.",
  "قيمة الحجز أقل من الحد المطلوب للكود ده": "The booking total is below this code's minimum.",
  "الكود ده خلص عدد مرات استخدامه": "This code has been used up.",
  "إنت استخدمت الكود ده قبل كده": "You've already used this code.",
  "الكود ده مش هيغيّر السعر": "This code won't change the price.",
  "الكود ده مش متاح للحجز ده دلوقتي": "This code isn't available for this booking right now.",

  /* ── Payments (customer) ── */
  "رابط غير صالح": "This link isn't valid.",
  "الرابط غير صالح": "This link isn't valid.",
  "الرابط غير صحيح": "This link isn't valid.",
  "الرابط غير صالح أو اتلغى": "This link isn't valid or was cancelled.",
  "الحجز ده مش مستني دفع": "This booking isn't waiting for payment.",
  "الدفع وصل خلاص، التأكيد جاي": "Your payment arrived. The confirmation is on its way.",
  "في صفحة دفع لسه شغالة للحجز ده. كمّلها، أو استنى لحد ما تخلص صلاحيتها.":
    "There's already an open payment page for this booking. Finish it, or wait until it expires.",

  /* ── Reviews ── */
  "التقييم لازم يكون من 1 لـ 5": "The rating must be from 1 to 5.",
  "الحجز التجريبي مش بيتقيّم": "Test bookings can't be reviewed.",
  "تم تقييم هذا الحجز من قبل": "This booking has already been reviewed.",
  "التقييم متاح بعد ميعاد الحجز": "You can review after the appointment time.",
  "التقييم متاح بعد ما الموعد يكتمل": "You can review once the appointment is complete.",
  "حدث خطأ أثناء حفظ التقييم": "Something went wrong while saving your review. Try again.",
  "لم يتم العثور على هذا التقييم": "We couldn't find this review.",
  "مش هينفع تعدّل التقييم بعد مرور المدة": "The time to edit this review has passed.",
  "التقييم ده اتسحب": "This review was withdrawn.",
  "التقييم ده تحت المراجعة": "This review is under review.",
  "مش هينفع تسحب التقييم بعد مرور المدة": "The time to withdraw this review has passed.",
  "التقييم ده مش قابل للسحب": "This review can't be withdrawn.",
  "اختر سبب الإبلاغ": "Choose a reason for the report.",
  "وصلت للحد الأقصى من البلاغات النهارده": "You've reached today's limit on reports.",
  "التقييم غير موجود": "Review not found.",
  "اكتب ردًا": "Write a reply.",
  "حدث خطأ أثناء حفظ الرد": "Something went wrong while saving the reply. Try again.",

  /* ── Waitlists ── */
  "العرض انتهى — هنبعتلك لو فضي ميعاد تاني": "The offer has ended. We'll message you if another time opens up.",
  "للأسف حد حجز الميعاد ده قبلك — لسه في قائمة الانتظار":
    "Sorry, someone booked that time first. You're still on the waitlist.",
  "كلّم المكان عشان تحجز": "Contact the place to book.",
  "المكان ده مش مفعّل قائمة الانتظار": "This place doesn't have a waitlist.",
  "اختار وقت بداية قبل وقت النهاية": "Choose a start time before the end time.",
  "الخدمة غير موجودة": "Service not found.",
  "خدمة غير موجودة": "Service not found.",
  "إنت في قائمة الانتظار لليوم ده بالفعل": "You're already on the waitlist for that day.",
  "قائمة الانتظار لليوم ده كاملة": "The waitlist for that day is full.",
  "تعذّر إرسال إيميل التأكيد، حاول تاني بعد شوية": "We couldn't send the confirmation email. Try again in a little while.",

  /* ── Search ── */
  "الموقع غير صالح": "That location isn't valid.",
  "حدث خطأ أثناء البحث": "Something went wrong while searching. Try again.",

  /* ── Uploads ── */
  "لم يتم رفع أي ملف": "No file was uploaded.",
  "نوع الملف غير مدعوم. استخدم JPG أو PNG أو WebP": "That file type isn't supported. Use JPG, PNG or WebP.",
  "حجم الصورة يجب أن يكون أقل من 5MB": "The image must be smaller than 5 MB.",
  "مجلد غير معروف": "Unknown upload folder.",
  "الملف مش صورة من النوع المذكور": "The file isn't an image of the type it says.",
  "حدث خطأ أثناء رفع الصورة، حاول مرة أخرى": "Something went wrong while uploading the image. Try again.",

  /* ── Onboarding, business profile ── */
  "لديك عمل مسجل بالفعل": "You already have a business registered.",
  "المسودة كبيرة جدًا": "The draft is too large.",
  "هذا الرابط محجوز، جرّب رابطًا آخر": "This link is taken. Try another one.",
  "الرابط قصير جدًا": "The link is too short.",
  "الرابط طويل جدًا": "The link is too long.",
  "يجب أن يحتوي الرابط على أحرف إنجليزية صغيرة وأرقام وشرطات فقط":
    "The link can only have lowercase English letters, numbers and dashes.",
  "الرابط حروف إنجليزية صغيرة وأرقام وشرطات": "The link can only have lowercase English letters, numbers and dashes.",
  "الرابط لا يجب أن يبدأ أو ينتهي بشرطة": "The link can't start or end with a dash.",
  "الرابط ده محجوز": "This link is reserved.",
  "الرابط مستخدم": "This link is already used.",
  "أدخل اسم العمل بالعربية": "Enter the business name in Arabic.",
  "أدخل اسم العمل": "Enter the business name.",
  "اختر التخصص": "Choose a specialty.",
  "اختر المدينة": "Choose a city.",
  "اختار المدينة": "Choose a city.",
  "أضف خدمة واحدة على الأقل": "Add at least one service.",
  "أدخل اسم الخدمة": "Enter the service name.",
  "الموقع محتاج خط العرض وخط الطول مع بعض": "The location needs both latitude and longitude.",
  "الموقع لازم يكون خط عرض وخط طول مع بعض": "The location needs both latitude and longitude.",
  "الموقع ده مش صحيح": "That location isn't valid.",
  "رابط صورة الغلاف غير صحيح": "The cover image link isn't valid.",
  "رابط الشعار غير صحيح": "The logo link isn't valid.",
  "نوع العمل غير صالح": "That business type isn't valid.",
  "فاضل تأكيد الإيميل بس. أول ما تفتح الرابط هتتنشر صفحتك تلقائي.":
    "Only your email confirmation is left. Your page will go live as soon as you open the link.",
  "لسه في حاجات مطلوبة قبل النشر": "A few things are still needed before publishing.",
  "الصفحة موقوفة من الإدارة. كلّم الدعم.": "Your page was suspended by our team. Please contact support.",

  /* ── Business dashboard ── */
  "التحليلات متاحة في الباقات المدفوعة": "Analytics are available on paid plans.",
  "حدد بداية ونهاية الفترة": "Choose a start and an end for the period.",
  "بداية الفترة لازم تكون قبل نهايتها": "The period must start before it ends.",
  "الفترة طويلة جدًا": "The period is too long.",
  "حدد فترة من يوم لـ 31 يوم": "Choose a period of 1 to 31 days.",
  "المدة من يوم لـ 31 يوم": "The period must be 1 to 31 days.",
  "الإدارة المفوّضة على فرع واحد مش بتضيف حجوزات يدوي": "Delegated management of one branch can't add bookings by hand.",
  "اختار باقة أو عضوية، مش الاتنين": "Choose a package or a membership, not both.",
  "الموظف غير موجود": "Staff member not found.",
  "الرصيد مرتبط برقم موبايل — اكتب رقم الموبايل": "Balances are tied to a mobile number. Enter the mobile number.",
  "مفيش برنامج نقاط مفعّل": "There's no active points program.",
  "النقاط مش كفاية للخصم": "Not enough points for the discount.",
  "النقاط مش كفاية": "Not enough points.",
  "الباقة أو العضوية مبقاش فيها جلسات للموعد ده": "The package or membership has no sessions left for this time.",
  "هذا الموعد يتعارض مع حجز موجود، اختر وقتًا آخر": "This time clashes with an existing booking. Choose another.",
  "حدث خطأ أثناء إنشاء الحجز": "Something went wrong while creating the booking. Try again.",
  "طريقة الدفع مطلوبة": "Choose a payment method.",
  "ده حجز تجريبي — مفيش دفع عليه": "This is a test booking, so there's nothing to pay.",
  "الحجز ملغي": "The booking is cancelled.",
  "الحجز ده اتلغى لأن الدفع ما اكتملش، اعمل حجز جديد":
    "This booking was cancelled because the payment didn't complete. Make a new booking.",
  "الحجز مدفوع بالكامل": "The booking is fully paid.",
  "الحجز ده اتلغى أو اتفك حجزه، اعمل حجز جديد": "This booking was cancelled or released. Make a new booking.",
  "إرسال رابط دفع متاح في الخطط المدفوعة": "Sending a payment link is available on paid plans.",
  "لسه عامل رابط دفع للحجز ده من دقايق. استنى شوية قبل ما تعمل رابط جديد.":
    "You made a payment link for this booking a few minutes ago. Wait a little before making a new one.",
  "تعذّر إنشاء رابط الدفع، حاول مرة أخرى": "We couldn't create the payment link. Try again.",
  "الحالة دي متاحة بعد ما ميعاد الحجز يبدأ": "This status is available once the booking time starts.",
  "حدث خطأ أثناء تحديث الحالة": "Something went wrong while updating the status. Try again.",
  "أدخل اسم الفرع": "Enter the branch name.",
  "الفرع غير موجود": "Branch not found.",
  "العميل غير موجود": "Customer not found.",
  "النسبة لازم تكون من 1 لـ 100": "The percentage must be from 1 to 100.",
  "النسبة من 1 لـ 100": "The percentage must be from 1 to 100.",
  "تاريخ الانتهاء لازم يكون بعد تاريخ البداية": "The end date must be after the start date.",
  "تاريخ الانتهاء لازم يكون بعد البداية": "The end date must be after the start.",
  "الكود ده مستخدم عندك بالفعل": "You already have this code.",
  "فيه خدمة مش تابعة للنشاط ده": "One of the services isn't part of this business.",
  "العرض غير موجود": "Offer not found.",
  "العرض ده اتستخدم قبل كده، تقدر توقّفه بس مش تمسحه": "This offer has been used, so you can pause it but not delete it.",
  "الملف فاضي أو أكبر من ١ ميجا": "The file is empty or bigger than 1 MB.",
  "مفيش صفوف صالحة للاستيراد": "There are no valid rows to import.",
  "الاستيراد ده مش موجود": "Import not found.",
  "الاستيراد ده اتلغى قبل كده": "This import was already undone.",
  "اكتب عدد نقاط": "Enter a number of points.",
  "اكتب السبب": "Write the reason.",
  "التعديل اليدوي متاح لبرنامج النقاط الخاص بيك بس": "Manual changes are only for your own points program.",
  "الدعوة مش موجودة": "Invitation not found.",
  "الخطة دي موقوفة": "This plan is paused.",
  "الخطة غير موجودة": "Plan not found.",
  "مينفعش في حالتها دي": "That can't be done in its current state.",
  "مدفوعة لفترة قدّام بالفعل": "It's already paid ahead.",
  "خلص رصيد الإيقاف (60 يوم)": "The pause allowance (60 days) is used up.",
  "المبلغ أكبر من المدفوع": "The amount is more than what was paid.",
  "فيه حجوزات جاية بتستخدمها — ألغيها الأول": "Upcoming bookings use it. Cancel them first.",
  "مفيش دفعة نقدية مسجلة ليها": "There's no cash payment recorded for it.",
  "أدخل الاسم": "Enter the name.",
  "التكرار من أسبوع لـ 4، ومن مرتين لـ 12 مرة": "Repeat every 1 to 4 weeks, 2 to 12 times.",
  "حدث خطأ أثناء إضافة الخدمة": "Something went wrong while adding the service. Try again.",
  "نسبة العربون لازم تكون رقم من 1 لـ 100": "The deposit must be a number from 1 to 100.",
  "نسبة العربون لازم تكون رقم صحيح من 1 لـ 100": "The deposit must be a whole number from 1 to 100.",
  "نسبة العربون لازم تكون من 1 لـ 100": "The deposit must be from 1 to 100.",
  "العربون متاح في الباقات المدفوعة": "Deposits are available on paid plans.",
  "اسم الموظف بالعربية مطلوب": "Enter the staff member's name in Arabic.",
  "اختار الخدمات من القائمة": "Choose services from the list.",
  "الرقم ده مينفعش يتستخدم، اكتب رقم تاني": "This number can't be used. Enter another one.",
  "ده رقم النشاط أو رقمك إنت، اكتب رقم الموظف": "That's the business's number or yours. Enter the staff member's number.",
  "وقت النهاية لازم يكون بعد البداية": "The end time must be after the start.",
  "يوم مكرر": "A day is repeated.",
  "الموظف ده مش موجود": "That staff member doesn't exist.",
  "تفعيل وإيقاف حساب دخول الموظف لصاحب النشاط بس": "Only the business owner can turn a staff sign-in on or off.",
  "العمولة يحددها صاحب النشاط بس": "Only the business owner can set commission.",
  "العمولة نسبة من 0 لـ 100": "Commission must be a percentage from 0 to 100.",
  "حذف موظف له حساب دخول لصاحب النشاط بس": "Only the business owner can delete a staff member who can sign in.",
  "خطة غير صالحة": "That plan isn't valid.",
  "الدفع بالكارت الدولي مش متاح دلوقتي": "International card payment isn't available right now.",
  "لا يمكن تنفيذ هذه الترقية": "This upgrade can't be done.",
  "تعذّر بدء عملية الدفع، حاول مرة أخرى": "We couldn't start the payment. Try again.",
  "للرجوع لخطة أقل، سيب الاشتراك الحالي يخلص وبعدها اختار الخطة الجديدة.":
    "To move to a lower plan, let the current subscription end, then choose the new plan.",
  "اسم الطاولة مطلوب": "Enter the table name.",
  "السعة يجب أن تكون 1 على الأقل": "The capacity must be at least 1.",
  "الطاولة دي مش موجودة": "That table doesn't exist.",
  "اختر يوم في الأسبوع أو تاريخ": "Choose a weekday or a date.",
  "تاريخ النهاية لازم يكون بعد البداية": "The end date must be after the start.",
  "أدخل وقت البداية والنهاية، أو سيبهم فاضيين لليوم كله":
    "Enter a start and end time, or leave both empty for the whole day.",
  "اختار الوقت المقفول اللي عايز تشيله": "Choose the blocked time you want to remove.",
  "قايمة الانتظار للنشاط كله، والصلاحية دي لفروع معيّنة بس":
    "The waitlist covers the whole business, and this access is for certain branches only.",

  /* ── Business CSV import ── */
  "الملف أكبر من ١ ميجا": "The file is bigger than 1 MB.",
  "الصف فيه خانات أكتر من العناوين — لو في قيمة فيها فاصلة حطها بين علامتين \"":
    "This row has more cells than headers. If a value has a comma, put it in double quotes (\").",
  "لازم الملف يكون فيه عمود للاسم وعمود للموبايل": "The file needs a name column and a mobile column.",
  "الاسم فاضي": "The name is empty.",
  "الاسم أطول من ١٢٠ حرف": "The name is longer than 120 characters.",
  "لازم الملف يكون فيه أعمدة: الخدمة، المدة، السعر": "The file needs these columns: service, duration, price.",
  "اسم الخدمة فاضي": "The service name is empty.",
  "اسم الخدمة أطول من ١٢٠ حرف": "The service name is longer than 120 characters.",
  "المدة لازم تكون رقم صحيح من ٥ لـ ٧٢٠ دقيقة": "The duration must be a whole number from 5 to 720 minutes.",
  "السعر لازم يكون رقم موجب (لحد قرشين عشري)": "The price must be a positive number (up to 2 decimal places).",

  /* ── Admin (Arabic-only screens; translated for completeness) ── */
  "إجراء غير معروف": "Unknown action.",
  "اكتب إيه اللي اتراجع (سجل تجاري، عقد، مكالمة على الرقم) — التوثيق معناه إننا اتأكدنا مين صاحب النشاط":
    "Write what was checked (commercial register, contract, a call to the number). Verifying means we confirmed who owns the business.",
  "اكتب سبب — صاحب المكان هيشوفه": "Write a reason. The owner will see it.",
  "الجهة مش موجودة": "Organization not found.",
  "المدينة مش موجودة": "City not found.",
  "الحي مش في المدينة دي": "That area isn't in this city.",
  "نهاية الاتفاق لازم تكون بعد بدايته": "The agreement must end after it starts.",
  "مفيش اتفاق ساري": "There's no active agreement.",
  "اكتب السبب — بيظهر للجهة": "Write the reason. The organization will see it.",
  "فترة غير صحيحة (من يوم لـ 92 يوم)": "That period isn't valid (1 to 92 days).",
  "الدفعة غير موجودة": "Payment not found.",
  "المبلغ أكبر من المتبقي": "The amount is more than what's left.",
  "تعذّر الاسترجاع": "The refund couldn't be done.",
  "مزوّد الدفع مردّش. الاسترجاع متعلّق لحد ما يتأكد — متكرّرش الطلب.":
    "The payment provider didn't answer. The refund is pending until it's confirmed. Don't repeat the request.",
  "رفض مزوّد الدفع عملية الاسترجاع": "The payment provider refused the refund.",
  "المبلغ لازم يكون أكبر من صفر": "The amount must be more than zero.",
  "لا يمكن استرجاع دفعة لم تنجح": "A payment that didn't succeed can't be refunded.",
  "تم استرجاع هذه الدفعة بالكامل": "This payment has already been fully refunded.",
  "مفيش حساب بالإيميل ده. لازم الشخص يسجّل الأول.": "There's no account with this email. The person needs to sign up first.",
  "الحساب ده لسه ما أكّدش إيميله. اطلب منه يأكّده الأول.":
    "This account hasn't confirmed its email yet. Ask them to confirm it first.",
  "الحساب ده لسه ما أكّدش إيميله.": "This account hasn't confirmed its email yet.",
  "النطاق ده مش موجود": "That scope doesn't exist.",
  "الدور ده موجود بالفعل": "That role already exists.",
  "الدور لازم يكون على نطاق واحد مناسب له": "The role must be on exactly one scope that suits it.",
  "الكمبوند مش موجود": "Compound not found.",
  "المكان لازم يكون في نفس مدينة الكمبوند": "The venue must be in the same city as the compound.",
  "الكمبوند في مدينة تانية": "The compound is in another city.",
  "مفيش مفتاح ساري للمكان ده": "There's no active key for this venue.",
  "اختار مزوّد البوابات للمكان الأول": "Choose the venue's gate provider first.",
  "مفتاح التشفير مش متظبط على السيرفر": "The encryption key isn't set up on the server.",
  "المكان غير موجود": "Venue not found.",
  "لازم المكان يكون مفعّل قبل النشر": "The venue must be active before publishing.",
  "قبول": "approve",
  "رفض": "reject",
  "إيقاف": "suspend",
  "إرجاع": "restore",
  "توثيق": "verify",
  "إلغاء التوثيق": "unverify",
  "تمييز": "feature",
  "إلغاء التمييز": "unfeature",
  "بانتظار المراجعة": "pending review",
  "مقبول": "approved",
  "مرفوض": "rejected",
  "موقوف": "suspended",

  /* ── Organizations ── */
  "أكّد إيميلك الأول عشان تسجّل جهة": "Confirm your email first to register an organization.",
  "مفيش اتفاق ساري مع المنصة يسمح بمفاتيح API": "There's no active agreement with us that allows API keys.",
  "وصلت للحد الأقصى من المفاتيح في الاتفاق": "You've reached the agreement's limit on keys.",
  "صلاحيات غير صحيحة": "Those permissions aren't valid.",
  "المفتاح غير موجود أو اتلغى قبل كده": "The key doesn't exist or was already revoked.",
  "عدد المفاتيح الشغّالة وصل للحد — استنى المفتاح القديم يخلص أو الغيه":
    "You've reached the limit on active keys. Wait for the old key to expire, or revoke it.",
  "المفتاح ده اتغيّر أو اتلغى قبل كده — غيّر المفتاح الجديد":
    "This key was already rotated or revoked. Rotate the new key instead.",
  "المفتاح غير موجود": "Key not found.",
  "الشخص ده مالك الجهة بالفعل": "This person already owns the organization.",
  "لازم موعد يراجع الجهة ويعتمدها قبل النشر": "Maw3ed needs to review and approve the organization before publishing.",
  "مفيش اتفاق ساري مع المنصة يسمح بالـ webhooks": "There's no active agreement with us that allows webhooks.",
  "وصلت للحد الأقصى من العناوين في الاتفاق": "You've reached the agreement's limit on addresses.",
  "العنوان لازم يكون https عام (مش عنوان داخلي)": "The address must be a public https address (not an internal one).",
  "اختار أحداث صحيحة": "Choose valid events.",
  "العنوان غير موجود": "Address not found.",
  "الجهة دي مش موجودة": "That organization doesn't exist.",
  "الجهة دي مش بتقبل انضمام دلوقتي": "That organization isn't accepting new members right now.",
  "مفيش نشاط بالرابط ده": "There's no business with this link.",
  "الفرع ده مش تبع النشاط": "That branch isn't part of the business.",
  "في ارتباط قايم بالفعل بين النشاط والجهة دي": "The business and this organization are already linked.",
  "النشاط كله أو فرع منه مرتبط بالفعل بالجهة دي": "The business, or one of its branches, is already linked to this organization.",
  "الطلب ده مش موجود": "That request doesn't exist.",
  "الحالة اتغيرت بالفعل — حدّث الصفحة": "The status has already changed. Refresh the page.",
  "الدعوة دي مش موجودة أو اتلغت": "This invitation doesn't exist or was cancelled.",
  "الدعوة دي انتهت صلاحيتها": "This invitation has expired.",
  "النشاط ده مملوك لجهة تانية بالفعل — النشاط له جهة مالكة واحدة بس":
    "This business is already owned by another organization. A business can have only one owner.",
  "نوع العلاقة لازم يكون: مملوك، مستضاف، أو مُدار": "The relationship must be: owned, hosted or managed.",
  "الصلاحيات دي مش مسموحة للنوع ده من العلاقة": "Those permissions aren't allowed for this kind of relationship.",
  "الطرف اللي أوقف العلاقة هو بس اللي يقدر يرجّعها": "Only the side that paused the relationship can resume it.",
  "الترتيب ده مش ممكن: هيعمل دايرة أو أعمق من 3 مستويات":
    "That arrangement isn't possible: it would make a loop or go deeper than 3 levels.",
  "الصورة لازم تكون مرفوعة على موعد": "The image must be uploaded to Maw3ed.",
  "الرابط لازم يبدأ بـ http أو https": "The link must start with http or https.",
  "تاريخ الانتهاء لازم يكون في المستقبل": "The end date must be in the future.",
  "اللون لازم يكون بصيغة ‎#RRGGBB": "The colour must be in #RRGGBB format.",

  /* ── Venues ── */
  "المكان ده مش موجود": "That venue doesn't exist.",
  "المكان ده مش بيقبل طلبات دلوقتي": "That venue isn't accepting requests right now.",
  "الفرع ده مش تبعك": "That branch isn't yours.",
  "في طلب أو عضوية قايمة بالفعل للمكان والفرع دول": "There's already a request or membership for this venue and branch.",
  "الطلب اتغير حالته بالفعل — حدّث الصفحة": "The request's status has already changed. Refresh the page.",
  "الدور أو المنطقة دي مش في المكان ده": "That floor or area isn't in this venue.",
  "نشاطك ليه أكتر من فرع — اختار الفرع اللي جوه المكان":
    "Your business has more than one branch. Choose the branch inside the venue.",
  "النشاط كله أو فرع منه معروض أو مطلوب بالفعل في المكان ده":
    "The business, or one of its branches, is already listed or requested in this venue.",
  "المكان رفض الطلب ده من أقل من أسبوع — كلّم إدارة المكان الأول":
    "The venue declined this request less than a week ago. Contact the venue's management first.",
  "كل يوم مرة واحدة": "Each day can appear only once.",
  "تاريخ النهاية قبل البداية": "The end date is before the start.",
  "المواعيد الخاصة محتاجة وقت فتح وقفل": "Special hours need an opening and a closing time.",
  "السبب طويل — 300 حرف بالكتير": "The reason is too long (300 characters at most).",
  "التصريح ده مش في حالة تسمح بالإجراء ده": "This pass can't take that action in its current state.",
  "اكتب اللي حصل": "Describe what happened.",
  "الكلام طويل — 300 حرف بالكتير": "That's too long (300 characters at most).",
  "مزوّد غير صالح": "That provider isn't valid.",
  "كود المكان طويل — 120 حرف بالكتير": "The venue code is too long (120 characters at most).",
  "مزوّد غير موجود": "Provider not found.",
  "المزوّد ده مش متاح هنا": "That provider isn't available here.",
  "لازم مزوّد دخول متاح قبل تشغيل تصاريح الزوار": "An access provider must be available before turning on visitor passes.",
  "المكان ده مش في كمبوند": "This venue isn't in a compound.",
  "بوابة مش تبع المكان ده": "A gate doesn't belong to this venue.",

  /* ── Visitor passes ── */
  "تصاريح الدخول مش متاحة للحجز ده": "Visitor passes are not available for this booking.",
  "الحجز مش مؤهل لتصريح دخول دلوقتي": "This booking cannot have a visitor pass right now.",
  "وصلت لأقصى عدد مرافقين يسمح بيه المكان": "You have reached the venue's limit on guests.",
  "المكان بيطلب رقم موبايل": "The venue needs a mobile number.",
  "مفيش حاجة تتعاد هنا": "There is nothing to retry here.",
  "اكتب الاسم": "Enter a name.",
  "الاسم طويل — 80 حرف بالكتير": "The name is too long (80 characters at most).",
  "حجز تجريبي — مفيش تصريح دخول": "Test booking — no visitor pass.",
  "اتشال من الحجز": "Removed from the booking.",
  "الميعاد خلص": "The appointment is over.",
  "الحجز لسه مستني تأكيد المكان": "The booking is waiting for the business to confirm.",
  "الحجز مستني الدفع": "The booking is waiting for payment.",
  "الحجز اتلغى": "The booking was cancelled.",
  "اتسجل إنك محضرتش": "Recorded as a no-show.",
  "الدفع مكملش": "The payment did not complete.",
  "الحجز من غير ميعاد محدد": "The booking has no set time.",
  "المكان مش بيستقبل حجوزات دلوقتي": "The business is not open for bookings right now.",
  "المكان ده مش معروض في المول": "This business is not listed in the venue.",
  "المول مش شغال حاليًا": "The venue is not active.",
  "تصاريح الدخول مش متاحة في المكان ده": "Visitor passes are not offered at this venue.",
  "تصاريح الدخول مش متاحة لسه": "Visitor passes are not available yet.",
  "الدخول هنا مش بالحجز — اتبع تعليمات المكان": "Entry here is not by booking — follow the venue's instructions.",
  "أكتر من عدد المرافقين المسموح": "Over the venue's guest limit.",
  "لازم اسم": "A name is required.",
  "وقت الدخول خلص": "The access window has passed.",
  "عدّى وقت الحضور المسموح من غير ما تيجي": "The venue's arrival cut-off passed before you arrived.",
  "دخول الزوار موقوف من إدارة المكان في اليوم ده": "The venue has suspended visitor access that day.",
  "إدارة الأمن وقفت التصريح": "Suspended by the venue's security.",
  "الحجز اتغيّر — التصريح بيتحدّث": "The booking changed — the pass is being updated.",

  /* ── Zod's own (lib/zod-arabic.ts) ── */
  "في بيانات ناقصة، راجع الحقول المطلوبة": "Some details are missing. Check the required fields.",
  "في بيانات مش بالشكل المتوقع": "Some details aren't in the expected format.",
  "القيمة دي مش من الاختيارات المتاحة": "That value isn't one of the options.",
  "القيمة أقصر من المسموح": "That value is too short.",
  "القيمة أطول من المسموح": "That value is too long.",
  "الصيغة مش صحيحة": "That format isn't right.",
};

type Template = string | ((values: string[]) => string);

/** "1 try" / "3 tries", from an Arabic count. */
function tries(value: string): string {
  const n = countOf(value);
  if (n === null) return "a few tries";
  return `${n} ${n === 1 ? "try" : "tries"}`;
}

export const TEMPLATES: Record<string, Template> = {
  "لا يمكن إلغاء الحجز قبل الموعد بأقل من {0} ساعة":
    "It's too close to the appointment to cancel online (the limit is {0} hours before). Contact the place.",
  "مينفعش تغيّر الميعاد لما يكون فاضل عليه {0} ساعة أو أقل":
    "It's too close to the appointment to change it online ({0} hours or less before). Contact the place.",
  "أقصى عدد مرافقين {0}": "The most guests you can bring is {0}.",
  "المبلغ أكبر من المتبقي ({0})": "The amount is more than what's left ({0}).",
  "الحجز مستني العربون؛ سجّل {0} على الأقل عشان يتثبّت":
    "The booking is waiting for its deposit. Record at least {0} to confirm it.",
  "لا يمكن تغيير الحالة من \"{0}\" إلى \"{1}\"": "The status can't change from \"{0}\" to \"{1}\".",
  "الحالة دي متاحة قبل الموعد بـ {0} دقيقة بس": "This status is only available from {0} minutes before the appointment.",
  "الفروع المتعددة متاحة في خطة {0}.": "Multiple branches are available on the {0} plan.",
  "إضافة فريق متاحة في خطة {0}.": "Adding a team is available on the {0} plan.",
  "وصلت لأقصى عدد للفريق في باقتك الحالية ({0}).": "You've reached your plan's team limit ({0}).",
  "الكود غير صحيح — باقي {0}": (v) => `That code isn't right. ${tries(v[0] ?? "")} left.`,
  "النشاط ما اتسجلش: {0}. اطلب دعوة جديدة من الجهة، أو سجّل عادي من غير رابط الدعوة.":
    "The business wasn't registered: {0} Ask the organization for a new invitation, or sign up normally without the invitation link.",
  "التقييم بيتقفل بعد {0} يوم من الموعد": "Reviews close {0} days after the appointment.",
  "الملف فيه أكتر من {0} صف": "The file has more than {0} rows.",
  "قيمة غير صالحة: {0}": "That value isn't valid: {0}.",
  "لا يمكن تنفيذ \"{0}\" على نشاط حالته \"{1}\"": "You can't {0} a business that is {1}.",
  "لا يمكن تنفيذ \"{0}\" على تقييم حالته {1}": "You can't \"{0}\" a review whose status is {1}.",
};

/* ─── Lookup ─────────────────────────────────────────────── */

const ARABIC_DIGITS = /[\u0660-\u0669]/g;

/**
 * A value spliced into a sentence (a count, an amount, a name), made
 * readable in English where that is mechanical: Arabic-Indic digits,
 * the pound sign, a known phrase. A business's own Arabic name stays.
 */
export function fragment(value: string): string {
  const known = MESSAGES[value.trim()];
  if (known) return known;
  return value
    .replace(ARABIC_DIGITS, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/\u066C/g, ",")
    .replace(/\u066B/g, ".")
    .replace(/ج\.م\.?/g, "EGP")
    .replace(/[\u200E\u200F\u061C]/g, "");
}

/** The number in an Arabic count ("3 محاولات", "محاولتين", "محاولة واحدة"). */
export function countOf(value: string): number | null {
  const digits = fragment(value).match(/\d+/);
  if (digits) return Number(digits[0]);
  if (/واحد/.test(value)) return 1;
  if (/(تين|ين)$/.test(value.trim())) return 2;
  return null;
}

let compiled: Array<[RegExp, Template]> | null = null;

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Each template as a regex, {n} capturing; built once, on first use. */
function templates(): Array<[RegExp, Template]> {
  if (compiled) return compiled;
  compiled = Object.entries(TEMPLATES).map(([key, en]) => {
    const source = key
      .split(/\{\d+\}/)
      .map(escape)
      .join("([\\s\\S]*?)");
    return [new RegExp(`^${source}$`), en];
  });
  return compiled;
}

function fill(en: Template, values: string[]): string {
  if (typeof en === "function") return en(values);
  return en.replace(/\{(\d+)\}/g, (_, i: string) => fragment(values[Number(i)] ?? ""));
}

/** The English for an Arabic message, or null when there is none. */
export function englishFor(message: string): string | null {
  const text = message.trim();
  const exact = MESSAGES[text];
  if (exact) return exact;
  for (const [re, en] of templates()) {
    const m = re.exec(text);
    if (m) return fill(en, m.slice(1));
  }
  return null;
}

/** By status, for a sentence this module does not know. */
function fallback(status: number): string {
  if (status === 401) return "Please sign in first.";
  if (status === 403) return "You're not allowed to do this.";
  if (status === 404) return "We couldn't find that.";
  if (status === 409) return "That can't be done right now. Refresh and try again.";
  if (status === 429) return "Too many attempts. Wait a little and try again.";
  if (status >= 500) return "Something went wrong on our side. Try again in a little while.";
  return "Something isn't right. Check the details and try again.";
}

/**
 * The message for an English request: the translation, the message
 * itself when it is not Arabic (a route that already answered in
 * English), or a plain sentence by status — never Arabic.
 */
export function toEnglish(message: string, status = 400): string {
  if (!ARABIC.test(message)) return message;
  return englishFor(message) ?? fallback(status);
}
