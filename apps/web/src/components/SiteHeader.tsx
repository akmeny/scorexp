import {
  Bike,
  CircleDot,
  CircleUserRound,
  Dumbbell,
  Gamepad2,
  Goal,
  Menu,
  Newspaper,
  Search,
  Settings,
  Shield,
  Sparkles,
  Star,
  Trophy,
  Volleyball,
  Zap
} from "lucide-react";
import { useState } from "react";

const primarySports = [
  { label: "Futbol", icon: Goal, active: true },
  { label: "Basketbol", icon: CircleDot, badge: "107" },
  { label: "Voleybol", icon: Volleyball },
  { label: "Tenis", icon: Trophy, badge: "22" },
  { label: "Motor Sporları", icon: Bike },
  { label: "MMA", icon: Dumbbell },
  { label: "Amerikan futbolu", icon: Shield },
  { label: "Hentbol", icon: CircleDot },
  { label: "E-spor", icon: Gamepad2, badge: "6" },
  { label: "Dart", icon: Sparkles },
  { label: "Ice hockey", icon: Zap, badge: "1" }
];

const overflowSports = [
  ["Table tennis", "15"],
  ["Beyzbol", "4"],
  ["Ragbi", "1"],
  ["Badminton", "5"],
  ["Kriket", "1"],
  ["Futsal", "1"],
  ["Bisiklet", ""],
  ["Snooker", ""],
  ["Su Topu", "1"],
  ["Aussie rules", "1"],
  ["Beach volleyball", "2"],
  ["Mini Futbol", ""],
  ["Florbol", ""],
  ["Bandy", ""]
];

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

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
            <Star size={18} />
          </button>
          <button className="headerIcon" type="button" aria-label="Hızlı erişim">
            <Zap size={18} />
          </button>
          <button className="headerIcon" type="button" aria-label="Ayarlar">
            <Settings size={18} />
          </button>
        </div>
      </div>

      <div className="sportsBar">
        <nav className="sportsNav" aria-label="Spor dalları">
          {primarySports.map((sport) => {
            const Icon = sport.icon;
            return (
              <button className={sport.active ? "sportItem active" : "sportItem"} type="button" key={sport.label}>
                <span className="sportIconWrap">
                  <Icon size={16} />
                  {sport.badge ? <span className="sportBadge">{sport.badge}</span> : null}
                </span>
                <span>{sport.label}</span>
              </button>
            );
          })}

          <button className="sportItem moreSportsButton" type="button" onClick={() => setMenuOpen((open) => !open)}>
            <span className="sportIconWrap">
              <Menu size={16} />
            </span>
            <span>Daha F...</span>
          </button>
        </nav>

        <button className="newsButton" type="button">
          <Newspaper size={15} />
          HABERLER
        </button>

        {menuOpen ? (
          <div className="sportsMenu">
            {overflowSports.map(([label, count]) => (
              <button type="button" key={label}>
                <CircleDot size={18} />
                <span>{label}</span>
                {count ? <strong>{count}</strong> : null}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </header>
  );
}
