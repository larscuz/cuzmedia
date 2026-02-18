import React, { CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from 'react';

type CtaLink = {
  label: string;
  href: string;
};

type ShowcasePanel = {
  id: string;
  client: string;
  title: string;
  description: string;
  videoPath: string;
  posterPath: string;
  fallbackVideoSrc?: string;
  fallbackPosterSrc: string;
  primaryCta: CtaLink;
  secondaryCta?: CtaLink;
  hero?: boolean;
};

type NavItem = {
  id: string;
  label: string;
  panelIds: string[];
};

type SiteSettings = {
  siteTitle: string;
  siteDescription: string;
  brandName: string;
  brandSubline: string;
  headerCtaLabel: string;
  headerCtaHref: string;
  spinHint: string;
  accentColor: string;
};

type CmsConfig = {
  settings: SiteSettings;
  panels: ShowcasePanel[];
  navItems: NavItem[];
};

type RevisionRecord = {
  id: string;
  createdAt: string | null;
};

type UploadKind = 'video' | 'image';
type SiteLanguage = 'no' | 'en';

type PanelCopyOverride = {
  client?: string;
  title?: string;
  description?: string;
  primaryCtaLabel?: string;
  secondaryCtaLabel?: string;
};

type SiteUiCopy = {
  menuLabel: string;
  closeLabel: string;
  primaryNavLabel: string;
  cmsFallbackPrefix: string;
  wheelProgressLabel: string;
  toggleEnglishLabel: string;
  toggleNorwegianLabel: string;
  homeAriaLabel: (brandName: string) => string;
};

const ADMIN_TOKEN_STORAGE_KEY = 'cuz-cms-admin-token';
const SITE_LANGUAGE_STORAGE_KEY = 'cuz-site-language';
const CMS_API_BASE = (import.meta.env.VITE_CMS_API_BASE ?? '').trim().replace(/\/+$/, '');
const CMS_STATIC_SNAPSHOT_PATH = '/cms.json';

const SPIN_BASE_LOCK_MS = 780;
const WHEEL_THRESHOLD = 90;
const SWIPE_THRESHOLD = 50;
const LINKEDIN_URL = 'https://www.linkedin.com/company/cuz-media-as/?viewAsMember=true';

const trimSlashes = (value: string) => value.replace(/^\/+|\/+$/g, '');
const trimTrailingSlashes = (value: string) => value.replace(/\/+$/g, '');
const isAbsoluteUrl = (value: string) => /^https?:\/\//i.test(value);

const MEDIA_BASE_URL = trimTrailingSlashes((import.meta.env.VITE_MEDIA_BASE_URL ?? '').trim());
const MEDIA_PREFIX = trimSlashes((import.meta.env.VITE_MEDIA_PREFIX ?? 'CuzMedia').trim());

const getConfiguredMediaUrl = (path: string) => {
  const rawPath = path.trim();
  if (!rawPath) {
    return null;
  }

  if (isAbsoluteUrl(rawPath)) {
    return rawPath;
  }

  if (!MEDIA_BASE_URL) {
    return null;
  }

  const cleanPath = trimSlashes(rawPath);
  const prefix = MEDIA_PREFIX ? `${MEDIA_PREFIX}/` : '';
  return `${MEDIA_BASE_URL}/${prefix}${cleanPath}`;
};

const getApiUrl = (path: string) => {
  if (CMS_API_BASE) {
    return `${CMS_API_BASE}${path}`;
  }
  return path;
};

const getCmsFetchUrls = () => {
  const primaryUrl = getApiUrl('/api/cms');
  if (primaryUrl === CMS_STATIC_SNAPSHOT_PATH) {
    return [primaryUrl];
  }
  return [primaryUrl, CMS_STATIC_SNAPSHOT_PATH];
};

const getCircularDistance = (index: number, activeIndex: number, total: number) => {
  let distance = index - activeIndex;

  if (distance > total / 2) {
    distance -= total;
  }

  if (distance < -total / 2) {
    distance += total;
  }

  return distance;
};

const normalizeIndex = (index: number, total: number) => {
  if (total === 0) {
    return 0;
  }
  return (index + total) % total;
};

const formatReelLabel = (value: string, maxChars = 18) => {
  const compact = value.replace(/\s+/g, ' ').trim();
  const limit = Math.max(3, maxChars);
  return compact.length > limit ? `${compact.slice(0, limit - 1)}…` : compact;
};

const extractErrorMessage = async (response: Response) => {
  try {
    const payload = (await response.json()) as { error?: string; detail?: string };
    if (payload.detail) {
      return payload.detail;
    }
    if (payload.error) {
      return payload.error;
    }
  } catch {
    // Ignore parse errors and fallback to status text.
  }

  return response.statusText || `HTTP ${response.status}`;
};

const DEFAULT_SETTINGS: SiteSettings = {
  siteTitle: 'Cuz Media | AI-Native Creative Production',
  siteDescription:
    'Cuz Media is an AI-native creative production studio building campaigns, showreels, and digital brand worlds.',
  brandName: 'CUZ MEDIA',
  brandSubline: 'Production',
  headerCtaLabel: 'Start a Project',
  headerCtaHref: 'mailto:lars@larscuzner.com',
  spinHint: 'Scroll, swipe, or use arrow keys to spin the large wheel',
  accentColor: '#bdf460',
};

const DEFAULT_PANELS: ShowcasePanel[] = [
  {
    id: 'showreel',
    client: 'Cuz Media',
    title: 'Creative Production Powered by AI',
    description:
      'Cuz Media combines strategy, creative direction, and AI-native production to ship campaigns with cinema-level craft at internet speed.',
    videoPath: 'https://pub-b53c56f5af3e471cb8b3610afdc49a36.r2.dev/CuzMedia/BHKIwide.mp4',
    posterPath: '',
    fallbackVideoSrc: 'https://stream.mux.com/B5zafx01GNBGBrB5M2AsFURPyMqkuRgHGCSA36asEIdQ/medium.mp4',
    fallbackPosterSrc:
      'https://image.mux.com/B5zafx01GNBGBrB5M2AsFURPyMqkuRgHGCSA36asEIdQ/thumbnail.webp?time=0&width=1280&height=720&fit_mode=crop',
    primaryCta: {
      label: 'Watch Showreel',
      href: '#showreel',
    },
    secondaryCta: {
      label: 'See Services',
      href: '#contact',
    },
    hero: true,
  },
  {
    id: 'arch',
    client: 'Intelligenspartiet',
    title: 'Intelligenspartiet 1Christ Theater',
    description:
      'Intelligenspartiet launches with a cinematic campaign film designed for fast rollout across social and digital channels.',
    videoPath: 'https://pub-b53c56f5af3e471cb8b3610afdc49a36.r2.dev/CuzMedia/1ChristTheater.mp4',
    posterPath: 'arch.webp',
    fallbackVideoSrc: 'https://stream.mux.com/o6OwfjPw372zfR1k02ubDFNPfdNszEYGo6AS00Ga00Oygs/medium.mp4',
    fallbackPosterSrc:
      'https://image.mux.com/o6OwfjPw372zfR1k02ubDFNPfdNszEYGo6AS00Ga00Oygs/thumbnail.webp?time=1&width=1280&height=720&fit_mode=crop',
    primaryCta: {
      label: 'View Project',
      href: '#arch',
    },
    secondaryCta: {
      label: 'All Work',
      href: '#void',
    },
  },
  {
    id: 'void',
    client: 'kireklame.no',
    title: 'Kireklame',
    description: 'Visual identity frame for kireklame.no, presented as a static showcase still.',
    videoPath: '',
    posterPath: 'https://pub-b53c56f5af3e471cb8b3610afdc49a36.r2.dev/CuzMedia/kireklame.png',
    fallbackPosterSrc: 'https://pub-b53c56f5af3e471cb8b3610afdc49a36.r2.dev/CuzMedia/kireklame.png',
    primaryCta: {
      label: 'View Project',
      href: '#void',
    },
    secondaryCta: {
      label: 'How We Work',
      href: '#engine',
    },
  },
  {
    id: 'munch-studio',
    client: 'Munch Studio',
    title: 'Munch Studio',
    description: 'Creative still showcase for Munch Studio.',
    videoPath: '',
    posterPath: 'https://pub-b53c56f5af3e471cb8b3610afdc49a36.r2.dev/CuzMedia/MunchStudio.png',
    fallbackPosterSrc: 'https://pub-b53c56f5af3e471cb8b3610afdc49a36.r2.dev/CuzMedia/MunchStudio.png',
    primaryCta: {
      label: 'View Project',
      href: '#munch-studio',
    },
    secondaryCta: {
      label: 'All Work',
      href: '#arch',
    },
  },
  {
    id: 'deichman',
    client: 'Deichman',
    title: 'Deichman',
    description: 'Campaign still for the Deichman project.',
    videoPath: '',
    posterPath: 'https://pub-b53c56f5af3e471cb8b3610afdc49a36.r2.dev/CuzMedia/Deichman.png',
    fallbackPosterSrc: 'https://pub-b53c56f5af3e471cb8b3610afdc49a36.r2.dev/CuzMedia/Deichman.png',
    primaryCta: {
      label: 'View Project',
      href: '#deichman',
    },
    secondaryCta: {
      label: 'All Work',
      href: '#arch',
    },
  },
  {
    id: 'cnn-cuz',
    client: 'CNN x Cuz',
    title: 'CNN Cuz',
    description: 'Editorial still frame from the CNN Cuz collaboration.',
    videoPath: '',
    posterPath: 'https://pub-b53c56f5af3e471cb8b3610afdc49a36.r2.dev/CuzMedia/CNNcuz.jpeg',
    fallbackPosterSrc: 'https://pub-b53c56f5af3e471cb8b3610afdc49a36.r2.dev/CuzMedia/CNNcuz.jpeg',
    primaryCta: {
      label: 'View Project',
      href: '#cnn-cuz',
    },
    secondaryCta: {
      label: 'All Work',
      href: '#arch',
    },
  },
  {
    id: 'engine',
    client: 'Cuz Media Systems',
    title: 'AI Content Engine',
    description:
      'From concept to distribution, we use repeatable AI workflows to turn one idea into full-channel content packages.',
    videoPath: 'engine.mp4',
    posterPath: 'engine.webp',
    fallbackVideoSrc: 'https://stream.mux.com/qMV2bGzaF6lkzPr7xxgvBbrd2OWWh5vJxP5EDeCgbr4/medium.mp4',
    fallbackPosterSrc:
      'https://image.mux.com/qMV2bGzaF6lkzPr7xxgvBbrd2OWWh5vJxP5EDeCgbr4/thumbnail.webp?time=3&width=1280&height=720&fit_mode=crop',
    primaryCta: {
      label: 'Explore Engine',
      href: '#engine',
    },
    secondaryCta: {
      label: 'Start A Project',
      href: '#contact',
    },
  },
  {
    id: 'contact',
    client: 'Start A Project',
    title: "Let's Build Your Next Campaign",
    description:
      'Tell us your timeline, goals, and budget. We will send a recommended approach and production plan within 48 hours.',
    videoPath: 'contact.mp4',
    posterPath: 'contact.webp',
    fallbackVideoSrc: 'https://stream.mux.com/MMzLrjAiGSE2L86BwnzOX802iXdDFka1OC8bvRX3B59A/medium.mp4',
    fallbackPosterSrc:
      'https://image.mux.com/MMzLrjAiGSE2L86BwnzOX802iXdDFka1OC8bvRX3B59A/thumbnail.webp?time=2&width=1280&height=720&fit_mode=crop',
    primaryCta: {
      label: 'Email Cuz Media',
      href: 'mailto:lars@larscuzner.com',
    },
    secondaryCta: {
      label: 'Instagram',
      href: 'https://instagram.com/cuzmedia_no',
    },
  },
];

const DEFAULT_NAV_ITEMS: NavItem[] = [
  { id: 'showreel', label: 'Showreel', panelIds: ['showreel'] },
  { id: 'work', label: 'Work', panelIds: ['arch', 'void', 'munch-studio', 'deichman', 'cnn-cuz'] },
  { id: 'engine', label: 'Engine', panelIds: ['engine'] },
  { id: 'contact', label: 'Contact', panelIds: ['contact'] },
];

const createDefaultCmsConfig = (): CmsConfig => ({
  settings: { ...DEFAULT_SETTINGS },
  panels: DEFAULT_PANELS.map((panel) => ({
    ...panel,
    primaryCta: { ...panel.primaryCta },
    secondaryCta: panel.secondaryCta ? { ...panel.secondaryCta } : undefined,
  })),
  navItems: DEFAULT_NAV_ITEMS.map((item) => ({ ...item, panelIds: [...item.panelIds] })),
});

const NORWEGIAN_SETTINGS_OVERRIDES: Partial<SiteSettings> = {
  siteTitle: 'Cuz Media | AI-først kreativ produksjon',
  siteDescription: 'Cuz Media er et AI-først kreativt produksjonsstudio som bygger kampanjer, visningsfilmer og digitale merkevareunivers.',
  brandSubline: 'Produksjon',
  headerCtaLabel: 'Start et prosjekt',
  spinHint: 'Scroll, sveip eller bruk piltastene for å spinne det store hjulet',
};

const NORWEGIAN_NAV_LABELS_BY_ID: Record<string, string> = {
  showreel: 'Visningsfilm',
  work: 'Prosjekter',
  engine: 'Motor',
  contact: 'Kontakt',
};

const NORWEGIAN_TEXT_MAP: Record<string, string> = {
  'Start a Project': 'Start et prosjekt',
  'Start A Project': 'Start et prosjekt',
  'Watch Showreel': 'Se visningsfilm',
  'See Services': 'Se tjenester',
  'View Project': 'Se prosjekt',
  'All Work': 'Alle prosjekter',
  'How We Work': 'Hvordan vi jobber',
  'Explore Engine': 'Utforsk motoren',
  'Email Cuz Media': 'Send e-post til Cuz Media',
  Work: 'Prosjekter',
  Engine: 'Motor',
  Contact: 'Kontakt',
  Showreel: 'Visningsfilm',
};

const NORWEGIAN_PANEL_OVERRIDES: Record<string, PanelCopyOverride> = {
  showreel: {
    title: 'AI-først kreativ produksjon med lærlinger',
    description:
      'Cuz Media kombinerer AI-først kreativ produksjon med lærlinger i kjernen og leverer kvalitetssikret produksjon til lavere kostnad.',
    primaryCtaLabel: 'Se visningsfilm',
    secondaryCtaLabel: 'Se tjenester',
  },
  arch: {
    title: 'Intelligenspartiet',
    description:
      'Intelligenspartiet lanseres som et AI-drevet medieprosjekt som utforsker erstatningsangst i en tid med ny automatisering.',
    primaryCtaLabel: 'Se prosjekt',
    secondaryCtaLabel: 'Alle prosjekter',
  },
  void: {
    description: 'Norsk og internasjonal katalog over AI-først kreative byråer.',
    primaryCtaLabel: 'Se prosjekt',
    secondaryCtaLabel: 'Hvordan vi jobber',
  },
  'munch-studio': {
    description: 'Kreativt stillbilde fra Munch Studio.',
    primaryCtaLabel: 'Se prosjekt',
    secondaryCtaLabel: 'Alle prosjekter',
  },
  deichman: {
    description: 'Kampanjestill for Deichman-prosjektet.',
    primaryCtaLabel: 'Se prosjekt',
    secondaryCtaLabel: 'Alle prosjekter',
  },
  'cnn-cuz': {
    description: 'Redaksjonelt stillbilde fra Cuz-evolusjonen.',
    primaryCtaLabel: 'Se prosjekt',
    secondaryCtaLabel: 'Alle prosjekter',
  },
  engine: {
    client: 'Cuz Media-systemer',
    title: 'AI-innholdsmotor',
    description:
      'Fra idé til distribusjon bruker vi repeterbare AI-arbeidsflyter for å gjøre én idé om til komplette innholdspakker for alle kanaler.',
    primaryCtaLabel: 'Utforsk motoren',
    secondaryCtaLabel: 'Start et prosjekt',
  },
  contact: {
    client: 'Start et prosjekt',
    title: 'La oss bygge din neste kampanje',
    description: 'Fortell oss om tidslinje, mål og budsjett. Vi sender anbefalt opplegg og produksjonsplan innen 48 timer.',
    primaryCtaLabel: 'Send e-post til Cuz Media',
  },
};

const SITE_UI_COPY: Record<SiteLanguage, SiteUiCopy> = {
  no: {
    menuLabel: 'Meny',
    closeLabel: 'Lukk',
    primaryNavLabel: 'Primærnavigasjon',
    cmsFallbackPrefix: 'CMS-reserve aktiv: ',
    wheelProgressLabel: 'Hjulstatus',
    toggleEnglishLabel: 'Toggle English',
    toggleNorwegianLabel: 'Bytt til norsk',
    homeAriaLabel: (brandName: string) => `Gå til forsiden for ${brandName}`,
  },
  en: {
    menuLabel: 'Menu',
    closeLabel: 'Close',
    primaryNavLabel: 'Primary navigation',
    cmsFallbackPrefix: 'CMS fallback active: ',
    wheelProgressLabel: 'Wheel progress',
    toggleEnglishLabel: 'Toggle English',
    toggleNorwegianLabel: 'Switch to Norwegian',
    homeAriaLabel: (brandName: string) => `Go to ${brandName} home`,
  },
};

const translateToNorwegian = (value: string) => NORWEGIAN_TEXT_MAP[value] ?? value;

const localizeSettings = (settings: SiteSettings, language: SiteLanguage): SiteSettings => {
  if (language === 'en') {
    return settings;
  }

  return {
    ...settings,
    siteTitle: NORWEGIAN_SETTINGS_OVERRIDES.siteTitle ?? settings.siteTitle,
    siteDescription: NORWEGIAN_SETTINGS_OVERRIDES.siteDescription ?? settings.siteDescription,
    brandSubline: NORWEGIAN_SETTINGS_OVERRIDES.brandSubline ?? settings.brandSubline,
    headerCtaLabel: NORWEGIAN_SETTINGS_OVERRIDES.headerCtaLabel ?? translateToNorwegian(settings.headerCtaLabel),
    spinHint: NORWEGIAN_SETTINGS_OVERRIDES.spinHint ?? settings.spinHint,
  };
};

const localizePanel = (panel: ShowcasePanel, language: SiteLanguage): ShowcasePanel => {
  if (language === 'en') {
    return panel;
  }

  const copyOverride = NORWEGIAN_PANEL_OVERRIDES[panel.id];
  return {
    ...panel,
    client: copyOverride?.client ?? translateToNorwegian(panel.client),
    title: copyOverride?.title ?? translateToNorwegian(panel.title),
    description: copyOverride?.description ?? translateToNorwegian(panel.description),
    primaryCta: {
      ...panel.primaryCta,
      label: copyOverride?.primaryCtaLabel ?? translateToNorwegian(panel.primaryCta.label),
    },
    secondaryCta: panel.secondaryCta
      ? {
          ...panel.secondaryCta,
          label: copyOverride?.secondaryCtaLabel ?? translateToNorwegian(panel.secondaryCta.label),
        }
      : undefined,
  };
};

const localizeNavItem = (item: NavItem, language: SiteLanguage): NavItem => {
  if (language === 'en') {
    return item;
  }

  return {
    ...item,
    label: NORWEGIAN_NAV_LABELS_BY_ID[item.id] ?? translateToNorwegian(item.label),
  };
};

const localizeCmsConfig = (config: CmsConfig, language: SiteLanguage): CmsConfig => {
  if (language === 'en') {
    return config;
  }

  return {
    settings: localizeSettings(config.settings, language),
    panels: config.panels.map((panel) => localizePanel(panel, language)),
    navItems: config.navItems.map((item) => localizeNavItem(item, language)),
  };
};

const isCmsConfig = (value: unknown): value is CmsConfig => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as CmsConfig;
  if (!candidate.settings || !Array.isArray(candidate.panels) || !Array.isArray(candidate.navItems)) {
    return false;
  }

  return true;
};

const SiteApp: React.FC = () => {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const activeIndexRef = useRef(0);
  const wheelAccumulatorRef = useRef(0);
  const touchStartYRef = useRef<number | null>(null);
  const spinTimeoutRef = useRef<number | null>(null);
  const isSpinningRef = useRef(false);

  const [cmsConfig, setCmsConfig] = useState<CmsConfig>(() => createDefaultCmsConfig());
  const [cmsError, setCmsError] = useState<string | null>(null);
  const [language, setLanguage] = useState<SiteLanguage>(() => {
    if (typeof window === 'undefined') {
      return 'no';
    }
    return window.localStorage.getItem(SITE_LANGUAGE_STORAGE_KEY) === 'en' ? 'en' : 'no';
  });

  const [activeIndex, setActiveIndex] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const [spinDirection, setSpinDirection] = useState<1 | -1>(1);
  const [wheelRotation, setWheelRotation] = useState(0);

  const uiCopy = SITE_UI_COPY[language];
  const localizedDefaultCmsConfig = useMemo(() => localizeCmsConfig(createDefaultCmsConfig(), language), [language]);
  const localizedCmsConfig = useMemo(() => localizeCmsConfig(cmsConfig, language), [cmsConfig, language]);

  const settings = localizedCmsConfig.settings;
  const panels = localizedCmsConfig.panels.length > 0 ? localizedCmsConfig.panels : localizedDefaultCmsConfig.panels;
  const navItems = localizedCmsConfig.navItems.length > 0 ? localizedCmsConfig.navItems : localizedDefaultCmsConfig.navItems;

  const panelCount = panels.length;
  const segmentAngle = panelCount > 0 ? 360 / panelCount : 0;
  const thumbnailAngle = panelCount > 0 ? 360 / panelCount : 0;
  const thumbnailRotation = wheelRotation;
  const activePanel = panels[activeIndex] ?? panels[0];

  const reelLabelMaxChars = useMemo(() => {
    const labelRadius = 20.6;
    const usableArcLength = panelCount > 0 ? ((2 * Math.PI * labelRadius) / panelCount) * 0.84 : 0;
    const avgCharWidth = 2.16;
    const computed = Math.floor(usableArcLength / avgCharWidth);
    return Math.max(4, Math.min(12, computed));
  }, [panelCount]);

  const panelIndexById = useMemo(() => {
    const map = new Map<string, number>();
    panels.forEach((panel, index) => {
      map.set(panel.id, index);
    });
    return map;
  }, [panels]);

  const clearSpinTimeout = useCallback(() => {
    if (spinTimeoutRef.current !== null) {
      window.clearTimeout(spinTimeoutRef.current);
      spinTimeoutRef.current = null;
    }
  }, []);

  const unlockSpin = useCallback(() => {
    isSpinningRef.current = false;
    setIsSpinning(false);
  }, []);

  const spinBySteps = useCallback(
    (rawSteps: number) => {
      if (panelCount === 0 || segmentAngle === 0) {
        return;
      }

      const steps = Math.trunc(rawSteps);
      if (!steps || isSpinningRef.current) {
        return;
      }

      const nextIndex = normalizeIndex(activeIndexRef.current + steps, panelCount);
      const direction: 1 | -1 = steps > 0 ? 1 : -1;

      isSpinningRef.current = true;
      setIsSpinning(true);
      setSpinDirection(direction);

      activeIndexRef.current = nextIndex;
      setActiveIndex(nextIndex);
      setMenuOpen(false);
      wheelAccumulatorRef.current = 0;
      setWheelRotation((current) => current - steps * segmentAngle);

      clearSpinTimeout();
      const lockMs = Math.min(1500, SPIN_BASE_LOCK_MS + (Math.abs(steps) - 1) * 130);
      spinTimeoutRef.current = window.setTimeout(() => {
        unlockSpin();
      }, lockMs);
    },
    [clearSpinTimeout, panelCount, segmentAngle, unlockSpin]
  );

  const spinToPanel = useCallback(
    (panelId: string) => {
      const targetIndex = panelIndexById.get(panelId);
      if (targetIndex === undefined || panelCount === 0) {
        return;
      }

      const currentIndex = activeIndexRef.current;
      let steps = targetIndex - currentIndex;

      if (steps > panelCount / 2) {
        steps -= panelCount;
      }

      if (steps < -panelCount / 2) {
        steps += panelCount;
      }

      spinBySteps(steps);
    },
    [panelCount, panelIndexById, spinBySteps]
  );

  const isNavActive = useCallback(
    (item: NavItem) => {
      const activeId = panels[activeIndex]?.id ?? panels[0]?.id;
      if (!activeId) {
        return false;
      }
      return item.panelIds.includes(activeId);
    },
    [activeIndex, panels]
  );

  const toggleLanguage = useCallback(() => {
    setLanguage((current) => (current === 'en' ? 'no' : 'en'));
  }, []);

  const renderAction = useCallback(
    (cta: CtaLink, className?: string) => {
      if (cta.href.startsWith('#')) {
        const targetId = cta.href.slice(1);
        return (
          <button type="button" className={className} onClick={() => spinToPanel(targetId)}>
            {cta.label}
            <span className="arrow-chip">{'>'}</span>
          </button>
        );
      }

      return (
        <a className={className} href={cta.href}>
          {cta.label}
          <span className="arrow-chip">{'>'}</span>
        </a>
      );
    },
    [spinToPanel]
  );

  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  useEffect(() => {
    if (!panelCount) {
      return;
    }

    if (activeIndex >= panelCount) {
      activeIndexRef.current = 0;
      setActiveIndex(0);
      setWheelRotation(0);
      wheelAccumulatorRef.current = 0;
    }
  }, [activeIndex, panelCount]);

  useEffect(() => {
    return () => {
      clearSpinTimeout();
    };
  }, [clearSpinTimeout]);

  useEffect(() => {
    document.title = settings.siteTitle;
    document.documentElement.style.setProperty('--accent', settings.accentColor);

    const descriptionTag = document.querySelector('meta[name="description"]');
    if (descriptionTag) {
      descriptionTag.setAttribute('content', settings.siteDescription);
    }
  }, [settings.accentColor, settings.siteDescription, settings.siteTitle]);

  useEffect(() => {
    window.localStorage.setItem(SITE_LANGUAGE_STORAGE_KEY, language);
    document.documentElement.setAttribute('lang', language === 'no' ? 'nb' : 'en');
  }, [language]);

  useEffect(() => {
    let cancelled = false;

    const loadCms = async () => {
      let lastError: string | null = null;
      const cmsFetchUrls = getCmsFetchUrls();

      for (const url of cmsFetchUrls) {
        try {
          const response = await fetch(url, {
            cache: 'no-store',
          });

          if (!response.ok) {
            throw new Error(await extractErrorMessage(response));
          }

          const payload = (await response.json()) as unknown;
          if (!isCmsConfig(payload)) {
            throw new Error('Invalid CMS payload');
          }

          if (!cancelled) {
            setCmsConfig(payload);
            setCmsError(null);
          }
          return;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          lastError = `${url} -> ${message}`;
        }
      }

      if (!cancelled) {
        setCmsError(lastError ?? 'CMS unavailable, using local defaults');
      }
    };

    loadCms();
    const pollId = window.setInterval(loadCms, 10000);

    return () => {
      cancelled = true;
      window.clearInterval(pollId);
    };
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) {
      return;
    }

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (isSpinningRef.current) {
        return;
      }

      wheelAccumulatorRef.current += event.deltaY;
      if (Math.abs(wheelAccumulatorRef.current) < WHEEL_THRESHOLD) {
        return;
      }

      const step = wheelAccumulatorRef.current > 0 ? 1 : -1;
      spinBySteps(step);
    };

    stage.addEventListener('wheel', onWheel, { passive: false });
    return () => stage.removeEventListener('wheel', onWheel);
  }, [spinBySteps]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
        return;
      }

      if (event.key === 'Escape') {
        setMenuOpen(false);
        return;
      }

      if (event.key === 'ArrowDown' || event.key === 'ArrowRight' || event.key === 'PageDown') {
        event.preventDefault();
        spinBySteps(1);
      }

      if (event.key === 'ArrowUp' || event.key === 'ArrowLeft' || event.key === 'PageUp') {
        event.preventDefault();
        spinBySteps(-1);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [spinBySteps]);

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    touchStartYRef.current = event.changedTouches[0]?.clientY ?? null;
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartYRef.current === null) {
      return;
    }

    const touchEnd = event.changedTouches[0]?.clientY ?? touchStartYRef.current;
    const delta = touchStartYRef.current - touchEnd;
    touchStartYRef.current = null;

    if (Math.abs(delta) < SWIPE_THRESHOLD) {
      return;
    }

    spinBySteps(delta > 0 ? 1 : -1);
  };

  const activePoster = activePanel
    ? getConfiguredMediaUrl(activePanel.posterPath) ?? activePanel.fallbackPosterSrc
    : DEFAULT_PANELS[0].fallbackPosterSrc;

  return (
    <div className={`site-shell wheel-shell ${isSpinning ? 'is-spinning' : ''}`} data-spin-direction={spinDirection === 1 ? 'next' : 'prev'}>
      <header className="site-header">
        <button
          className="brand-lockup"
          onClick={() => spinToPanel('showreel')}
          type="button"
          aria-label={uiCopy.homeAriaLabel(settings.brandName)}
        >
          <img className="brand-logo" src="/cuz-logo.png" alt="" aria-hidden="true" />
        </button>

        <nav className="glass-shell desktop-nav" aria-label={uiCopy.primaryNavLabel}>
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                const targetId = item.panelIds[0] ?? panels[0]?.id;
                if (targetId) {
                  spinToPanel(targetId);
                }
              }}
              className={`nav-item ${isNavActive(item) ? 'is-active' : ''}`}
              aria-current={isNavActive(item) ? 'page' : undefined}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <a className="glass-button cta-desktop" href={settings.headerCtaHref}>
          {settings.headerCtaLabel}
          <span className="arrow-chip">{'>'}</span>
        </a>
        <a className="glass-button cta-desktop cta-linkedin" href={LINKEDIN_URL} target="_blank" rel="noreferrer">
          LinkedIn
          <span className="arrow-chip">{'>'}</span>
        </a>
        <button className="glass-button language-toggle" type="button" onClick={toggleLanguage} aria-pressed={language === 'en'}>
          {language === 'en' ? uiCopy.toggleNorwegianLabel : uiCopy.toggleEnglishLabel}
          <span className="arrow-chip">{language === 'en' ? 'NO' : 'EN'}</span>
        </button>

        <button
          className="glass-button menu-toggle"
          type="button"
          onClick={() => setMenuOpen((current) => !current)}
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
        >
          {menuOpen ? uiCopy.closeLabel : uiCopy.menuLabel}
          <span className="arrow-chip">{menuOpen ? 'X' : '='}</span>
        </button>
      </header>

      <div className={`mobile-drawer ${menuOpen ? 'open' : ''}`} id="mobile-menu">
        {navItems.map((item) => (
          <button
            key={item.id}
            className="mobile-link"
            onClick={() => {
              const targetId = item.panelIds[0] ?? panels[0]?.id;
              if (targetId) {
                spinToPanel(targetId);
              }
            }}
            type="button"
          >
            {item.label}
            <span>{'>'}</span>
          </button>
        ))}
        <a className="glass-button mobile-cta" href={settings.headerCtaHref} onClick={() => setMenuOpen(false)}>
          {settings.headerCtaLabel}
          <span className="arrow-chip">{'>'}</span>
        </a>
        <a className="glass-button mobile-cta linkedin-cta" href={LINKEDIN_URL} target="_blank" rel="noreferrer" onClick={() => setMenuOpen(false)}>
          LinkedIn
          <span className="arrow-chip">{'>'}</span>
        </a>
        <button
          className="glass-button mobile-cta language-toggle-mobile"
          type="button"
          onClick={() => {
            toggleLanguage();
            setMenuOpen(false);
          }}
          aria-pressed={language === 'en'}
        >
          {language === 'en' ? uiCopy.toggleNorwegianLabel : uiCopy.toggleEnglishLabel}
          <span className="arrow-chip">{language === 'en' ? 'NO' : 'EN'}</span>
        </button>
      </div>

      {cmsError ? <p className="cms-warning">{uiCopy.cmsFallbackPrefix}{cmsError}</p> : null}

      <main className="wheel-main">
        <div className="ambient-media" aria-hidden>
          <img src={activePoster} alt="" />
          <div className="ambient-overlay" />
        </div>

        <section className="wheel-stage" ref={stageRef} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
          <div className="big-wheel" style={{ transform: `translate(-50%, -50%) rotate(${wheelRotation}deg)` }}>
            {panels.map((panel, index) => {
              const mediaVideoSrc = getConfiguredMediaUrl(panel.videoPath);
              const fallbackVideoSrc = panel.fallbackVideoSrc?.trim() ? panel.fallbackVideoSrc : null;
              const resolvedVideoSrc = mediaVideoSrc ?? fallbackVideoSrc;
              const mediaPosterSrc = getConfiguredMediaUrl(panel.posterPath) ?? panel.fallbackPosterSrc;
              const panelAngle = index * segmentAngle;
              const distance = getCircularDistance(index, activeIndex, panelCount);
              const absDistance = Math.abs(distance);
              const isActive = absDistance === 0;
              const shouldPlayVideo = Boolean(resolvedVideoSrc) && (isActive || (isSpinning && absDistance === 1));
              const cardStyle = {
                transform: `translate(-50%, -50%) rotate(${panelAngle}deg) translateY(calc(var(--big-wheel-radius) * -1))`,
                opacity: 1,
                zIndex: panelCount - Math.round(absDistance),
                pointerEvents: isActive ? 'auto' : 'none',
              } as CSSProperties;

              return (
                <article
                  key={panel.id}
                  className={`wheel-card ${isActive ? 'is-active' : ''} ${panel.hero ? 'is-hero' : ''} ${
                    isSpinning && isActive ? 'is-revealing' : ''
                  }`}
                  style={cardStyle}
                  aria-hidden={!isActive}
                >
                  <div className="wheel-media">
                    {shouldPlayVideo ? (
                      <video autoPlay muted loop playsInline preload="metadata" poster={mediaPosterSrc}>
                        <source src={resolvedVideoSrc ?? undefined} type="video/mp4" />
                      </video>
                    ) : (
                      <img src={mediaPosterSrc} alt="" loading="lazy" />
                    )}
                    <div className="panel-vignette" />
                  </div>

                  <div className="panel-content">
                    <p className="panel-eyebrow">{panel.client}</p>
                    {panel.hero ? <h1 className="panel-title">{panel.title}</h1> : <h2 className="panel-title">{panel.title}</h2>}
                    <p className="panel-description">{panel.description}</p>
                    <div className="panel-actions">
                      {renderAction(panel.primaryCta, 'glass-button')}
                      {panel.secondaryCta ? renderAction(panel.secondaryCta, 'glass-button ghost-button') : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <p className="spin-hint">{settings.spinHint}</p>
      </main>

      <aside className="thumbnail-wheel" aria-label={uiCopy.wheelProgressLabel}>
        <div className="thumbnail-wheel-track" style={{ transform: `rotate(${thumbnailRotation}deg)` }}>
          <svg className="thumbnail-wheel-svg" viewBox="0 0 100 100" role="presentation">
            <defs>
              {panels.map((panel) => {
                return (
                  <clipPath key={`clip-${panel.id}`} id={`thumb-window-${panel.id}`} clipPathUnits="userSpaceOnUse">
                    <rect x="43.4" y="4.9" width="13.2" height="15.4" rx="2.15" ry="2.15" />
                  </clipPath>
                );
              })}
            </defs>
            <circle className="thumbnail-reel-shell" cx="50" cy="50" r="49.2" />
            <circle className="thumbnail-reel-inner-ring" cx="50" cy="50" r="31" />

            {panels.map((panel, index) => {
              const thumbnailSrc = getConfiguredMediaUrl(panel.posterPath) ?? panel.fallbackPosterSrc;
              const panelAngle = index * thumbnailAngle;
              const reelLabel = formatReelLabel(panel.title, reelLabelMaxChars);

              return (
                <g
                  key={`thumb-${panel.id}`}
                  className={`thumbnail-window ${index === activeIndex ? 'is-active' : ''}`}
                  transform={`rotate(${panelAngle} 50 50)`}
                  onClick={() => spinToPanel(panel.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      spinToPanel(panel.id);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={panel.title}
                >
                  <rect className="thumbnail-window-tab" x="48.6" y="0.85" width="2.8" height="5.65" rx="0.64" ry="0.64" />
                  <rect className="thumbnail-window-frame" x="42.9" y="4.4" width="14.2" height="16.4" rx="2.6" ry="2.6" />
                  <image
                    className="thumbnail-window-image"
                    href={thumbnailSrc}
                    x="43.4"
                    y="4.9"
                    width="13.2"
                    height="15.4"
                    preserveAspectRatio="xMidYMid slice"
                    clipPath={`url(#thumb-window-${panel.id})`}
                  />
                  <rect className="thumbnail-window-stroke" x="43.4" y="4.9" width="13.2" height="15.4" rx="2.15" ry="2.15" />
                  <text className="thumbnail-window-label" x="50" y="29.4" textAnchor="middle">
                    {reelLabel}
                  </text>
                </g>
              );
            })}

            <circle className="thumbnail-center-disc" cx="50" cy="50" r="16.2" />
            <circle className="thumbnail-center-hole" cx="50" cy="50" r="2.3" />
            <text className="thumbnail-brand" x="50" y="45.7" textAnchor="middle">
              CUZ Media
            </text>
            <text className="thumbnail-active-title" x="50" y="51.3" textAnchor="middle">
              {formatReelLabel(activePanel?.title ?? '', 20)}
            </text>
            <text className="thumbnail-count" x="50" y="56.6" textAnchor="middle">
              {String(activeIndex + 1).padStart(2, '0')} / {String(panelCount).padStart(2, '0')}
            </text>
          </svg>
        </div>
      </aside>
    </div>
  );
};

const AdminApp: React.FC = () => {
  const [token, setToken] = useState<string>(() => localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) ?? '');
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [draftCms, setDraftCms] = useState<CmsConfig | null>(null);
  const [jsonDraft, setJsonDraft] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [revisions, setRevisions] = useState<RevisionRecord[]>([]);
  const [uploadingFieldKey, setUploadingFieldKey] = useState<string | null>(null);

  const loadCms = useCallback(
    async (authToken: string) => {
      const response = await fetch(getApiUrl('/api/admin/cms'), {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(await extractErrorMessage(response));
      }

      const payload = (await response.json()) as { cms: CmsConfig };
      const nextCms = payload.cms;
      if (!isCmsConfig(nextCms)) {
        throw new Error('Invalid CMS payload returned from server');
      }

      setDraftCms(nextCms);
      setJsonDraft(`${JSON.stringify(nextCms, null, 2)}\n`);
    },
    []
  );

  const loadRevisions = useCallback(
    async (authToken: string) => {
      const response = await fetch(getApiUrl('/api/admin/revisions'), {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(await extractErrorMessage(response));
      }

      const payload = (await response.json()) as { revisions: RevisionRecord[] };
      setRevisions(Array.isArray(payload.revisions) ? payload.revisions : []);
    },
    []
  );

  useEffect(() => {
    if (!token) {
      setDraftCms(null);
      setJsonDraft('');
      setRevisions([]);
      return;
    }

    let cancelled = false;

    const bootstrap = async () => {
      setIsBusy(true);
      setStatusMessage('Loading CMS data...');
      setErrorMessage(null);

      try {
        await Promise.all([loadCms(token), loadRevisions(token)]);
        if (!cancelled) {
          setStatusMessage('CMS data loaded.');
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : 'Failed to load CMS data');
          setToken('');
          localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
        }
      } finally {
        if (!cancelled) {
          setIsBusy(false);
        }
      }
    };

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, [loadCms, loadRevisions, token]);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsBusy(true);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      const response = await fetch(getApiUrl('/api/admin/login'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        throw new Error(await extractErrorMessage(response));
      }

      const payload = (await response.json()) as { token: string };
      localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, payload.token);
      setToken(payload.token);
      setPassword('');
      setStatusMessage('Authenticated.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to authenticate');
    } finally {
      setIsBusy(false);
    }
  };

  const handleSave = async () => {
    if (!token || !draftCms) {
      return;
    }

    setIsBusy(true);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      const response = await fetch(getApiUrl('/api/admin/cms'), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(draftCms),
      });

      if (!response.ok) {
        throw new Error(await extractErrorMessage(response));
      }

      await Promise.all([loadCms(token), loadRevisions(token)]);
      setStatusMessage('Saved successfully. Live site updates automatically.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to save CMS changes');
    } finally {
      setIsBusy(false);
    }
  };

  const handleReload = async () => {
    if (!token) {
      return;
    }

    setIsBusy(true);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      await Promise.all([loadCms(token), loadRevisions(token)]);
      setStatusMessage('Reloaded from backend.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to reload CMS');
    } finally {
      setIsBusy(false);
    }
  };

  const handleReset = async () => {
    if (!token) {
      return;
    }

    const shouldReset = window.confirm('Reset the CMS to default content? A revision backup will be kept.');
    if (!shouldReset) {
      return;
    }

    setIsBusy(true);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      const response = await fetch(getApiUrl('/api/admin/reset'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(await extractErrorMessage(response));
      }

      await Promise.all([loadCms(token), loadRevisions(token)]);
      setStatusMessage('Default CMS restored.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to reset CMS');
    } finally {
      setIsBusy(false);
    }
  };

  const handleRestoreRevision = async (revisionId: string) => {
    if (!token) {
      return;
    }

    const shouldRestore = window.confirm(`Restore revision ${revisionId}? Current state will be backed up first.`);
    if (!shouldRestore) {
      return;
    }

    setIsBusy(true);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      const response = await fetch(getApiUrl(`/api/admin/revisions/${encodeURIComponent(revisionId)}/restore`), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(await extractErrorMessage(response));
      }

      await Promise.all([loadCms(token), loadRevisions(token)]);
      setStatusMessage(`Restored revision ${revisionId}.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to restore revision');
    } finally {
      setIsBusy(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
    setToken('');
    setDraftCms(null);
    setJsonDraft('');
    setStatusMessage(null);
    setErrorMessage(null);
  };

  const updateSettings = (field: keyof SiteSettings, value: string) => {
    setDraftCms((current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        settings: {
          ...current.settings,
          [field]: value,
        },
      };
    });
  };

  const updatePanel = (index: number, updater: (panel: ShowcasePanel) => ShowcasePanel) => {
    setDraftCms((current) => {
      if (!current) {
        return current;
      }

      const nextPanels = [...current.panels];
      if (!nextPanels[index]) {
        return current;
      }

      nextPanels[index] = updater(nextPanels[index]);
      return {
        ...current,
        panels: nextPanels,
      };
    });
  };

  const getUploadFieldKey = (panelId: string, kind: UploadKind) => `${panelId}:${kind}`;

  const uploadPanelMedia = async (panelIndex: number, kind: UploadKind, file: File) => {
    if (!token || !draftCms) {
      return;
    }

    const panel = draftCms.panels[panelIndex];
    if (!panel) {
      return;
    }

    const uploadFieldKey = getUploadFieldKey(panel.id, kind);
    setUploadingFieldKey(uploadFieldKey);
    setStatusMessage(`Preparing ${kind} upload...`);
    setErrorMessage(null);

    try {
      const signResponse = await fetch(getApiUrl('/api/admin/upload-sign'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          panelId: panel.id,
          kind,
          filename: file.name,
          contentType: file.type,
          fileSize: file.size,
        }),
      });

      if (!signResponse.ok) {
        throw new Error(await extractErrorMessage(signResponse));
      }

      const signed = (await signResponse.json()) as {
        uploadUrl: string;
        publicUrl: string;
        objectKey: string;
        contentType: string;
      };

      if (!signed.uploadUrl || !signed.publicUrl || !signed.objectKey || !signed.contentType) {
        throw new Error('Invalid upload signature payload');
      }

      const uploadResponse = await fetch(signed.uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': signed.contentType,
        },
        body: file,
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed (${uploadResponse.status})`);
      }

      if (kind === 'video') {
        updatePanel(panelIndex, (current) => ({
          ...current,
          videoPath: signed.publicUrl,
        }));
      } else {
        updatePanel(panelIndex, (current) => ({
          ...current,
          posterPath: signed.publicUrl,
          fallbackPosterSrc: signed.publicUrl,
        }));
      }

      setStatusMessage(`Uploaded ${file.name} to ${signed.objectKey}. Click Save & Publish to persist this media URL.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : `Failed to upload ${kind}`);
    } finally {
      setUploadingFieldKey(null);
    }
  };

  const handlePanelFileSelect = (panelIndex: number, kind: UploadKind) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }
    void uploadPanelMedia(panelIndex, kind, file);
  };

  const movePanel = (index: number, direction: -1 | 1) => {
    setDraftCms((current) => {
      if (!current) {
        return current;
      }

      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= current.panels.length) {
        return current;
      }

      const nextPanels = [...current.panels];
      const temp = nextPanels[index];
      nextPanels[index] = nextPanels[targetIndex];
      nextPanels[targetIndex] = temp;

      return {
        ...current,
        panels: nextPanels,
      };
    });
  };

  const addPanel = () => {
    setDraftCms((current) => {
      if (!current) {
        return current;
      }

      const id = `panel-${Date.now().toString(36)}`;
      const newPanel: ShowcasePanel = {
        id,
        client: 'New Client',
        title: 'New Slide',
        description: 'Describe this slide.',
        videoPath: '',
        posterPath: '',
        fallbackPosterSrc: current.panels[0]?.fallbackPosterSrc ?? 'https://dummyimage.com/1280x720/111827/f8fafc.png&text=New+Slide',
        primaryCta: {
          label: 'View',
          href: `#${id}`,
        },
        secondaryCta: {
          label: 'More',
          href: '#showreel',
        },
      };

      const nextNavItems = current.navItems.map((item, navIndex) => {
        if (navIndex !== 0) {
          return item;
        }

        return {
          ...item,
          panelIds: item.panelIds.includes(id) ? item.panelIds : [...item.panelIds, id],
        };
      });

      return {
        ...current,
        panels: [...current.panels, newPanel],
        navItems: nextNavItems,
      };
    });
  };

  const removePanel = (index: number) => {
    setDraftCms((current) => {
      if (!current || current.panels.length <= 1) {
        return current;
      }

      const panelToRemove = current.panels[index];
      if (!panelToRemove) {
        return current;
      }

      const shouldRemove = window.confirm(`Remove panel '${panelToRemove.title}'?`);
      if (!shouldRemove) {
        return current;
      }

      const nextPanels = current.panels.filter((_, panelIndex) => panelIndex !== index);
      const nextNavItems = current.navItems.map((item) => ({
        ...item,
        panelIds: item.panelIds.filter((panelId) => panelId !== panelToRemove.id),
      }));

      return {
        ...current,
        panels: nextPanels,
        navItems: nextNavItems,
      };
    });
  };

  const updateNavItem = (index: number, updater: (item: NavItem) => NavItem) => {
    setDraftCms((current) => {
      if (!current) {
        return current;
      }

      const nextNavItems = [...current.navItems];
      if (!nextNavItems[index]) {
        return current;
      }

      nextNavItems[index] = updater(nextNavItems[index]);
      return {
        ...current,
        navItems: nextNavItems,
      };
    });
  };

  const setPanelNavOwner = (panelId: string, navId: string) => {
    setDraftCms((current) => {
      if (!current) {
        return current;
      }

      const withoutPanel = current.navItems.map((item) => ({
        ...item,
        panelIds: item.panelIds.filter((id) => id !== panelId),
      }));

      if (!navId) {
        return {
          ...current,
          navItems: withoutPanel,
        };
      }

      const nextNavItems = withoutPanel.map((item) => {
        if (item.id !== navId) {
          return item;
        }

        return {
          ...item,
          panelIds: item.panelIds.includes(panelId) ? item.panelIds : [...item.panelIds, panelId],
        };
      });

      return {
        ...current,
        navItems: nextNavItems,
      };
    });
  };

  const updatePanelId = (index: number, nextIdRaw: string) => {
    const nextId = nextIdRaw.trim();
    setDraftCms((current) => {
      if (!current || !current.panels[index]) {
        return current;
      }

      const previousId = current.panels[index].id;
      const nextPanels = [...current.panels];
      nextPanels[index] = {
        ...nextPanels[index],
        id: nextId,
        primaryCta: {
          ...nextPanels[index].primaryCta,
          href: nextPanels[index].primaryCta.href.startsWith('#') ? `#${nextId}` : nextPanels[index].primaryCta.href,
        },
      };

      const nextNavItems = current.navItems.map((item) => ({
        ...item,
        panelIds: item.panelIds.map((panelId) => (panelId === previousId ? nextId : panelId)),
      }));

      return {
        ...current,
        panels: nextPanels,
        navItems: nextNavItems,
      };
    });
  };

  const addNavItem = () => {
    setDraftCms((current) => {
      if (!current) {
        return current;
      }

      const id = `nav-${Date.now().toString(36)}`;
      const fallbackPanelId = current.panels[0]?.id;
      return {
        ...current,
        navItems: [
          ...current.navItems,
          {
            id,
            label: 'New Nav',
            panelIds: fallbackPanelId ? [fallbackPanelId] : [],
          },
        ],
      };
    });
  };

  const removeNavItem = (index: number) => {
    setDraftCms((current) => {
      if (!current || current.navItems.length <= 1) {
        return current;
      }

      const item = current.navItems[index];
      if (!item) {
        return current;
      }

      const shouldRemove = window.confirm(`Remove navigation item '${item.label}'?`);
      if (!shouldRemove) {
        return current;
      }

      return {
        ...current,
        navItems: current.navItems.filter((_, navIndex) => navIndex !== index),
      };
    });
  };

  const syncFormToJson = () => {
    if (!draftCms) {
      return;
    }
    setJsonDraft(`${JSON.stringify(draftCms, null, 2)}\n`);
    setStatusMessage('JSON synced from visual form.');
    setErrorMessage(null);
  };

  const applyJsonToForm = () => {
    try {
      const parsed = JSON.parse(jsonDraft) as unknown;
      if (!isCmsConfig(parsed)) {
        throw new Error('Invalid CMS JSON shape');
      }

      setDraftCms(parsed);
      setStatusMessage('Applied JSON into visual form.');
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Invalid JSON');
    }
  };

  const getPanelNavOwner = (panelId: string) => {
    if (!draftCms) {
      return '';
    }
    return draftCms.navItems.find((item) => item.panelIds.includes(panelId))?.id ?? '';
  };

  if (!token) {
    return (
      <div className="admin-shell">
        <div className="admin-card admin-login-card">
          <h1>CMS Admin</h1>
          <p>Login to control all site content, navigation, and media configuration.</p>

          <form className="admin-login-form" onSubmit={handleLogin}>
            <label>
              Username
              <input type="text" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required />
            </label>

            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </label>

            <button type="submit" disabled={isBusy}>
              {isBusy ? 'Signing In...' : 'Sign In'}
            </button>
          </form>

          <p className="admin-hint">
            Default credentials are managed by backend env vars: <code>CMS_ADMIN_USER</code> and <code>CMS_ADMIN_PASS</code>.
          </p>
          {errorMessage ? <p className="admin-error">{errorMessage}</p> : null}
        </div>
      </div>
    );
  }

  if (!draftCms) {
    return (
      <div className="admin-shell">
        <div className="admin-card admin-editor-card">
          <p className="admin-status">Loading visual CMS...</p>
          {errorMessage ? <p className="admin-error">{errorMessage}</p> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="admin-shell">
      <div className="admin-card admin-editor-card">
        <header className="admin-header">
          <div>
            <h1>CMS Admin</h1>
            <p>Visual editor for site settings, wheel slides, and navigation.</p>
          </div>
          <div className="admin-header-actions">
            <a href="/" target="_blank" rel="noreferrer">
              Open Site
            </a>
            <button type="button" onClick={handleLogout} className="admin-secondary-button">
              Logout
            </button>
          </div>
        </header>

        <div className="admin-toolbar">
          <button type="button" onClick={handleSave} disabled={isBusy}>
            {isBusy ? 'Working...' : 'Save & Publish'}
          </button>
          <button type="button" onClick={handleReload} disabled={isBusy} className="admin-secondary-button">
            Reload
          </button>
          <button type="button" onClick={handleReset} disabled={isBusy} className="admin-secondary-button">
            Reset To Default
          </button>
        </div>

        {statusMessage ? <p className="admin-status">{statusMessage}</p> : null}
        {errorMessage ? <p className="admin-error">{errorMessage}</p> : null}

        <section className="admin-section">
          <h2>Global Settings</h2>
          <div className="admin-field-grid">
            <label className="admin-field">
              <span>Site Title</span>
              <input value={draftCms.settings.siteTitle} onChange={(event) => updateSettings('siteTitle', event.target.value)} />
            </label>
            <label className="admin-field">
              <span>Accent Color</span>
              <input value={draftCms.settings.accentColor} onChange={(event) => updateSettings('accentColor', event.target.value)} />
            </label>
            <label className="admin-field">
              <span>Brand Name</span>
              <input value={draftCms.settings.brandName} onChange={(event) => updateSettings('brandName', event.target.value)} />
            </label>
            <label className="admin-field">
              <span>Brand Subline</span>
              <input value={draftCms.settings.brandSubline} onChange={(event) => updateSettings('brandSubline', event.target.value)} />
            </label>
            <label className="admin-field">
              <span>Header CTA Label</span>
              <input value={draftCms.settings.headerCtaLabel} onChange={(event) => updateSettings('headerCtaLabel', event.target.value)} />
            </label>
            <label className="admin-field">
              <span>Header CTA Link</span>
              <input value={draftCms.settings.headerCtaHref} onChange={(event) => updateSettings('headerCtaHref', event.target.value)} />
            </label>
          </div>
          <label className="admin-field admin-field-block">
            <span>Meta Description</span>
            <textarea value={draftCms.settings.siteDescription} onChange={(event) => updateSettings('siteDescription', event.target.value)} rows={2} />
          </label>
          <label className="admin-field admin-field-block">
            <span>Spin Hint</span>
            <input value={draftCms.settings.spinHint} onChange={(event) => updateSettings('spinHint', event.target.value)} />
          </label>
        </section>

        <section className="admin-section">
          <div className="admin-section-header">
            <h2>Navigation</h2>
            <button type="button" onClick={addNavItem} className="admin-secondary-button">
              Add Nav Item
            </button>
          </div>
          <div className="admin-stack">
            {draftCms.navItems.map((item, index) => (
              <article className="admin-subcard" key={`${item.id}-${index}`}>
                <div className="admin-subcard-header">
                  <strong>{item.label || 'Untitled Nav Item'}</strong>
                  <button type="button" className="admin-secondary-button" onClick={() => removeNavItem(index)} disabled={draftCms.navItems.length <= 1}>
                    Remove
                  </button>
                </div>
                <div className="admin-field-grid">
                  <label className="admin-field">
                    <span>Nav ID</span>
                    <input value={item.id} onChange={(event) => updateNavItem(index, (current) => ({ ...current, id: event.target.value }))} />
                  </label>
                  <label className="admin-field">
                    <span>Label</span>
                    <input value={item.label} onChange={(event) => updateNavItem(index, (current) => ({ ...current, label: event.target.value }))} />
                  </label>
                </div>
                <p className="admin-inline-note">Panels assigned: {item.panelIds.length}. Set assignment from each panel card below.</p>
              </article>
            ))}
          </div>
        </section>

        <section className="admin-section">
          <div className="admin-section-header">
            <h2>Panels / Slides</h2>
            <button type="button" onClick={addPanel} className="admin-secondary-button">
              Add Panel
            </button>
          </div>
          <div className="admin-stack">
            {draftCms.panels.map((panel, index) => {
              const previewSrc = getConfiguredMediaUrl(panel.posterPath) ?? panel.fallbackPosterSrc;
              return (
                <article className="admin-subcard admin-panel-card" key={`${panel.id}-${index}`}>
                  <div className="admin-subcard-header">
                    <strong>
                      {index + 1}. {panel.title || panel.id}
                    </strong>
                    <div className="admin-subcard-actions">
                      <button type="button" className="admin-secondary-button" onClick={() => movePanel(index, -1)} disabled={index === 0}>
                        Up
                      </button>
                      <button
                        type="button"
                        className="admin-secondary-button"
                        onClick={() => movePanel(index, 1)}
                        disabled={index === draftCms.panels.length - 1}
                      >
                        Down
                      </button>
                      <button
                        type="button"
                        className="admin-danger-button"
                        onClick={() => removePanel(index)}
                        disabled={draftCms.panels.length <= 1}
                      >
                        Delete Panel
                      </button>
                    </div>
                  </div>

                  <div className="admin-panel-meta">
                    <img src={previewSrc} alt="" />
                    <div className="admin-panel-meta-text">
                      <p>{panel.client}</p>
                      <p>{panel.id}</p>
                    </div>
                  </div>

                  <div className="admin-field-grid">
                    <label className="admin-field">
                      <span>Panel ID</span>
                      <input value={panel.id} onChange={(event) => updatePanelId(index, event.target.value)} />
                    </label>
                    <label className="admin-field">
                      <span>Client</span>
                      <input value={panel.client} onChange={(event) => updatePanel(index, (current) => ({ ...current, client: event.target.value }))} />
                    </label>
                    <label className="admin-field">
                      <span>Title</span>
                      <input value={panel.title} onChange={(event) => updatePanel(index, (current) => ({ ...current, title: event.target.value }))} />
                    </label>
                    <label className="admin-field">
                      <span>Belongs To (Nav Section)</span>
                      <select value={getPanelNavOwner(panel.id)} onChange={(event) => setPanelNavOwner(panel.id, event.target.value)}>
                        <option value="">Unassigned</option>
                        {draftCms.navItems.map((item) => (
                          <option key={`${panel.id}-${item.id}`} value={item.id}>
                            {item.label || item.id}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="admin-field">
                      <span>Video Path</span>
                      <input value={panel.videoPath} onChange={(event) => updatePanel(index, (current) => ({ ...current, videoPath: event.target.value }))} />
                      <div className="admin-upload-row">
                        <label className="admin-upload-button">
                          {uploadingFieldKey === getUploadFieldKey(panel.id, 'video') ? 'Uploading Video...' : 'Upload Video'}
                          <input
                            className="admin-upload-input"
                            type="file"
                            accept="video/*"
                            onChange={handlePanelFileSelect(index, 'video')}
                            disabled={isBusy || Boolean(uploadingFieldKey)}
                          />
                        </label>
                        <span className="admin-upload-note">Safe path: CuzMedia/uploads/video/...</span>
                      </div>
                    </label>
                    <label className="admin-field">
                      <span>Poster Path</span>
                      <input value={panel.posterPath} onChange={(event) => updatePanel(index, (current) => ({ ...current, posterPath: event.target.value }))} />
                      <div className="admin-upload-row">
                        <label className="admin-upload-button">
                          {uploadingFieldKey === getUploadFieldKey(panel.id, 'image') ? 'Uploading Image...' : 'Upload Image'}
                          <input
                            className="admin-upload-input"
                            type="file"
                            accept="image/*"
                            onChange={handlePanelFileSelect(index, 'image')}
                            disabled={isBusy || Boolean(uploadingFieldKey)}
                          />
                        </label>
                        <span className="admin-upload-note">Sets Poster + Fallback Poster automatically.</span>
                      </div>
                    </label>
                    <label className="admin-field">
                      <span>Fallback Video URL</span>
                      <input
                        value={panel.fallbackVideoSrc ?? ''}
                        onChange={(event) =>
                          updatePanel(index, (current) => ({
                            ...current,
                            fallbackVideoSrc: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="admin-field">
                      <span>Fallback Poster URL</span>
                      <input
                        value={panel.fallbackPosterSrc}
                        onChange={(event) =>
                          updatePanel(index, (current) => ({
                            ...current,
                            fallbackPosterSrc: event.target.value,
                          }))
                        }
                      />
                    </label>
                  </div>

                  <label className="admin-field admin-field-block">
                    <span>Description</span>
                    <textarea
                      value={panel.description}
                      rows={3}
                      onChange={(event) => updatePanel(index, (current) => ({ ...current, description: event.target.value }))}
                    />
                  </label>

                  <div className="admin-field-grid">
                    <label className="admin-field">
                      <span>Primary CTA Label</span>
                      <input
                        value={panel.primaryCta.label}
                        onChange={(event) =>
                          updatePanel(index, (current) => ({
                            ...current,
                            primaryCta: {
                              ...current.primaryCta,
                              label: event.target.value,
                            },
                          }))
                        }
                      />
                    </label>
                    <label className="admin-field">
                      <span>Primary CTA Href</span>
                      <input
                        value={panel.primaryCta.href}
                        onChange={(event) =>
                          updatePanel(index, (current) => ({
                            ...current,
                            primaryCta: {
                              ...current.primaryCta,
                              href: event.target.value,
                            },
                          }))
                        }
                      />
                    </label>
                    <label className="admin-field">
                      <span>Secondary CTA Label</span>
                      <input
                        value={panel.secondaryCta?.label ?? ''}
                        onChange={(event) =>
                          updatePanel(index, (current) => ({
                            ...current,
                            secondaryCta: {
                              label: event.target.value,
                              href: current.secondaryCta?.href ?? '',
                            },
                          }))
                        }
                      />
                    </label>
                    <label className="admin-field">
                      <span>Secondary CTA Href</span>
                      <input
                        value={panel.secondaryCta?.href ?? ''}
                        onChange={(event) =>
                          updatePanel(index, (current) => ({
                            ...current,
                            secondaryCta: {
                              label: current.secondaryCta?.label ?? '',
                              href: event.target.value,
                            },
                          }))
                        }
                      />
                    </label>
                  </div>

                  <label className="admin-checkline">
                    <input
                      type="checkbox"
                      checked={Boolean(panel.hero)}
                      onChange={(event) =>
                        updatePanel(index, (current) => ({
                          ...current,
                          hero: event.target.checked,
                        }))
                      }
                    />
                    <span>Hero Panel</span>
                  </label>
                </article>
              );
            })}
          </div>
        </section>

        <section className="admin-section">
          <div className="admin-section-header">
            <h2>Advanced JSON</h2>
            <div className="admin-subcard-actions">
              <button type="button" className="admin-secondary-button" onClick={syncFormToJson}>
                Sync From Form
              </button>
              <button type="button" className="admin-secondary-button" onClick={applyJsonToForm}>
                Apply JSON To Form
              </button>
            </div>
          </div>
          <textarea
            className="admin-json-editor"
            value={jsonDraft}
            onChange={(event) => setJsonDraft(event.target.value)}
            spellCheck={false}
            aria-label="CMS JSON editor"
          />
        </section>

        <section className="admin-revisions">
          <h2>Revision History</h2>
          {revisions.length === 0 ? (
            <p>No revisions yet.</p>
          ) : (
            <ul>
              {revisions.slice(0, 20).map((revision) => (
                <li key={revision.id}>
                  <span>{revision.createdAt ? new Date(revision.createdAt).toLocaleString() : revision.id}</span>
                  <button type="button" onClick={() => handleRestoreRevision(revision.id)} className="admin-secondary-button" disabled={isBusy}>
                    Restore
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')) {
    return <AdminApp />;
  }

  return <SiteApp />;
};

export default App;
