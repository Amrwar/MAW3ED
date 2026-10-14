/**
 * Countries, for the sign-in phone field.
 *
 * Only what picking a country needs: its ISO code (for the flag and the
 * device's region), its calling code and its name in both languages.
 * Deliberately no per-country number rules — the code sent to the
 * number proves it is real, and the server checks only its shape
 * (src/lib/phone.ts). A country sharing a calling code with others
 * (+1, +7, +44) is listed under its own name with the shared code.
 */

export interface Country {
  iso: string;
  dial: string;
  en: string;
  ar: string;
}

// iso|dial|English|Arabic
const TABLE = `
AF|93|Afghanistan|أفغانستان
AL|355|Albania|ألبانيا
DZ|213|Algeria|الجزائر
AD|376|Andorra|أندورا
AO|244|Angola|أنغولا
AG|1268|Antigua and Barbuda|أنتيغوا وباربودا
AR|54|Argentina|الأرجنتين
AM|374|Armenia|أرمينيا
AU|61|Australia|أستراليا
AT|43|Austria|النمسا
AZ|994|Azerbaijan|أذربيجان
BS|1242|Bahamas|جزر البهاما
BH|973|Bahrain|البحرين
BD|880|Bangladesh|بنغلاديش
BB|1246|Barbados|باربادوس
BY|375|Belarus|بيلاروسيا
BE|32|Belgium|بلجيكا
BZ|501|Belize|بليز
BJ|229|Benin|بنين
BT|975|Bhutan|بوتان
BO|591|Bolivia|بوليفيا
BA|387|Bosnia and Herzegovina|البوسنة والهرسك
BW|267|Botswana|بوتسوانا
BR|55|Brazil|البرازيل
BN|673|Brunei|بروناي
BG|359|Bulgaria|بلغاريا
BF|226|Burkina Faso|بوركينا فاسو
BI|257|Burundi|بوروندي
KH|855|Cambodia|كمبوديا
CM|237|Cameroon|الكاميرون
CA|1|Canada|كندا
CV|238|Cape Verde|الرأس الأخضر
CF|236|Central African Republic|جمهورية أفريقيا الوسطى
TD|235|Chad|تشاد
CL|56|Chile|تشيلي
CN|86|China|الصين
CO|57|Colombia|كولومبيا
KM|269|Comoros|جزر القمر
CG|242|Congo|الكونغو
CD|243|Congo (DRC)|الكونغو الديمقراطية
CR|506|Costa Rica|كوستاريكا
CI|225|Côte d'Ivoire|ساحل العاج
HR|385|Croatia|كرواتيا
CU|53|Cuba|كوبا
CY|357|Cyprus|قبرص
CZ|420|Czechia|التشيك
DK|45|Denmark|الدنمارك
DJ|253|Djibouti|جيبوتي
DM|1767|Dominica|دومينيكا
DO|1809|Dominican Republic|جمهورية الدومينيكان
EC|593|Ecuador|الإكوادور
EG|20|Egypt|مصر
SV|503|El Salvador|السلفادور
GQ|240|Equatorial Guinea|غينيا الاستوائية
ER|291|Eritrea|إريتريا
EE|372|Estonia|إستونيا
SZ|268|Eswatini|إسواتيني
ET|251|Ethiopia|إثيوبيا
FJ|679|Fiji|فيجي
FI|358|Finland|فنلندا
FR|33|France|فرنسا
GA|241|Gabon|الغابون
GM|220|Gambia|غامبيا
GE|995|Georgia|جورجيا
DE|49|Germany|ألمانيا
GH|233|Ghana|غانا
GR|30|Greece|اليونان
GD|1473|Grenada|غرينادا
GT|502|Guatemala|غواتيمالا
GN|224|Guinea|غينيا
GW|245|Guinea-Bissau|غينيا بيساو
GY|592|Guyana|غيانا
HT|509|Haiti|هايتي
HN|504|Honduras|هندوراس
HK|852|Hong Kong|هونغ كونغ
HU|36|Hungary|المجر
IS|354|Iceland|آيسلندا
IN|91|India|الهند
ID|62|Indonesia|إندونيسيا
IR|98|Iran|إيران
IQ|964|Iraq|العراق
IE|353|Ireland|أيرلندا
IT|39|Italy|إيطاليا
JM|1876|Jamaica|جامايكا
JP|81|Japan|اليابان
JO|962|Jordan|الأردن
KZ|7|Kazakhstan|كازاخستان
KE|254|Kenya|كينيا
KI|686|Kiribati|كيريباتي
XK|383|Kosovo|كوسوفو
KW|965|Kuwait|الكويت
KG|996|Kyrgyzstan|قيرغيزستان
LA|856|Laos|لاوس
LV|371|Latvia|لاتفيا
LB|961|Lebanon|لبنان
LS|266|Lesotho|ليسوتو
LR|231|Liberia|ليبيريا
LY|218|Libya|ليبيا
LI|423|Liechtenstein|ليختنشتاين
LT|370|Lithuania|ليتوانيا
LU|352|Luxembourg|لوكسمبورغ
MO|853|Macau|ماكاو
MG|261|Madagascar|مدغشقر
MW|265|Malawi|مالاوي
MY|60|Malaysia|ماليزيا
MV|960|Maldives|جزر المالديف
ML|223|Mali|مالي
MT|356|Malta|مالطا
MH|692|Marshall Islands|جزر مارشال
MR|222|Mauritania|موريتانيا
MU|230|Mauritius|موريشيوس
MX|52|Mexico|المكسيك
FM|691|Micronesia|ميكرونيزيا
MD|373|Moldova|مولدوفا
MC|377|Monaco|موناكو
MN|976|Mongolia|منغوليا
ME|382|Montenegro|الجبل الأسود
MA|212|Morocco|المغرب
MZ|258|Mozambique|موزمبيق
MM|95|Myanmar|ميانمار
NA|264|Namibia|ناميبيا
NR|674|Nauru|ناورو
NP|977|Nepal|نيبال
NL|31|Netherlands|هولندا
NZ|64|New Zealand|نيوزيلندا
NI|505|Nicaragua|نيكاراغوا
NE|227|Niger|النيجر
NG|234|Nigeria|نيجيريا
KP|850|North Korea|كوريا الشمالية
MK|389|North Macedonia|مقدونيا الشمالية
NO|47|Norway|النرويج
OM|968|Oman|عُمان
PK|92|Pakistan|باكستان
PW|680|Palau|بالاو
PS|970|Palestine|فلسطين
PA|507|Panama|بنما
PG|675|Papua New Guinea|بابوا غينيا الجديدة
PY|595|Paraguay|باراغواي
PE|51|Peru|بيرو
PH|63|Philippines|الفلبين
PL|48|Poland|بولندا
PT|351|Portugal|البرتغال
PR|1787|Puerto Rico|بورتوريكو
QA|974|Qatar|قطر
RO|40|Romania|رومانيا
RU|7|Russia|روسيا
RW|250|Rwanda|رواندا
KN|1869|Saint Kitts and Nevis|سانت كيتس ونيفيس
LC|1758|Saint Lucia|سانت لوسيا
VC|1784|Saint Vincent and the Grenadines|سانت فنسنت والغرينادين
WS|685|Samoa|ساموا
SM|378|San Marino|سان مارينو
ST|239|São Tomé and Príncipe|ساو تومي وبرينسيب
SA|966|Saudi Arabia|السعودية
SN|221|Senegal|السنغال
RS|381|Serbia|صربيا
SC|248|Seychelles|سيشل
SL|232|Sierra Leone|سيراليون
SG|65|Singapore|سنغافورة
SK|421|Slovakia|سلوفاكيا
SI|386|Slovenia|سلوفينيا
SB|677|Solomon Islands|جزر سليمان
SO|252|Somalia|الصومال
ZA|27|South Africa|جنوب أفريقيا
KR|82|South Korea|كوريا الجنوبية
SS|211|South Sudan|جنوب السودان
ES|34|Spain|إسبانيا
LK|94|Sri Lanka|سريلانكا
SD|249|Sudan|السودان
SR|597|Suriname|سورينام
SE|46|Sweden|السويد
CH|41|Switzerland|سويسرا
SY|963|Syria|سوريا
TW|886|Taiwan|تايوان
TJ|992|Tajikistan|طاجيكستان
TZ|255|Tanzania|تنزانيا
TH|66|Thailand|تايلاند
TL|670|Timor-Leste|تيمور الشرقية
TG|228|Togo|توغو
TO|676|Tonga|تونغا
TT|1868|Trinidad and Tobago|ترينيداد وتوباغو
TN|216|Tunisia|تونس
TR|90|Türkiye|تركيا
TM|993|Turkmenistan|تركمانستان
TV|688|Tuvalu|توفالو
UG|256|Uganda|أوغندا
UA|380|Ukraine|أوكرانيا
AE|971|United Arab Emirates|الإمارات
GB|44|United Kingdom|المملكة المتحدة
US|1|United States|الولايات المتحدة
UY|598|Uruguay|الأوروغواي
UZ|998|Uzbekistan|أوزبكستان
VU|678|Vanuatu|فانواتو
VA|39|Vatican City|الفاتيكان
VE|58|Venezuela|فنزويلا
VN|84|Vietnam|فيتنام
YE|967|Yemen|اليمن
ZM|260|Zambia|زامبيا
ZW|263|Zimbabwe|زيمبابوي
`;

export const COUNTRIES: Country[] = TABLE.trim()
  .split("\n")
  .map((line) => {
    const [iso = "", dial = "", en = "", ar = ""] = line.split("|");
    return { iso, dial, en, ar };
  });

const BY_ISO = new Map(COUNTRIES.map((c) => [c.iso, c]));

export const EGYPT: Country = BY_ISO.get("EG")!;

export function countryByIso(iso: string | null | undefined): Country | null {
  return iso ? (BY_ISO.get(iso.toUpperCase()) ?? null) : null;
}

/** The flag, from the ISO code's regional-indicator letters. */
export function flagOf(iso: string): string {
  return String.fromCodePoint(...[...iso.toUpperCase()].map((ch) => 0x1f1a5 + ch.charCodeAt(0)));
}

/**
 * Which country a number written with its calling code belongs to — the
 * longest code that prefixes it, so +1876 is Jamaica, not the US. A
 * calling code several countries share goes to `prefer` when it is one
 * of them (somebody in Canada pasting +1…), else to the most populous.
 */
export function countryForDigits(digits: string, prefer?: Country): Country | null {
  let best: Country | null = null;
  for (const c of COUNTRIES) {
    if (!digits.startsWith(c.dial)) continue;
    if (!best || c.dial.length > best.dial.length) best = c;
  }
  if (!best) return null;
  if (prefer && prefer.dial === best.dial) return prefer;
  return SHARED_DEFAULT[best.dial] ?? best;
}

const SHARED_DEFAULT: Record<string, Country> = {
  "1": BY_ISO.get("US")!,
  "7": BY_ISO.get("RU")!,
  "39": BY_ISO.get("IT")!,
};

export { isolateLtr } from "@/lib/format";

/** Matches a search box's text against a country's names, code and calling code. */
export function matchesCountry(c: Country, query: string): boolean {
  const q = query.trim().toLowerCase().replace(/^\+/, "");
  if (!q) return true;
  return (
    c.en.toLowerCase().includes(q) ||
    c.ar.includes(q) ||
    c.iso.toLowerCase() === q ||
    c.dial.startsWith(q)
  );
}
