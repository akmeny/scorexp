import {
  CircleUserRound,
  Menu,
  Newspaper,
  Search,
  Settings,
  Star,
  Zap
} from "lucide-react";
import type { CSSProperties } from "react";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

interface SiteHeaderProps {
  footballCount: number;
}

interface SportIconProps {
  size?: number;
}

const primarySports = [
  { key: "football", label: "Futbol", icon: FootballIcon, active: true },
  { key: "basketball", label: "Basketbol", icon: BasketballIcon },
  { key: "volleyball", label: "Voleybol", icon: VolleyballIcon },
  { key: "tennis", label: "Tenis", icon: TennisIcon },
  { key: "motorsport", label: "Motor sporları", icon: RacingIcon },
  { key: "mma", label: "MMA", icon: MmaIcon },
  { key: "americanFootball", label: "Amerikan futbolu", icon: AmericanFootballIcon },
  { key: "handball", label: "Hentbol", icon: HandballIcon },
  { key: "esports", label: "E-spor", icon: EsportsIcon },
  { key: "darts", label: "Dart", icon: DartsIcon },
  { key: "iceHockey", label: "Buz hokeyi", icon: IceHockeyIcon }
];

const overflowSports = [
  "Masa tenisi",
  "Beyzbol",
  "Ragbi",
  "Badminton",
  "Kriket",
  "Futsal",
  "Bisiklet",
  "Snooker",
  "Su topu",
  "Avustralya futbolu",
  "Plaj voleybolu",
  "Mini futbol",
  "Florbol",
  "Bandy"
];

export function SiteHeader({ footballCount }: SiteHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const sportsBarRef = useRef<HTMLDivElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const counts = {
    football: footballCount,
    basketball: 0,
    volleyball: 0,
    tennis: 0,
    motorsport: 0,
    mma: 0,
    americanFootball: 0,
    handball: 0,
    esports: 0,
    darts: 0,
    iceHockey: 0
  };

  useEffect(() => {
    if (!menuOpen) return;

    const updatePosition = () => {
      const sportsBar = sportsBarRef.current;
      const button = moreButtonRef.current;
      if (!sportsBar || !button) return;

      const barRect = sportsBar.getBoundingClientRect();
      const buttonRect = button.getBoundingClientRect();
      const menuWidth = Math.min(510, window.innerWidth - 24);
      const preferredLeft = buttonRect.left - barRect.left;
      const alignedLeft =
        preferredLeft + menuWidth > barRect.width ? buttonRect.right - barRect.left - menuWidth : preferredLeft;
      const left = Math.max(0, Math.min(alignedLeft, barRect.width - menuWidth));

      setMenuStyle({
        left,
        top: buttonRect.bottom - barRect.top + 8,
        width: menuWidth
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    return () => window.removeEventListener("resize", updatePosition);
  }, [menuOpen]);

  return (
    <header className="siteHeader">
      <div className="headerTop">
        <a className="brand" href="/" aria-label="Scorexp ana sayfa">
          <span className="brandMark">S</span>
          <span>Scorexp</span>
        </a>

        <label className="headerSearch">
          <Search size={18} />
          <input type="search" placeholder="Maçları, müsabakaları, takımları ve oyuncuları ara" />
        </label>

        <div className="headerActions">
          <button className="loginButton" type="button">
            <CircleUserRound size={17} />
            OTURUM AÇ
          </button>
          <button className="headerIcon" type="button" aria-label="Favoriler">
            <Star size={20} />
          </button>
          <button className="headerIcon" type="button" aria-label="Hızlı erişim">
            <Zap size={20} />
          </button>
          <button className="headerIcon" type="button" aria-label="Ayarlar">
            <Settings size={20} />
          </button>
        </div>
      </div>

      <div className="sportsBar" ref={sportsBarRef}>
        <nav className="sportsNav" aria-label="Spor dalları">
          {primarySports.map((sport) => {
            const Icon = sport.icon;
            return (
              <button className={sport.active ? "sportItem active" : "sportItem"} type="button" key={sport.label}>
                <span className="sportIconWrap">
                  <Icon size={18} />
                  <span className="sportBadge">{counts[sport.key as keyof typeof counts]}</span>
                </span>
                <span>{sport.label}</span>
              </button>
            );
          })}

          <button
            className="sportItem moreSportsButton"
            type="button"
            ref={moreButtonRef}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className="sportIconWrap">
              <Menu size={16} />
            </span>
            <span>Daha fazla</span>
          </button>
        </nav>

        <button className="newsButton" type="button">
          <Newspaper size={15} />
          HABERLER
        </button>

        {menuOpen ? (
          <div className="sportsMenu" style={menuStyle}>
            {overflowSports.map((label) => (
              <button type="button" key={label}>
                <MoreSportIcon size={18} />
                <span>{label}</span>
                <strong>0</strong>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </header>
  );
}

function SvgRoot({ size = 18, children }: SportIconProps & { children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

function FootballIcon({ size }: SportIconProps) {
  return (
    <SvgRoot size={size}>
      <circle cx="12" cy="12" r="9" />
      <path d="m9 9 3-2 3 2-1 4h-4z" />
      <path d="m10 13-3 2" />
      <path d="m14 13 3 2" />
      <path d="m8 6 1 3" />
      <path d="m16 6-1 3" />
      <path d="m9 18 1-5" />
      <path d="m15 18-1-5" />
    </SvgRoot>
  );
}

function BasketballIcon({ size }: SportIconProps) {
  return (
    <SvgRoot size={size}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3c2.6 2.5 4 5.5 4 9s-1.4 6.5-4 9" />
      <path d="M12 3c-2.6 2.5-4 5.5-4 9s1.4 6.5 4 9" />
    </SvgRoot>
  );
}

function VolleyballIcon({ size }: SportIconProps) {
  return (
    <SvgRoot size={size}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3c1.4 3.8.6 6.7-2.2 8.8" />
      <path d="M20.2 8.5c-3.9-.5-6.7.6-8.3 3.4" />
      <path d="M5 17.6c2.9-2.8 6-3.5 9.4-2" />
    </SvgRoot>
  );
}

function TennisIcon({ size }: SportIconProps) {
  return (
    <SvgRoot size={size}>
      <ellipse cx="10" cy="8" rx="5" ry="6.5" transform="rotate(-35 10 8)" />
      <path d="m14 13 6 6" />
      <path d="M6 7c2.5.2 5.2 1.3 7.8 3.4" />
      <path d="M9 3.4c.3 2.8 1.5 5.5 3.7 8.1" />
    </SvgRoot>
  );
}

function RacingIcon({ size }: SportIconProps) {
  return (
    <SvgRoot size={size}>
      <path d="M5 20V4" />
      <path d="M5 5c4-2 6 2 10 0v9c-4 2-6-2-10 0" />
      <path d="M9 4.3v9.4" />
      <path d="M13 5.4v9.2" />
    </SvgRoot>
  );
}

function MmaIcon({ size }: SportIconProps) {
  return (
    <SvgRoot size={size}>
      <path d="M7 11V7a2 2 0 0 1 4 0v3" />
      <path d="M11 10V6a2 2 0 0 1 4 0v5" />
      <path d="M15 11V8a2 2 0 0 1 4 0v5" />
      <path d="M5 12v2a6 6 0 0 0 6 6h3a5 5 0 0 0 5-5v-2" />
      <path d="M5 12h14" />
    </SvgRoot>
  );
}

function AmericanFootballIcon({ size }: SportIconProps) {
  return (
    <SvgRoot size={size}>
      <path d="M4 12c2-6 10-9 16-8 1 6-2 14-8 16-4 .8-7.2-.8-8-8Z" />
      <path d="m8 16 8-8" />
      <path d="m10.5 13.5 2 2" />
      <path d="m12.5 11.5 2 2" />
    </SvgRoot>
  );
}

function HandballIcon({ size }: SportIconProps) {
  return (
    <SvgRoot size={size}>
      <circle cx="16.5" cy="6.5" r="3" />
      <path d="M7 20v-5l3-3 4 2" />
      <path d="M10 12 8 8" />
      <path d="m12 15 4 5" />
    </SvgRoot>
  );
}

function EsportsIcon({ size }: SportIconProps) {
  return (
    <SvgRoot size={size}>
      <rect x="3" y="9" width="18" height="9" rx="3" />
      <path d="M8 13v2" />
      <path d="M7 14h2" />
      <path d="M15 14h.01" />
      <path d="M18 14h.01" />
    </SvgRoot>
  );
}

function DartsIcon({ size }: SportIconProps) {
  return (
    <SvgRoot size={size}>
      <circle cx="10" cy="14" r="6" />
      <circle cx="10" cy="14" r="2" />
      <path d="m14 10 6-6" />
      <path d="m18 4 2 2" />
      <path d="M20 4v4h-4" />
    </SvgRoot>
  );
}

function IceHockeyIcon({ size }: SportIconProps) {
  return (
    <SvgRoot size={size}>
      <path d="M7 3v12c0 2 1 3 3 3h5" />
      <path d="M17 3v12" />
      <path d="M10 18h8" />
      <path d="M16 21h5" />
    </SvgRoot>
  );
}

function MoreSportIcon({ size }: SportIconProps) {
  return (
    <SvgRoot size={size}>
      <circle cx="12" cy="12" r="8" />
      <path d="M8 12h.01" />
      <path d="M12 12h.01" />
      <path d="M16 12h.01" />
    </SvgRoot>
  );
}
