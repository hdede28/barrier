'use strict';

// Eğitim radarı: eğitim yöneticilerinin izleyeceği alt temalar. Terimler Türkçe ve İngilizce (başlıkta aranır).
// Tema eklemek/değiştirmek için THEMES listesini düzenle.
const THEMES = [
  { id: 'ai', icon: '🤖', label: 'Yapay zekâ ve eğitim',
    en: ['artificial intelligence', 'generative AI', 'ChatGPT', 'AI tutor', 'AI in schools', 'large language model', 'AI literacy'],
    tr: ['yapay zeka', 'yapay zekâ', 'ChatGPT', 'üretken yapay zeka', 'yapay zeka okuryazarlığı'] },
  { id: 'assessment', icon: '📝', label: 'Ölçme ve değerlendirme',
    en: ['assessment', 'exam reform', 'standardized test', 'testing', 'grading', 'PISA', 'formative assessment', 'examinations'],
    tr: ['ölçme', 'değerlendirme', 'sınav', 'karne', 'PISA', 'not sistemi', 'LGS', 'YKS', 'telafi'] },
  { id: 'teachers', icon: '👩‍🏫', label: 'Öğretmen yetiştirme ve gelişim',
    en: ['teacher training', 'teacher shortage', 'teacher development', 'professional development', 'teacher recruitment', 'teacher retention', 'teacher education', 'pedagogy'],
    tr: ['öğretmen yetiştirme', 'öğretmen ataması', 'mesleki gelişim', 'öğretmen açığı', 'öğretmenlik', 'pedagojik', 'öğretmen eğitimi', 'öğretmen maaş'] },
  { id: 'leadership', icon: '🧭', label: 'Okul liderliği ve yönetimi',
    en: ['school leadership', 'principal', 'headteacher', 'school management', 'school governance', 'school improvement', 'school leaders'],
    tr: ['okul müdürü', 'okul yönetimi', 'okul liderliği', 'okul müdürleri', 'yönetici atama', 'müdür yardımcısı'] },
  { id: 'wellbeing', icon: '💚', label: 'Öğrenci refahı ve ruh sağlığı',
    en: ['student wellbeing', 'mental health', 'bullying', 'school counselling', 'school climate', 'absenteeism', 'student mental health'],
    tr: ['öğrenci refahı', 'ruh sağlığı', 'akran zorbalığı', 'rehberlik', 'psikolojik danışma', 'okul iklimi', 'devamsızlık', 'zorbalık'] },
  { id: 'edtech', icon: '💻', label: 'Dijital dönüşüm ve eğitim teknolojileri',
    en: ['edtech', 'digital learning', 'online learning', 'blended learning', 'learning platform', 'digital transformation', 'e-learning', 'coding'],
    tr: ['dijital eğitim', 'uzaktan eğitim', 'eğitim teknolojileri', 'FATİH', 'EBA', 'kodlama', 'dijital dönüşüm', 'çevrimiçi eğitim', 'akıllı tahta'] },
  { id: 'curriculum', icon: '📚', label: 'Müfredat ve öğretim programları',
    en: ['curriculum', 'curriculum reform', 'learning outcomes', 'competency-based', 'project-based learning', 'STEM', 'STEAM', 'literacy', 'numeracy'],
    tr: ['müfredat', 'öğretim programı', 'Maarif Modeli', 'yeterlik', 'proje tabanlı', 'STEM', 'okuryazarlık', 'değerler eğitimi', 'ders programı'] },
  { id: 'earlyyears', icon: '🧸', label: 'Okul öncesi ve erken çocukluk',
    en: ['early childhood', 'preschool', 'kindergarten', 'early years', 'nursery', 'pre-primary'],
    tr: ['okul öncesi', 'erken çocukluk', 'anaokulu', 'kreş', 'ana sınıfı'] },
  { id: 'vocational', icon: '🛠️', label: 'Mesleki ve teknik eğitim',
    en: ['vocational education', 'technical education', 'apprenticeship', 'skills training', 'TVET', 'workforce skills'],
    tr: ['mesleki eğitim', 'meslek lisesi', 'çıraklık', 'meslek yüksekokulu', 'mesleki ve teknik', 'staj'] },
  { id: 'inclusion', icon: '🤝', label: 'Kapsayıcı ve özel eğitim',
    en: ['inclusive education', 'special education', 'special needs', 'disability', 'refugee education', 'girls education', 'out-of-school'],
    tr: ['kapsayıcı eğitim', 'özel eğitim', 'kaynaştırma', 'engelli öğrenci', 'mülteci', 'göçmen öğrenci', 'destek eğitim'] },
  { id: 'safety', icon: '🛡️', label: 'Okul güvenliği',
    en: ['school safety', 'school violence', 'school security', 'safeguarding', 'school shooting', 'school bus'],
    tr: ['okul güvenliği', 'okul servisi', 'okulda şiddet', 'okul polisi', 'güvenli okul', 'okul çevresi'] },
  { id: 'highered', icon: '🎓', label: 'Yükseköğretim',
    en: ['higher education', 'university funding', 'tuition fees', 'international students', 'research university', 'university rankings'],
    tr: ['yükseköğretim', 'YÖK', 'harç', 'uluslararası öğrenci', 'burs', 'üniversite sıralaması', 'akademisyen'] },
  { id: 'policy', icon: '🏛️', label: 'Eğitim politikası ve reformlar',
    en: ['education policy', 'education reform', 'education minister', 'education budget', 'OECD', 'UNESCO', 'PISA results', 'Education at a Glance'],
    tr: ['eğitim politikası', 'eğitim reformu', 'Milli Eğitim Bakanı', 'eğitim bütçesi', 'OECD', 'UNESCO', 'MEB', 'bakanlık'] },
];

// Radar Google Haberler'de yalnızca Türkçe ve İngilizce terimlerimiz olan yayın sürümlerinde aranır.
const EDITION_CODES = ['TR', 'US', 'GB', 'AU', 'CA', 'IN'];

const byId = new Map(THEMES.map((t) => [t.id, t]));
const validIds = (ids) => [...new Set(ids)].filter((id) => byId.has(id));

// Seçilen temaların terimleri: yayın dili tr ise Türkçe, değilse İngilizce.
function termsOf(ids, lang) {
  return [...new Set(ids.flatMap((id) => byId.get(id)?.[lang === 'tr' ? 'tr' : 'en'] || []))];
}

const quote = (t) => (/\s/.test(t) ? `"${t}"` : t);
const clause = (ids, lang) => {
  const t = termsOf(ids, lang);
  return t.length ? `(${t.map(quote).join(' OR ')})` : '';
};

module.exports = { THEMES, EDITION_CODES, validIds, termsOf, clause };
