import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowRight,
  BarChart3,
  BellRing,
  Building2,
  CheckCircle2,
  CreditCard,
  Eye,
  EyeOff,
  GraduationCap,
  Menu,
  MessageCircleMore,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Users
} from "lucide-react";
import { toast } from "sonner";
import { authService } from "@/services/auth-service";
import { useAuthStore } from "@/store/auth-store";
import { Button } from "@/components/common/Button";
import { Card } from "@/components/common/Card";
import { FormInput } from "@/components/forms/FormInput";
import { FormSelect } from "@/components/forms/FormSelect";
import brandLogo from "@/rasmlar/kurs boshqaruv new.png";

function PublicShell({ children }: { children: ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-page-gradient" />
      <div className="pointer-events-none absolute left-[-6%] top-20 h-40 w-40 rounded-full bg-primary/12 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-[32%] h-56 w-56 rounded-full bg-sky-400/10 blur-3xl" />
      <header className="page-shell pb-0">
        <div className="surface-card flex items-center justify-between rounded-[30px] px-4 py-4 sm:px-5">
          <Link to="/" className="group flex items-center">
            <div className="flex h-[58px] w-[58px] items-center justify-center rounded-full border border-white/70 bg-white/72 p-1.5 shadow-[0_10px_24px_rgba(8,25,80,0.08)] transition-all duration-300 group-hover:border-primary/25 group-hover:shadow-[0_16px_28px_rgba(59,91,219,0.15)] dark:border-slate-800 dark:bg-slate-950/72 sm:h-[62px] sm:w-[62px]">
              <div className="h-full w-full overflow-hidden rounded-full ring-1 ring-primary/10">
                <img
                  src={brandLogo}
                  alt="Kurs Boshqaruv"
                  className="h-full w-full rounded-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                  loading="eager"
                  decoding="async"
                />
              </div>
            </div>
          </Link>
          <nav className="hidden gap-2 md:flex">
            {[
              ["/about", "Tizim haqida"],
              ["/features", "Imkoniyatlar"],
              ["/contact", "Aloqa"]
            ].map(([href, label]) => (
              <Link
                key={href}
                to={href}
                className="rounded-full px-4 py-2 text-sm font-medium text-slate-500 transition hover:bg-white/80 hover:text-foreground dark:hover:bg-slate-900/70"
              >
                {label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link to="/login" className="hidden text-sm font-semibold sm:inline">
              Kirish
            </Link>
            <Button size="sm" onClick={() => (window.location.href = "/login")} className="hidden sm:inline-flex">
              Tizimga kirish
            </Button>
            <button
              type="button"
              onClick={() => setMobileMenuOpen((value) => !value)}
              className="surface-muted flex h-11 w-11 items-center justify-center md:hidden"
              aria-label="Mobil menyu"
            >
              <Menu size={18} />
            </button>
          </div>
        </div>
        {mobileMenuOpen ? (
          <div className="surface-card mt-3 flex flex-col gap-2 rounded-[28px] p-3 md:hidden">
            {[
              ["/about", "Tizim haqida"],
              ["/features", "Imkoniyatlar"],
              ["/contact", "Aloqa"],
              ["/login", "Kirish"]
            ].map(([href, label]) => (
              <Link
                key={href}
                to={href}
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-[20px] px-4 py-3 text-sm font-medium text-slate-500 transition hover:bg-white/80 hover:text-foreground dark:hover:bg-slate-900/70"
              >
                {label}
              </Link>
            ))}
          </div>
        ) : null}
      </header>
      {children}
    </div>
  );
}

function AuthShowcase({
  title,
  description
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="surface-card relative hidden overflow-hidden p-7 lg:block lg:min-h-[680px]">
      <div className="absolute inset-0 bg-hero-gradient opacity-90" />
      <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-primary/20 blur-3xl" />
      <div className="absolute bottom-0 left-0 h-44 w-44 rounded-full bg-sky-400/15 blur-3xl" />
      <div className="relative flex h-full flex-col justify-between">
        <div>
          <div className="section-kicker">Education SaaS</div>
          <h2 className="mt-5 max-w-lg font-display text-4xl font-extrabold leading-tight">
            {title}
          </h2>
          <p className="mt-4 max-w-xl text-base leading-7 text-slate-600 dark:text-slate-300">{description}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            ["Davomat", "Bir martalik guruh davomati va tezkor nazorat"],
            ["To'lov", "Qarzdor va to'langan holatlarni aniq ko'rish"],
            ["Xabarlar", "Telegram orqali ota-ona bilan yaqin aloqa"],
            ["Analytics", "Rahbariyat uchun premium dashboard va KPI"]
          ].map(([label, text]) => (
            <div key={label} className="surface-muted p-4">
              <div className="font-display text-lg font-bold">{label}</div>
              <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">{text}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const landingFeatureCards = [
  {
    title: "Aqlli davomat",
    description: "Kelgan, kelmagan, kechikkan, tayyor emas yoki uy vazifasi qilmagan holatlarini bir joyda boshqaring.",
    icon: GraduationCap
  },
  {
    title: "To'lov nazorati",
    description: "Kim to'ladi, kim to'lamadi, kimda qarzdorlik borligi kunlik ravishda ko'rinadi.",
    icon: CreditCard
  },
  {
    title: "Ota-ona bilan aloqa",
    description: "Telegram orqali bir bosishda ota-onaga xabar yuborish va yuborilgan tarixni saqlash.",
    icon: MessageCircleMore
  },
  {
    title: "Xavfsiz boshqaruv",
    description: "Admin, o'qituvchi va o'quvchi uchun alohida himoyalangan panel va rollar bo'yicha ruxsatlar.",
    icon: ShieldCheck
  }
];

const roleAdvantages = [
  {
    title: "Admin uchun",
    items: [
      "Barcha o'quvchi, guruh, kurs va o'qituvchilarni bitta paneldan boshqaradi.",
      "Bugun kelmaganlar va to'lov qilmaganlar ro'yxatini tez ko'radi.",
      "Hisobot, eksport va notification tarixini kuzatadi."
    ]
  },
  {
    title: "O'qituvchi uchun",
    items: [
      "O'z guruhlarini ko'radi va davomatni tez belgilaydi.",
      "Uy vazifasi qilmagan yoki tayyor kelmagan o'quvchini darhol belgilaydi.",
      "Kerak bo'lsa ota-onaga bir bosishda xabar yuboradi."
    ]
  },
  {
    title: "O'quvchi uchun",
    items: [
      "Shaxsiy davomat foizini, vazifalarini va to'lov holatini ko'radi.",
      "Dars jadvali va o'qituvchi izohlarini kuzatadi.",
      "Qaysi joyda ortda qolayotganini tez tushunadi."
    ]
  }
];

const faqs = [
  {
    question: "Bu tizim keyinchalik mobil ilovaga ulanadimi?",
    answer: "Ha. API va arxitektura keyinchalik React Native yoki Flutter ilovasini ulashga mos tuzilgan."
  },
  {
    question: "Telegram xabarlari shablon bilan ishlaydimi?",
    answer: "Ha. Davomat, to'lov va tartib holatlari uchun alohida xabar shablonlari ishlatiladi."
  },
  {
    question: "Admin va o'qituvchi bir xil ma'lumotni ko'radimi?",
    answer: "Yo'q. Har bir rol o'ziga tegishli ruxsat va ko'rinish bilan ishlaydi."
  }
];

export function LandingPage() {
  return (
    <PublicShell>
      <section className="page-shell pt-8">
        <div className="grid gap-6 lg:grid-cols-[1.18fr_0.82fr]">
          <div className="glass-panel rounded-[32px] bg-hero-gradient p-8 soft-grid sm:p-10">
            <div className="inline-flex rounded-full bg-primary/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-primary">
              O'quv markazlari uchun premium CRM
            </div>
            <h1 className="mt-6 max-w-3xl font-display text-4xl font-extrabold tracking-tight sm:text-6xl">
              Kurs markazingizni bir tizimda boshqaring, nazorat qiling va o'stiring.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300">
              Davomat, to'lov, guruhlar, o'qituvchi izohlari, ota-ona bilan Telegram aloqa va boshqaruv hisobotlari
              bitta qulay platformada jamlangan. Tizim kundalik ishlatishga yaqin, tushunarli va kengaytirishga tayyor.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button onClick={() => (window.location.href = "/login")}>
                Tizimga kirish <ArrowRight size={16} className="ml-2" />
              </Button>
              <Button variant="secondary" onClick={() => (window.location.href = "/features")}>
                Imkoniyatlarni ko'rish
              </Button>
            </div>
            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              {[
                ["6+", "faol o'quvchi"],
                ["3", "nazoratdagi guruh"],
                ["1 bosish", "ota-onaga tezkor xabar"]
              ].map(([value, label]) => (
                <div key={label} className="rounded-3xl border border-white/40 bg-white/70 p-4 dark:border-white/10 dark:bg-slate-900/70">
                  <div className="font-display text-2xl font-bold">{value}</div>
                  <div className="mt-1 text-sm text-slate-500">{label}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="grid gap-5">
            <Card className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                  <Sparkles size={18} />
                </div>
                <div className="font-display text-xl font-bold">Bugungi tezkor nazorat</div>
              </div>
              <div className="grid gap-3">
                {[
                  ["Bugun kelmaganlar", "2 nafar o'quvchi darhol nazorat talab qiladi"],
                  ["To'lov qilmaganlar", "4 ta ochiq yoki qisman to'lov mavjud"],
                  ["Yuborilgan xabarlar", "Bugun 3 ta Telegram xabari yuborilgan"],
                  ["Xavfli holatlar", "Takroriy kechikish va tayyor emas holati ajratib ko'rsatiladi"]
                ].map(([title, description]) => (
                  <div key={title} className="rounded-2xl border border-border bg-white/70 p-4 dark:bg-slate-900/50">
                    <div className="font-semibold">{title}</div>
                    <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </section>

      <section className="page-shell">
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {landingFeatureCards.map(({ title, description, icon: Icon }) => (
            <Card key={title} className="space-y-4">
              <div className="inline-flex rounded-2xl bg-primary/10 p-3 text-primary">
                <Icon size={18} />
              </div>
              <div>
                <div className="font-display text-xl font-bold">{title}</div>
                <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{description}</p>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section className="page-shell">
        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <Card className="space-y-5">
            <div className="inline-flex rounded-full bg-slate-900/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:bg-white/10 dark:text-slate-300">
              Tizim qanday ishlaydi
            </div>
            <h2 className="section-title">Bir kunlik ish jarayoni chalkash bo'lmaydi</h2>
            <div className="space-y-4">
              {[
                ["1. Admin", "Yangi o'quvchi yaratadi, guruhga biriktiradi va to'lov rejasini belgilaydi."],
                ["2. O'qituvchi", "Dars boshlanishida davomatni belgilaydi va zarur bo'lsa izoh qoldiradi."],
                ["3. Tizim", "Qarzdor, kelmagan yoki tayyor emas holatlarni ajratib ko'rsatadi."],
                ["4. Ota-ona", "Kerak bo'lsa Telegram orqali avtomatik yoki qo'lda yuborilgan xabarni oladi."]
              ].map(([title, description]) => (
                <div key={title} className="rounded-2xl border border-border bg-white/70 p-4 dark:bg-slate-900/50">
                  <div className="font-semibold">{title}</div>
                  <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</div>
                </div>
              ))}
            </div>
          </Card>
          <div className="grid gap-5 md:grid-cols-2">
            {[
              {
                title: "Dashboard va analytics",
                description: "Rahbar uchun kunlik nazorat, tushum, davomat va xavfli o'quvchilar ko'rinishi.",
                icon: BarChart3
              },
              {
                title: "Ko'p filialga tayyor",
                description: "Arxitektura keyinchalik bir nechta filial, super admin va branch selector uchun mos.",
                icon: Building2
              },
              {
                title: "Ota-ona xabarlari",
                description: "Template asosida xabar, loglar tarixi va kelajakda SMS/Email qo'shish uchun tayyor tuzilma.",
                icon: BellRing
              },
              {
                title: "Mobilga tayyor API",
                description: "Keyinchalik mobil ilova ulash uchun toza REST API va modul tuzilma saqlanadi.",
                icon: Smartphone
              }
            ].map(({ title, description, icon: Icon }) => (
              <Card key={title} className="space-y-4">
                <div className="inline-flex rounded-2xl bg-primary/10 p-3 text-primary">
                  <Icon size={18} />
                </div>
                <div className="font-display text-xl font-bold">{title}</div>
                <p className="text-sm leading-6 text-slate-500 dark:text-slate-400">{description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="page-shell">
        <div className="grid gap-5 xl:grid-cols-3">
          {roleAdvantages.map((section) => (
            <Card key={section.title} className="space-y-4">
              <div className="font-display text-2xl font-bold">{section.title}</div>
              <div className="space-y-3">
                {section.items.map((item) => (
                  <div key={item} className="flex items-start gap-3 text-sm text-slate-500 dark:text-slate-400">
                    <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-500" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section className="page-shell">
        <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
          <Card className="space-y-5">
            <div className="font-display text-2xl font-bold">Markazlar nimani yutadi?</div>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                ["Tezkor nazorat", "Bugun kim keldi, kim kelmadi, kim to'lamadi degan savolga darhol javob beradi."],
                ["Tartibli ma'lumot", "Student, parent, group, to'lov va davomat parchalanib ketmaydi."],
                ["Kamroq qo'l mehnati", "Xabarlar, hisobotlar va filtrlash ishlari tezlashadi."],
                ["Professional ko'rinish", "Rahbar, o'qituvchi va o'quvchi uchun alohida zamonaviy panel mavjud."]
              ].map(([title, description]) => (
                <div key={title} className="rounded-2xl border border-border bg-white/70 p-4 dark:bg-slate-900/50">
                  <div className="font-semibold">{title}</div>
                  <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">{description}</div>
                </div>
              ))}
            </div>
          </Card>
          <Card className="space-y-5">
            <div className="font-display text-2xl font-bold">Mijozlar fikri</div>
            <div className="space-y-4">
              {[
                ["Nova Education", "Davomat va to'lov nazorati ancha yengillashdi, ota-onaga xabar yuborish esa juda qulay bo'ldi."],
                ["Prime Learning", "Admin paneldagi tezkor kartalar kundalik boshqaruvni ancha tartibga soldi."],
                ["Everest Study", "O'qituvchilar uchun davomat va izoh kiritish juda tushunarli ishlaydi."]
              ].map(([center, quote]) => (
                <div key={center} className="rounded-2xl border border-border bg-white/70 p-4 dark:bg-slate-900/50">
                  <div className="font-semibold">{center}</div>
                  <div className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{quote}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </section>

      <section className="page-shell">
        <Card className="space-y-5">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-primary/10 p-3 text-primary">
              <Users size={18} />
            </div>
            <div>
              <div className="font-display text-2xl font-bold">Ko'p so'raladigan savollar</div>
              <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Tizimni real ishlatish va kengaytirish bo'yicha asosiy savollar.
              </div>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {faqs.map((item) => (
              <div key={item.question} className="rounded-2xl border border-border bg-white/70 p-4 dark:bg-slate-900/50">
                <div className="font-semibold">{item.question}</div>
                <div className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{item.answer}</div>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="page-shell pt-0">
        <Card className="bg-hero-gradient p-8 text-center sm:p-10">
          <div className="mx-auto max-w-3xl">
            <div className="inline-flex rounded-full bg-white/65 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Ishga tayyor tizim
            </div>
            <h2 className="mt-5 font-display text-3xl font-extrabold sm:text-5xl">
              Kurs markazingiz uchun tushunarli, chiroyli va ishlaydigan boshqaruv tizimi
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-600 dark:text-slate-300">
              Admin, o'qituvchi va o'quvchi rollari bilan tayyor panelni ochib, to'lov, davomat va xabarlar oqimini
              hozirning o'zida ko'rishingiz mumkin.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button onClick={() => (window.location.href = "/login")}>
                Tizimga kirish <ArrowRight size={16} className="ml-2" />
              </Button>
              <Button variant="secondary" onClick={() => (window.location.href = "/contact")}>
                Bog'lanish
              </Button>
            </div>
          </div>
        </Card>
      </section>
    </PublicShell>
  );
}

export function AboutPage() {
  return (
    <PublicShell>
      <section className="page-shell">
        <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <Card className="space-y-4">
            <h1 className="section-title">Haqiqiy o'quv markazi ish jarayoniga mos</h1>
            <p className="max-w-3xl text-slate-600 dark:text-slate-300">
              Bu tizim o'quv markazining kundalik ishini soddalashtirish uchun yozilgan. O'quvchini ro'yxatga olish,
              guruhga biriktirish, o'qituvchi bilan bog'lash, davomat yuritish, to'lovni kuzatish va ota-ona bilan
              aloqa qilish bitta oqimga birlashtirilgan.
            </p>
            <p className="text-slate-600 dark:text-slate-300">
              Arxitektura keyinchalik mobil ilova, ota-ona portali, onlayn to'lov va ko'p filialli boshqaruvga
              kengaytirishga mos.
            </p>
          </Card>
          <Card className="space-y-4">
            <div className="font-display text-2xl font-bold">Asosiy ustunliklar</div>
            <div className="space-y-3">
              {[
                "Rollar bo'yicha aniq ajratilgan panel va ruxsatlar",
                "Davomat va to'lovdagi xavfli holatlarni ajratib ko'rsatish",
                "Telegram notification uchun tayyor modul",
                "Frontend va backend alohida, toza va kengaytiriladigan tuzilma"
              ].map((item) => (
                <div key={item} className="flex items-start gap-3 text-sm text-slate-500 dark:text-slate-400">
                  <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-500" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </section>
    </PublicShell>
  );
}

export function FeaturesPage() {
  return (
    <PublicShell>
      <section className="page-shell grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {[
          "Admin, o'qituvchi va o'quvchi uchun alohida boshqaruv sahifalari",
          "Tezkor davomat va holat belgilash",
          "To'langan, qisman to'langan, to'lanmagan va qarzdor to'lovlarni filtrlash",
          "Telegram orqali ota-onaga bir bosishda xabar yuborish",
          "Hisobot, grafik va xavfli o'quvchilar nazorati",
          "Kelajakdagi mobil ilova va ota-ona portali uchun tayyor arxitektura"
        ].map((feature) => (
          <Card key={feature}>
            <h3 className="font-display text-xl font-bold">{feature}</h3>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Production uslubidagi komponentlar, reusable UI va full-stack tuzilma bilan yozilgan.
            </p>
          </Card>
        ))}
      </section>
    </PublicShell>
  );
}

export function ContactPage() {
  return (
    <PublicShell>
      <section className="page-shell">
        <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
          <Card className="space-y-3">
            <h1 className="section-title">Aloqa</h1>
            <p className="text-slate-600 dark:text-slate-300">Namuna markaz: Nova Education Center</p>
            <p className="text-slate-600 dark:text-slate-300">Telefon: +998 90 000 11 22</p>
            <p className="text-slate-600 dark:text-slate-300">Email: hello@nova.uz</p>
            <p className="text-slate-600 dark:text-slate-300">Manzil: Toshkent shahri, Chilonzor tumani</p>
          </Card>
          <Card className="space-y-3">
            <div className="font-display text-2xl font-bold">Nimalar bo'yicha murojaat qilishingiz mumkin?</div>
            <div className="space-y-3 text-sm text-slate-500 dark:text-slate-400">
              <div>Tizim oqimini ko'rish va tushunish</div>
              <div>O'quv markazingizga moslab moslashtirish</div>
              <div>Telegram integratsiyasi va notification sozlamalari</div>
              <div>Ko'p filial yoki mobil ilova bosqichlari bo'yicha maslahat</div>
            </div>
          </Card>
        </div>
      </section>
    </PublicShell>
  );
}

const loginSchema = z.object({
  identifier: z.string().min(3, "Telefon raqami yoki email kiriting."),
  password: z.string().min(6, "Parol kamida 6 ta belgidan iborat bo'lishi kerak."),
  rememberMe: z.boolean().optional()
});

export function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const signIn = useAuthStore((state) => state.signIn);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      identifier: "",
      password: "",
      rememberMe: true
    }
  });

  return (
    <PublicShell>
      <section className="page-shell">
        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <AuthShowcase
            title="Boshqaruv tizimiga xavfsiz va premium kirish"
            description="Admin, o'qituvchi va o'quvchi ko'rinishlarini bir tizimda sinab ko'ring. Kirgan zahoti dashboard, xavfli holatlar va tezkor amallar tayyor bo'ladi."
          />
          <Card className="space-y-5 p-5 sm:p-7">
            <div>
              <div className="section-kicker">Secure Access</div>
              <h1 className="mt-4 section-title">Tizimga kirish</h1>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Akkauntni admin yaratadi va login-parolni foydalanuvchiga beradi. Telefon raqami yoki email bilan kirishingiz mumkin.
              </p>
            </div>
            <form
              className="space-y-4"
              onSubmit={handleSubmit(async (values) => {
                try {
                  const response = await authService.login(values);
                  signIn(response);
                  toast.success("Tizimga muvaffaqiyatli kirdingiz.");
                  navigate(`/${response.user.role.toLowerCase()}/dashboard`);
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Kirishda xatolik yuz berdi.");
                }
              })}
            >
              <FormInput label="Telefon raqami yoki email" error={errors.identifier?.message} {...register("identifier")} />
              <div className="relative">
                <FormInput label="Parol" type={showPassword ? "text" : "password"} error={errors.password?.message} {...register("password")} />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-4 top-[42px] text-slate-400 transition hover:text-foreground"
                  aria-label="Parol ko'rinishini almashtirish"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <label className="flex items-center gap-3 rounded-2xl border border-border/80 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                <input type="checkbox" className="h-4 w-4 rounded border-border text-primary focus:ring-primary" {...register("rememberMe")} />
                Meni eslab qolish
              </label>
              <Button className="w-full" size="lg" disabled={isSubmitting} loading={isSubmitting}>
                {isSubmitting ? "Tekshirilmoqda..." : "Kirish"}
              </Button>
            </form>
            <div className="flex flex-col gap-2 text-sm sm:flex-row sm:justify-between">
              <Link to="/forgot-password" className="text-primary">
                Parolni unutdingizmi?
              </Link>
              <span className="text-slate-500 dark:text-slate-400">Akkauntni admin ochadi</span>
            </div>
          </Card>
        </div>
      </section>
    </PublicShell>
  );
}

const registerSchema = z
  .object({
    fullName: z.string().min(3, "To'liq ism kiriting."),
    phone: z.string().regex(/^\+?[0-9]{9,15}$/, "Telefon formati noto'g'ri."),
    email: z.string().email("Email formati noto'g'ri.").optional().or(z.literal("")),
    role: z.enum(["STUDENT", "TEACHER", "ADMIN"]),
    password: z.string().min(6, "Parol kamida 6 ta belgidan iborat bo'lishi kerak."),
    confirmPassword: z.string().min(6, "Parolni tasdiqlang.")
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Parollar bir xil emas.",
    path: ["confirmPassword"]
  });

export function RegisterPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      role: "STUDENT"
    }
  });

  return (
    <PublicShell>
      <section className="page-shell">
        <div className="grid gap-6 lg:grid-cols-[1.02fr_0.98fr]">
          <AuthShowcase
            title="Yangi foydalanuvchi oqimini premium va aniq qiling"
            description="Ro'yxatdan o'tishdan keyin student, teacher va admin uchun rollar bo'yicha alohida kirish oqimlari tayyor. Ariza yuborish, tekshiruv va tasdiqlash silliq ko'rinadi."
          />
          <Card className="space-y-5 p-5 sm:p-7">
            <div>
              <div className="section-kicker">Onboarding</div>
              <h1 className="mt-4 section-title">Ro'yxatdan o'tish</h1>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                O'quvchi va o'qituvchi ro'yxatdan o'tganda tasdiqlash kutish holatiga tushishi mumkin. Admin esa ichki xavfsiz oqim orqali yaratiladi.
              </p>
            </div>
            <form
              className="space-y-4"
              onSubmit={handleSubmit(async (values) => {
                try {
                  const response = await authService.register({
                    fullName: values.fullName,
                    phone: values.phone,
                    email: values.email || undefined,
                    role: values.role,
                    password: values.password
                  });
                  setSuccessMessage(response.message);
                  toast.success(response.message);
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Ro'yxatdan o'tishda xatolik yuz berdi.");
                }
              })}
            >
              <FormInput label="To'liq ism" error={errors.fullName?.message} {...register("fullName")} />
              <FormInput label="Telefon raqami" error={errors.phone?.message} {...register("phone")} />
              <FormInput label="Email" error={errors.email?.message} {...register("email")} />
              <FormSelect label="Rol" error={errors.role?.message} {...register("role")}>
                <option value="STUDENT">O'quvchi</option>
                <option value="TEACHER">O'qituvchi</option>
                <option value="ADMIN">Admin (ichki xavfsiz oqim)</option>
              </FormSelect>
              <div className="relative">
                <FormInput label="Parol" type={showPassword ? "text" : "password"} error={errors.password?.message} {...register("password")} />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-4 top-[42px] text-slate-400 transition hover:text-foreground"
                  aria-label="Parol ko'rinishini almashtirish"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <FormInput
                label="Parolni tasdiqlash"
                type={showPassword ? "text" : "password"}
                error={errors.confirmPassword?.message}
                {...register("confirmPassword")}
              />
              <Button className="w-full" size="lg" disabled={isSubmitting} loading={isSubmitting}>
                {isSubmitting ? "Yuborilmoqda..." : "So'rov yuborish"}
              </Button>
            </form>
            {successMessage ? <p className="rounded-2xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600 dark:text-emerald-300">{successMessage}</p> : null}
          </Card>
        </div>
      </section>
    </PublicShell>
  );
}

const resetRequestSchema = z.object({
  identifier: z.string().min(3, "Telefon raqami yoki email kiriting.")
});

export function ForgotPasswordPage() {
  const [token, setToken] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<z.infer<typeof resetRequestSchema>>({
    resolver: zodResolver(resetRequestSchema)
  });

  return (
    <PublicShell>
      <section className="page-shell">
        <div className="grid gap-6 lg:grid-cols-[1.02fr_0.98fr]">
          <AuthShowcase
            title="Kirishni tiklash oqimi ham mahsulot darajasida bo'lsin"
            description="Parolni unutgan foydalanuvchi uchun ham toza, ishonchli va tushunarli ekran muhim. Tiklash oqimi premium ko‘rinishda qoladi."
          />
          <Card className="space-y-5 p-5 sm:p-7">
            <div>
              <div className="section-kicker">Password Recovery</div>
              <h1 className="mt-4 section-title">Parolni tiklash</h1>
            </div>
            <form
              className="space-y-4"
              onSubmit={handleSubmit(async (values) => {
                try {
                  const response = await authService.forgotPassword(values.identifier);
                  setToken(response.token ?? "");
                  toast.success(response.message);
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Tiklash tokenini yaratib bo'lmadi.");
                }
              })}
            >
              <FormInput label="Telefon raqami yoki email" error={errors.identifier?.message} {...register("identifier")} />
              <Button className="w-full" size="lg" disabled={isSubmitting} loading={isSubmitting}>
                {isSubmitting ? "Yaratilmoqda..." : "Tiklash tokenini yaratish"}
              </Button>
            </form>
            {token ? <p className="surface-muted px-4 py-3 text-sm text-slate-500">Namuna token: {token}</p> : null}
          </Card>
        </div>
      </section>
    </PublicShell>
  );
}

const resetSchema = z.object({
  token: z.string().min(4),
  password: z.string().min(6)
});

export function ResetPasswordPage() {
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<z.infer<typeof resetSchema>>({
    resolver: zodResolver(resetSchema)
  });

  return (
    <PublicShell>
      <section className="page-shell">
        <div className="grid gap-6 lg:grid-cols-[1.02fr_0.98fr]">
          <AuthShowcase
            title="Yangi parolni ham silliq va xavfsiz o'rnating"
            description="Tiklash tokeni bilan yangi parol o‘rnatilib, foydalanuvchi yana tizimga premium oqim bilan qayta kiradi."
          />
          <Card className="space-y-5 p-5 sm:p-7">
            <div>
              <div className="section-kicker">Reset Access</div>
              <h1 className="mt-4 section-title">Yangi parol o'rnatish</h1>
            </div>
            <form
              className="space-y-4"
              onSubmit={handleSubmit(async (values) => {
                try {
                  const response = await authService.resetPassword(values.token, values.password);
                  toast.success(response.message);
                  navigate("/login");
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Parolni yangilashda xatolik yuz berdi.");
                }
              })}
            >
              <FormInput label="Tiklash tokeni" error={errors.token?.message} {...register("token")} />
              <div className="relative">
                <FormInput label="Yangi parol" type={showPassword ? "text" : "password"} error={errors.password?.message} {...register("password")} />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-4 top-[42px] text-slate-400 transition hover:text-foreground"
                  aria-label="Parol ko'rinishini almashtirish"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <Button className="w-full" size="lg" disabled={isSubmitting} loading={isSubmitting}>
                {isSubmitting ? "Yangilanmoqda..." : "Parolni yangilash"}
              </Button>
            </form>
          </Card>
        </div>
      </section>
    </PublicShell>
  );
}

export function NotFoundPage() {
  return (
    <PublicShell>
      <section className="page-shell max-w-2xl">
        <Card className="space-y-4 text-center">
          <div className="font-display text-6xl font-extrabold">404</div>
          <h1 className="section-title">Sahifa topilmadi</h1>
          <p className="text-slate-500 dark:text-slate-400">
            Siz qidirgan sahifa topilmadi. Bosh sahifaga yoki kirish sahifasiga qayting.
          </p>
          <div className="flex justify-center gap-3">
            <Button onClick={() => (window.location.href = "/")}>Bosh sahifa</Button>
            <Button variant="secondary" onClick={() => (window.location.href = "/login")}>
              Kirish
            </Button>
          </div>
        </Card>
      </section>
    </PublicShell>
  );
}
